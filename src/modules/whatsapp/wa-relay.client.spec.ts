import { WaRelayError } from './wa-errors';
import { WaRelayClient, mapRelayFailure } from './wa-relay.client';

const refusal = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  mapRelayFailure(status, {
    success: false,
    statusCode: status,
    code,
    message: code,
    errors: [{ field: 'request', code, message: code, ...extra }],
  });

describe('relay → ERP codes (wa-relay-keys §5, P1 notes)', () => {
  it.each([
    [401, 'RELAY_KEY_INVALID', 'WA_KEY_REVOKED'],
    [401, 'RELAY_KEY_REVOKED', 'WA_KEY_REVOKED'],
    [403, 'RELAY_SHOP_SUSPENDED', 'WA_SHOP_SUSPENDED'],
    [409, 'RELAY_NOT_CONNECTED', 'WA_NOT_CONNECTED'],
    [409, 'RELAY_ALREADY_CONNECTED', 'WA_ALREADY_CONNECTED'],
    [404, 'RELAY_CODE_INVALID', 'WA_ACTIVATION_INVALID'],
    [409, 'RELAY_TEMPLATE_NOT_APPROVED', 'WA_TEMPLATE_NOT_APPROVED'],
    [413, 'RELAY_PDF_TOO_BIG', 'WA_PDF_TOO_BIG'],
    [413, 'RELAY_PAYLOAD_TOO_BIG', 'WA_PDF_TOO_BIG'],
    [504, 'RELAY_META_UNREACHABLE', 'WA_RELAY_UNREACHABLE'],
    [429, 'RELAY_RATE_LIMITED', 'WA_RELAY_BUSY'],
    [500, 'RELAY_INTERNAL', 'WA_RELAY_ERROR'],
    [404, 'RELAY_NOT_FOUND', 'WA_RELAY_ERROR'],
    [503, 'RELAY_DB_DOWN', 'WA_RELAY_ERROR'],
  ])('%s %s → %s', (status, code, wa) => {
    expect(refusal(status, code).waCode).toBe(wa);
  });
  it('Meta codes: a worded one keeps its own code, any other is WA_META_OTHER', () => {
    expect(refusal(502, 'RELAY_META_ERROR', { metaCode: 131026, metaTitle: 'Message undeliverable' }).waCode).toBe('WA_META_131026');
    expect(refusal(502, 'RELAY_META_ERROR', { metaCode: 190 }).waCode).toBe('WA_META_190');
    expect(refusal(502, 'RELAY_META_ERROR', { metaCode: 4242 }).waCode).toBe('WA_META_OTHER');
  });
  it('S3: 504 RELAY_SEND_UNCONFIRMED is "not confirmed yet", not a failure (and not WA_RELAY_UNREACHABLE)', () => {
    const e = refusal(504, 'RELAY_SEND_UNCONFIRMED');
    expect(e.unconfirmed).toBe(true);
    expect(e.waCode).not.toBe('WA_RELAY_UNREACHABLE');
    expect(refusal(504, 'RELAY_META_UNREACHABLE').unconfirmed).toBe(false);
  });
  it('a bad request on `to` is WA_BAD_NUMBER, any other WA_RELAY_BAD_REQUEST; garbage is WA_RELAY_ERROR', () => {
    expect(mapRelayFailure(400, { success: false, code: 'RELAY_BAD_REQUEST', errors: [{ field: 'to', code: 'RELAY_BAD_REQUEST' }] }).waCode).toBe(
      'WA_BAD_NUMBER',
    );
    expect(refusal(400, 'RELAY_BAD_REQUEST').waCode).toBe('WA_RELAY_BAD_REQUEST');
    expect(mapRelayFailure(502, null, '<html>bad gateway</html>').waCode).toBe('WA_RELAY_ERROR');
  });
});

describe('WaRelayClient — offline fails at once (Q12)', () => {
  it('a dead URL (network error) is WA_RELAY_UNREACHABLE on the first try, no retry', async () => {
    const client = new WaRelayClient();
    const fetchFn = jest.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    client.fetchFn = fetchFn as unknown as typeof fetch;
    const err = await client
      .send('http://127.0.0.1:9', 'k', { clientRef: 'x', to: '919800012345', templateName: 'hello_world', lang: 'en_US', params: {} }, null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WaRelayError);
    expect((err as WaRelayError).waCode).toBe('WA_RELAY_UNREACHABLE');
    expect((err as WaRelayError).message).toContain('ECONNREFUSED');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('a success envelope answers `data`; the multipart carries `meta` and the PDF part', async () => {
    const client = new WaRelayClient();
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: { relayMsgId: 'r', wamid: 'w', acceptedAt: '2026-11-17T10:00:00Z', duplicate: false } }),
    });
    client.fetchFn = fetchFn as unknown as typeof fetch;
    const res = await client.send(
      'http://relay',
      'key',
      { clientRef: 'c', to: '919800012345', templateName: 'nex_order_confirm_v1', lang: 'en', params: { a: 'b' } },
      { bytes: Buffer.from('%PDF-1.4'), filename: 'Order-1.pdf' },
    );
    expect(res.wamid).toBe('w');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://relay/v1/messages');
    expect(init.headers.Authorization).toBe('Bearer key');
    const form = init.body as FormData;
    expect(JSON.parse(String(form.get('meta')))).toMatchObject({ clientRef: 'c', templateName: 'nex_order_confirm_v1' });
    expect(form.get('document')).toBeTruthy();
  });
  it('S3: POST /v1/messages waits 60 s (the relay may take ~50 s); a JSON call still gives up at 30 s', async () => {
    jest.useFakeTimers();
    try {
      const hang = jest.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
      );
      const client = new WaRelayClient();
      client.fetchFn = hang as unknown as typeof fetch;
      let settled: unknown = 'pending';
      const send = client
        .send('http://relay', 'k', { clientRef: 'c', to: '919800012345', templateName: 'hello_world', lang: 'en_US', params: {} }, null)
        .catch((e: unknown) => (settled = e));
      await jest.advanceTimersByTimeAsync(50_000);
      expect(settled).toBe('pending');
      await jest.advanceTimersByTimeAsync(10_001);
      await send;
      expect((settled as WaRelayError).waCode).toBe('WA_RELAY_UNREACHABLE');
      expect((settled as WaRelayError).message).toContain('no answer in 60 s');

      let ev: unknown = 'pending';
      const events = client.events('http://relay', 'k', 0).catch((e: unknown) => (ev = e));
      await jest.advanceTimersByTimeAsync(30_001);
      await events;
      expect((ev as WaRelayError).message).toContain('no answer in 30 s');
    } finally {
      jest.useRealTimers();
    }
  });
});
