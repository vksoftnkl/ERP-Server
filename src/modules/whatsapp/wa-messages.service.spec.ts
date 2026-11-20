import { HttpException } from '@nestjs/common';
import { WaMessagesService, typedInPopup } from './wa-messages.service';

/**
 * Review S4 / S5 / N9 — POST /messages/retry: one transaction that locks the
 * chain's first try, judges the LATEST try, and writes the new one.
 */
type Row = Record<string, unknown>;
const row = (over: Row = {}): Row => ({
  wml_id: 'a',
  wml_acc_year: '2026-2027',
  wml_company_id: 'co',
  wml_kind: 'ORDER',
  wml_trigger: 'MANUAL',
  wml_src_doc_type: 'SALES_ORDER',
  wml_src_doc_id: 'so',
  wml_src_acc_year: '2026-2027',
  wml_phone: '919800099999',
  wml_phone_source: 'PHONE1',
  wml_params: {},
  wml_lang_wanted: 'en',
  wml_status: 'FAILED',
  wml_try_no: 1,
  wml_retry_of: null,
  wml_created_on: new Date('2026-11-17T10:00:00Z'),
  ...over,
});

function harness(loaded: Row, chain: Row[]) {
  const sqls: string[] = [];
  const tx = {
    $queryRaw: jest.fn(async (strings: string[]) => {
      const sql = strings.join('?');
      sqls.push(sql);
      if (sql.includes('FOR UPDATE')) return [{ wml_id: 'root' }];
      if (sql.includes('down AS')) return chain;
      return [loaded];
    }),
  };
  const store = {
    prisma: { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
    right: jest.fn(),
    assertMainServer: jest.fn(),
    actor: jest.fn().mockResolvedValue({ userId: null, userName: 'VKPOS', deviceId: null, branchId: null }),
  };
  const sends = {
    prepareDocument: jest.fn().mockResolvedValue({ wmlId: 'new', status: 'SENDING' }),
    prepareTest: jest.fn().mockResolvedValue({ wmlId: 'new', status: 'SENDING' }),
    deliverForAnswer: jest.fn().mockResolvedValue({ wmlId: 'new', status: 'SENT' }),
  };
  const svc = new WaMessagesService(store as never, sends as never);
  return { svc, tx, sends, sqls, store };
}

async function refusal(p: Promise<unknown>): Promise<{ status: number; error: Record<string, unknown> }> {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(HttpException);
  const h = e as HttpException;
  return { status: h.getStatus(), error: (h.getResponse() as { errors: Record<string, unknown>[] }).errors[0] };
}

const dto = (over: Row = {}) => ({ companyId: 'co', wmlId: 'a', accYear: '2026-2027', ...over });

describe('retry (review S4): one transaction, the root locked, the LATEST try judged', () => {
  it('an old FAILED try after a later READ one needs confirmResend (409 WA_ALREADY_DELIVERED, status READ)', async () => {
    const a = row();
    const b = row({ wml_id: 'b', wml_status: 'READ', wml_try_no: 2, wml_retry_of: 'a' });
    const h = harness(a, [a, b]);
    const r = await refusal(h.svc.retry(dto()));
    expect(r.status).toBe(409);
    expect(r.error).toMatchObject({ code: 'WA_ALREADY_DELIVERED', status: 'READ', latestWmlId: 'b' });
    expect(h.sends.prepareDocument).not.toHaveBeenCalled();
    expect(h.sqls.some((s) => s.includes('FOR UPDATE OF l'))).toBe(true);
  });

  it('with confirmResend it goes: try no = the latest + 1, retry_of = the row asked for, written inside the transaction', async () => {
    const a = row();
    const b = row({ wml_id: 'b', wml_status: 'READ', wml_try_no: 2, wml_retry_of: 'a' });
    const h = harness(a, [a, b]);
    await h.svc.retry(dto({ confirmResend: true }));
    expect(h.sends.prepareDocument).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'RETRY', tryNo: 3, retryOf: 'a' }), h.tx);
    expect(h.sends.deliverForAnswer).toHaveBeenCalledTimes(1);
    // the lock comes before the chain is read
    const lock = h.sqls.findIndex((s) => s.includes('FOR UPDATE'));
    const chain = h.sqls.findIndex((s) => s.includes('down AS'));
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(chain);
  });

  it('the latest try still SENDING (a double click, an unconfirmed send) → 409 WA_RETRY_NOT_ALLOWED, even with confirmResend', async () => {
    const a = row();
    const b = row({ wml_id: 'b', wml_status: 'SENDING', wml_try_no: 2, wml_retry_of: 'a' });
    const h = harness(a, [a, b]);
    const r = await refusal(h.svc.retry(dto({ confirmResend: true })));
    expect(r.status).toBe(409);
    expect(r.error).toMatchObject({ code: 'WA_RETRY_NOT_ALLOWED', status: 'SENDING', latestWmlId: 'b' });
    expect(h.sends.prepareDocument).not.toHaveBeenCalled();
  });

  it('a later FAILED / SENT try does not need confirmResend', async () => {
    for (const status of ['FAILED', 'SENT', 'SKIPPED']) {
      const a = row({ wml_status: 'READ' });
      const b = row({ wml_id: 'b', wml_status: status, wml_try_no: 2, wml_retry_of: 'a' });
      const h = harness(a, [a, b]);
      await h.svc.retry(dto());
      expect(h.sends.prepareDocument).toHaveBeenCalledWith(expect.objectContaining({ tryNo: 3 }), h.tx);
    }
  });

  it('N9: a kind this build does not send is 400 VALIDATION_IS_IN, never "Still sending"', async () => {
    const h = harness(row({ wml_kind: 'BILL', wml_status: 'SENDING' }), []);
    const r = await refusal(h.svc.retry(dto()));
    expect(r.status).toBe(400);
    expect(r.error).toMatchObject({ code: 'VALIDATION_IS_IN', field: 'wmlId', kind: 'BILL' });
  });

  it('a test message is retried as a test, to its own number, in the transaction', async () => {
    const t = row({ wml_kind: 'TEST', wml_src_doc_type: null, wml_src_doc_id: null, wml_phone: '916000131026', wml_phone_source: 'TYPED' });
    const h = harness(t, [t]);
    await h.svc.retry(dto());
    expect(h.sends.prepareTest).toHaveBeenCalledWith(expect.objectContaining({ phone: '916000131026', tryNo: 2, retryOf: 'a' }), h.tx);
  });
});

