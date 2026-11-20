import { Prisma } from '@prisma/client';
import { WaRelayClient } from './wa-relay.client';
import { WaSendService, type PreparedSend } from './wa-send.service';

/** A deliver() over mocks: the store, the print engine and the relay's fetch. */
function harness(fetchImpl: jest.Mock, conn: Record<string, unknown> | null = { wacState: 'CONNECTED', wacRelayUrl: 'http://127.0.0.1:9', wacCompanyId: 'co' }) {
  const executed: string[] = [];
  const steps: { tslEvent: string; tslNotifyChannel: string | null; tslNotifyRef: string | null }[] = [];
  const tx = {
    txnStatusLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => {
        steps.push(data);
        return data;
      }),
    },
    deviceMaster: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
      executed.push(strings.join('?'));
      return 1;
    }),
    $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
  const store = {
    prisma,
    row: jest.fn().mockResolvedValue(conn),
    keyOf: jest.fn().mockReturnValue('relay-key'),
    noteRelayError: jest.fn(),
    fastPoll: jest.fn(),
  };
  const relay = new WaRelayClient();
  relay.fetchFn = fetchImpl as unknown as typeof fetch;
  const print = {
    renderForWhatsApp: jest.fn().mockResolvedValue({ ok: true, bytes: Buffer.from('%PDF'), versionId: 'v1', templateCode: 'X', assignmentMode: 'WHATSAPP' }),
  };
  const service = new WaSendService(store as never, {} as never, relay, print as never, {} as never);
  return { service, prisma, executed, steps, store, print, tx };
}

const prepared = (): PreparedSend => ({
  wmlId: '01a1e9ef-bb41-7016-a8b9-ac751d576673',
  accYear: '2026-2027',
  companyId: 'co',
  branchId: 'br',
  kind: 'ORDER',
  trigger: 'ON_POST',
  status: 'SENDING',
  phone: '919800012345',
  phoneSource: 'TYPED',
  templateName: 'nex_order_confirm_v1',
  lang: 'en',
  langNote: null,
  errorCode: null,
  errorText: null,
  params: { customer_name: 'ZT' },
  pdf: { purposeCode: 'SALE_ORDER', docId: 'so', docAccYear: '2026-2027', params: {}, filename: 'Order-sor1.pdf' },
  doc: {
    docType: 'SALES_ORDER',
    kind: 'ORDER',
    docId: 'so',
    accYear: '2026-2027',
    companyId: 'co',
    branchId: 'br',
    refno: 'sor1',
    date: '2026-11-17',
    amount: new Prisma.Decimal(40),
    status: 'CONFIRMED',
    posted: true,
    cancelled: false,
    partyId: 'p',
    docPartyName: 'ZT',
    docPhone: '9800012345',
    vchrTypeId: 4,
    deviceId: null,
    printPurposeCode: 'SALE_ORDER',
  },
  actor: { userId: null, userName: 'VKPOS', deviceId: null, branchId: null },
});

