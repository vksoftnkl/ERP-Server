import { HttpException } from '@nestjs/common';
import { GstHttpClient, GstHttpError, type GstHttpRequest } from './gst-http.client';
import type { GstRoute } from './gst-route-guard';

const ROUTE: GstRoute = {
  provider: { gpvCode: 'CHARTERED', gpvIsActive: true, gpvIsDeleted: false },
  service: {
    gpsService: 'EINVOICE',
    gpsEnvironment: 'SANDBOX',
    gpsIsActive: true,
    gpsIsDeleted: false,
  },
  action: 'AUTH',
  endpoint: {
    gpeIsActive: true,
    gpeIsDeleted: false,
    gpePathTemplate: '/eivital/dec/v1.04/auth',
    gpeQueryTemplate: null,
    gpeHeaders: { Gstin: '{gstin}' },
  },
};

const request = (over: Partial<GstHttpRequest> = {}): GstHttpRequest => ({
  method: 'POST',
  url: 'https://gsp.example:8443/eivital/dec/v1.04/auth',
  headers: { 'Content-Type': 'application/json', Gstin: '29AAACZ0001A1Z5' },
  body: '{"Data":"x"}',
  timeoutMs: 1500,
  route: ROUTE,
  ...over,
});

/** The GstHttpError a send was refused with. */
async function failureOf(promise: Promise<unknown>): Promise<GstHttpError> {
  const error = await promise.then(
    () => {
      throw new Error('expected the send to fail');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof GstHttpError)) throw error;
  return error;
}

const namedError = (name: string, message = name) =>
  Object.assign(new Error(message), { name }) as Error;

describe('GstHttpClient', () => {
  let fetchMock: jest.SpyInstance;
  const client = new GstHttpClient();

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  // ── a reply ───────────────────────────────────────────────────────────────
  it('sends the call exactly as the caller built it, under a timeout signal', async () => {
    fetchMock.mockResolvedValue(new Response('{"Status":1}', { status: 200 }));

    await expect(client.send(request())).resolves.toEqual({ status: 200, text: '{"Status":1}' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gsp.example:8443/eivital/dec/v1.04/auth');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Gstin: '29AAACZ0001A1Z5' },
      body: '{"Data":"x"}',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it('sends no body on a GET', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await client.send(request({ method: 'GET', body: undefined }));

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBeUndefined();
  });

  it.each([
    ['a 4xx', 401, '{"error":{"error_cd":"GSP102","message":"Invalid token"}}'],
    ['a 5xx', 502, 'Bad Gateway'],
  ])('hands back %s reply as a reply, for the caller to read', async (_label, status, text) => {
    fetchMock.mockResolvedValue(new Response(text, { status }));

    await expect(client.send(request())).resolves.toEqual({ status, text });
  });

  it('hands back a body that is not JSON as the text it is', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Service Unavailable</html>', { status: 200 }));

    await expect(client.send(request())).resolves.toEqual({
      status: 200,
      text: '<html>Service Unavailable</html>',
    });
  });

  // ── no reply ──────────────────────────────────────────────────────────────
  it('gives up after timeoutMs with a TIMEOUT, the signal really firing', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          // Node's DOMException comes from outside Jest's sandbox, so `instanceof Error` fails
          // here (it holds in production): re-raise it as a sandbox Error with the same name.
          init.signal!.addEventListener('abort', () =>
            reject(
              Object.assign(new Error('aborted'), { name: (init.signal!.reason as Error).name }),
            ),
          );
        }),
    );

    const error = await failureOf(client.send(request({ timeoutMs: 20 })));

    expect(error.kind).toBe('TIMEOUT');
    expect(error.message).toBe('No reply within 20 ms');
  });

  it.each(['TimeoutError', 'AbortError'])('counts an %s as a TIMEOUT', async (name) => {
    fetchMock.mockRejectedValue(namedError(name));

    const error = await failureOf(client.send(request()));

    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe('TIMEOUT');
    expect(error.message).toBe('No reply within 1500 ms');
  });

  it('names the host and the underlying cause when the portal cannot be reached', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: new Error('connect ECONNREFUSED 10.0.0.9:8443'),
      }),
    );

    const error = await failureOf(client.send(request()));

    expect(error.kind).toBe('NETWORK');
    expect(error.message).toBe(
      'Could not reach gsp.example:8443: connect ECONNREFUSED 10.0.0.9:8443',
    );
  });

  it.each([
    ['an error with no cause', new Error('socket hang up'), 'socket hang up'],
    ['something that is not an Error', 'boom', 'boom'],
  ])('falls back to the message of %s', async (_label, thrown, said) => {
    fetchMock.mockRejectedValue(thrown);

    const error = await failureOf(client.send(request()));

    expect(error.kind).toBe('NETWORK');
    expect(error.message).toBe(`Could not reach gsp.example:8443: ${said}`);
  });

  it('counts a reply whose body breaks off mid-read as a NETWORK failure', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      text: () => Promise.reject(Object.assign(new TypeError('terminated'), { cause: undefined })),
    } as unknown as Response);

    const error = await failureOf(client.send(request()));

    expect(error.kind).toBe('NETWORK');
    expect(error.message).toBe('Could not reach gsp.example:8443: terminated');
  });

  // ── the route ─────────────────────────────────────────────────────────────
  it('refuses a switched-off route with a 503 on gstProvider before any I/O', async () => {
    const off = { ...ROUTE, endpoint: { ...ROUTE.endpoint!, gpeIsActive: false } };

    const error = await client.send(request({ route: off })).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(503);
    expect((error as HttpException).getResponse()).toMatchObject({
      errors: [
        {
          field: 'gstProvider',
          message: 'AUTH endpoint of EINVOICE · SANDBOX is inactive',
          code: 'GST_SWITCHED_OFF',
        },
      ],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