describe('retry (review S5): a popup number keeps its place before the master numbers', () => {
  it('a number typed in the send popup goes again as the popup number (bodyPhone)', async () => {
    const a = row({ wml_phone_source: 'TYPED', wml_phone: '919865322156', wml_params: { customer_name: 'ZT', $typedInPopup: true } });
    const h = harness(a, [a]);
    await h.svc.retry(dto());
    expect(h.sends.prepareDocument).toHaveBeenCalledWith(expect.objectContaining({ bodyPhone: '919865322156' }), h.tx);
  });
  it('a number typed on the order (TYPED, no mark) or a master number is looked up again', async () => {
    for (const over of [{ wml_phone_source: 'TYPED', wml_params: { customer_name: 'ZT' } }, { wml_phone_source: 'PHONE1' }, { wml_phone_source: 'TYPED', wml_params: null }]) {
      const a = row(over);
      const h = harness(a, [a]);
      await h.svc.retry(dto());
      expect(h.sends.prepareDocument).toHaveBeenCalledWith(expect.objectContaining({ bodyPhone: null }), h.tx);
    }
  });
  it('typedInPopup reads only a true mark on a TYPED row with a number', () => {
    expect(typedInPopup({ wml_phone_source: 'TYPED', wml_phone: '91', wml_params: { $typedInPopup: true } })).toBe(true);
    expect(typedInPopup({ wml_phone_source: 'TYPED', wml_phone: '91', wml_params: { $typedInPopup: 'true' } })).toBe(false);
    expect(typedInPopup({ wml_phone_source: 'PHONE1', wml_phone: '91', wml_params: { $typedInPopup: true } })).toBe(false);
    expect(typedInPopup({ wml_phone_source: 'TYPED', wml_phone: null, wml_params: { $typedInPopup: true } })).toBe(false);
    expect(typedInPopup({ wml_phone_source: 'TYPED', wml_phone: '91', wml_params: null })).toBe(false);
  });
});