describe('WaSendService.deliver — offline fails at once (Q12)', () => {
  it('the relay cannot be reached: FAILED WA_RELAY_UNREACHABLE on the first try, a WHATSAPP_FAILED step, nothing queued', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    const h = harness(fetchImpl);
    const out = await h.service.deliver(prepared());
    expect(out).toMatchObject({ status: 'FAILED', errorCode: 'WA_RELAY_UNREACHABLE' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(h.executed.some((sql) => sql.includes("wml_status = 'FAILED'") && sql.includes("wml_status = 'SENDING'"))).toBe(true);
    expect(h.steps).toEqual([expect.objectContaining({ tslEvent: 'WHATSAPP_FAILED', tslNotifyChannel: 'WHATSAPP', tslNotifyRef: prepared().wmlId })]);
    expect(h.service.inFlight.size).toBe(0);
    expect(h.store.fastPoll).not.toHaveBeenCalled();
  });

  it('accepted: SENT (never over a status a pull already wrote), WHATSAPP_SENT step, fast polling on', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ success: true, data: { relayMsgId: '01a1e9ef-0000-7000-8000-000000000001', wamid: 'wamid.X', acceptedAt: '2026-11-17T10:00:00Z', duplicate: false } }),
    });
    const h = harness(fetchImpl);
    const out = await h.service.deliver(prepared());
    expect(out.status).toBe('SENT');
    expect(h.executed.some((sql) => sql.includes("CASE WHEN wml_status = 'SENDING' THEN 'SENT' ELSE wml_status END"))).toBe(true);
    expect(h.steps[0]).toMatchObject({ tslEvent: 'WHATSAPP_SENT' });
    expect(h.store.fastPoll).toHaveBeenCalledWith('co');
    expect(h.print.renderForWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ purposeCode: 'SALE_ORDER' }));
  });

  it('no print design: FAILED WA_PDF_NO_DESIGN and the relay is not called', async () => {
    const fetchImpl = jest.fn();
    const h = harness(fetchImpl);
    h.print.renderForWhatsApp.mockResolvedValue({ ok: false, reason: 'NO_DESIGN', message: 'none' });
    const out = await h.service.deliver(prepared());
    expect(out).toMatchObject({ status: 'FAILED', errorCode: 'WA_PDF_NO_DESIGN' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('not CONNECTED any more when the send runs: FAILED WA_NOT_CONNECTED', async () => {
    const fetchImpl = jest.fn();
    const h = harness(fetchImpl, { wacState: 'DISCONNECTED', wacRelayUrl: 'x', wacCompanyId: 'co' });
    expect((await h.service.deliver(prepared())).errorCode).toBe('WA_NOT_CONNECTED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('S3: 504 RELAY_SEND_UNCONFIRMED keeps the row SENDING: no FAILED write, no "No internet", no step, fast polling on', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 504,
      text: async () =>
        JSON.stringify({
          success: false,
          statusCode: 504,
          code: 'RELAY_SEND_UNCONFIRMED',
          message: 'not confirmed',
          errors: [{ field: 'meta', code: 'RELAY_SEND_UNCONFIRMED', message: 'x', relayMsgId: '01a1e9ef-0000-7000-8000-0000000000aa', duplicate: false }],
        }),
    });
    const h = harness(fetchImpl);
    const out = await h.service.deliver(prepared());
    expect(out).toMatchObject({ status: 'SENDING', errorCode: null, errorText: null });
    expect(h.executed.some((sql) => sql.includes("wml_status = 'FAILED'"))).toBe(false);
    expect(h.executed.some((sql) => sql.includes('wml_relay_msg_id = COALESCE(wml_relay_msg_id'))).toBe(true);
    expect(h.steps).toEqual([]);
    expect(h.store.fastPoll).toHaveBeenCalledWith('co');
    expect(h.store.noteRelayError).not.toHaveBeenCalled();
    expect(h.service.inFlight.size).toBe(0);
  });

  it('one status step per send: a step already filed for this wml_id (tsl_notify_ref) is not filed again', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    const h = harness(fetchImpl);
    h.tx.txnStatusLog.findFirst.mockResolvedValueOnce({ tslSeqNo: 3 });
    await h.service.deliver(prepared());
    expect(h.steps).toEqual([]);
    expect(h.tx.txnStatusLog.findFirst.mock.calls[0][0].where).toMatchObject({ tslNotifyRef: prepared().wmlId, tslSrcDocId: 'so' });
  });

  it('a FAILED row written inside a retry\'s transaction files its step when deliver runs (after the commit)', async () => {
    const h = harness(jest.fn());
    const p = { ...prepared(), status: 'FAILED' as const, errorCode: 'WA_TEMPLATE_NOT_APPROVED', pendingStep: true };
    await expect(h.service.deliver(p)).resolves.toMatchObject({ status: 'FAILED', errorCode: 'WA_TEMPLATE_NOT_APPROVED' });
    expect(h.steps).toEqual([expect.objectContaining({ tslEvent: 'WHATSAPP_FAILED' })]);
    expect(p.pendingStep).toBe(false);
  });

  it('S5: a popup number is recorded in wml_params ($typedInPopup), which the relay never gets', async () => {
    const h = harness(jest.fn());
    const create = jest.fn().mockResolvedValue({ wmlId: 'n', wmlAccYear: '2026-2027' });
    (h.prisma as unknown as { waMessageLog: unknown }).waMessageLog = { create };
    const base = prepared();
    const row = {
      accYear: '2026-2027', companyId: 'co', branchId: 'br', kind: 'ORDER', trigger: 'MANUAL', doc: base.doc, partyId: 'p', partyName: 'ZT',
      phone: '919800099999', phoneSource: 'TYPED', templateName: 'nex_order_confirm_v1', langWanted: 'en', langSent: 'en', langNote: null,
      params: { customer_name: 'ZT' }, status: 'SENDING', settings: { ratePerMessage: new Prisma.Decimal('0.115'), rateGstPercent: new Prisma.Decimal(18) },
      actor: base.actor,
    };
    const svc = h.service as unknown as { writeRow: (r: unknown) => Promise<PreparedSend> };
    const out = await svc.writeRow({ ...row, popupPhone: true });
    expect(create.mock.calls[0][0].data.wmlParams).toEqual({ customer_name: 'ZT', $typedInPopup: true });
    expect(out.params).toEqual({ customer_name: 'ZT' });
    await svc.writeRow({ ...row, popupPhone: false });
    expect(create.mock.calls[1][0].data.wmlParams).toEqual({ customer_name: 'ZT' });
  });

  it('N8: a log row that cannot be written is logged with the document, then thrown', async () => {
    const h = harness(jest.fn());
    (h.prisma as unknown as { waMessageLog: unknown }).waMessageLog = { create: jest.fn().mockRejectedValue(new Error('no partition of relation "wa_message_log" found for row')) };
    const logged = jest.spyOn((h.service as unknown as { logger: { error: (m: string) => void } }).logger, 'error').mockImplementation(() => undefined);
    const base = prepared();
    const svc = h.service as unknown as { writeRow: (r: unknown) => Promise<PreparedSend> };
    await expect(
      svc.writeRow({
        accYear: '2027-2028', companyId: 'co', branchId: 'br', kind: 'ORDER', trigger: 'ON_POST', doc: base.doc, partyId: 'p', partyName: 'ZT',
        phone: null, phoneSource: null, templateName: 'nex_order_confirm_v1', langWanted: null, langSent: null, langNote: null, params: null,
        status: 'SKIPPED', errorCode: 'WA_NO_NUMBER', settings: { ratePerMessage: null, rateGstPercent: null }, actor: base.actor,
      }),
    ).rejects.toThrow('no partition');
    expect(logged.mock.calls[0][0]).toContain('SALES_ORDER so (sor1)');
    expect(logged.mock.calls[0][0]).toContain("ensure_acc_year_partitions('2027-2028')");
  });

  it('a synchronous route answers within WA_SYNC_ANSWER_MS: a slow relay -> SENDING now, the send runs on and settles the row', async () => {
    jest.useFakeTimers();
    try {
      let answer: (v: unknown) => void = () => undefined;
      const fetchImpl = jest.fn(() => new Promise((resolve) => (answer = resolve)));
      const h = harness(fetchImpl as unknown as jest.Mock);
      const p = prepared();
      const out = h.service.deliverForAnswer(p, 12_000);
      await jest.advanceTimersByTimeAsync(12_001);
      await expect(out).resolves.toMatchObject({ status: 'SENDING', errorCode: null });
      expect(h.service.inFlight.has(p.wmlId)).toBe(true); // the sweeper leaves it alone
      answer({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { relayMsgId: '01a1e9ef-0000-7000-8000-000000000001', wamid: 'wamid.L', acceptedAt: '2026-11-17T10:00:20Z', duplicate: false } }),
      });
      await jest.advanceTimersByTimeAsync(10);
      expect(h.executed.some((sql) => sql.includes("THEN 'SENT'"))).toBe(true);
      expect(h.service.inFlight.size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
  it('a quick send answers its real outcome', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    const h = harness(fetchImpl);
    await expect(h.service.deliverForAnswer(prepared(), 12_000)).resolves.toMatchObject({ status: 'FAILED', errorCode: 'WA_RELAY_UNREACHABLE' });
  });
});
