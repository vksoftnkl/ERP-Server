import {
  API,
  BEARER,
  TENDER,
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  bootApp,
  grantSalesRights,
  makeItem,
  revokeSalesRights,
  runTag,
  shutdown,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales/sales-e2e.harness';

/**
 * Till REV 2 §2.4 (the non-cash plan's §3.3): which tender rows wait for a
 * provider statement. At save the one tender writer sets td_settle_status
 * PENDING — with td_expected_settle_on = the document date +
 * tnd_settlement_days — only for a CARD / UPI / WALLET tender whose close mode
 * is SLIPS / STATEMENT and whose tender master names a settlement ledger.
 * Everything else stays NA, so the Not-received list never fills with cash,
 * cheques or transfers.
 *
 * The dev UPI tender has no settlement ledger, so the suite gives it one (and
 * two settlement days) for the test and puts it back after. The bill is a
 * DRAFT throughout and is deleted.
 */

const tag = runTag();

describe('Tender rows that wait for a statement (REV 2 §2.4)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let item: Item;
  let before: { ledger: string | null; days: number };
  let sbId: string | null = null;

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);

  beforeAll(async () => {
    h = await bootApp(`e2e-settle-${tag}`);
    rights = await grantSalesRights(h.prisma);
    item = await makeItem(h.prisma, `E2E-SETTLE-${tag}`);
    const [upi] = await h.prisma.$queryRaw<{ l: string | null; d: number }[]>`
      SELECT tnd_settlement_ledger_id::text AS l, tnd_settlement_days AS d
        FROM accounts.acc_tender_master WHERE tnd_id = ${TENDER.UPI}::uuid`;
    before = { ledger: upi.l, days: upi.d };
    await h.prisma.$executeRaw`
      UPDATE accounts.acc_tender_master
         SET tnd_settlement_ledger_id = tnd_ledger_id, tnd_settlement_days = 2
       WHERE tnd_id = ${TENDER.UPI}::uuid`;
  }, 180_000);

  afterAll(async () => {
    if (sbId) {
      await post('bills/delete', billKeys(sbId));
    }
    if (before) {
      await h.prisma.$executeRaw`
        UPDATE accounts.acc_tender_master
           SET tnd_settlement_ledger_id = ${before.ledger}::uuid, tnd_settlement_days = ${before.days}::smallint
         WHERE tnd_id = ${TENDER.UPI}::uuid`;
    }
    if (h?.prisma && rights) {
      await revokeSalesRights(h.prisma, rights);
    }
    await shutdown(h);
  }, 60_000);

  it('a UPI row is PENDING, due the bill date + 2; the cash row of the same bill stays NA', async () => {
    const created = await post(
      'bills/create',
      billBody({
        custId: WALK_IN,
        custName: WALK_IN_NAME,
        lines: [{ item, qty: 2, rate: 100 }],
        tenders: [
          { tenderId: TENDER.CASH, amount: 100 },
          { tenderId: TENDER.UPI, amount: 136, refNo: `UTR${tag}` },
        ],
        usrRefno: `E2E-SETTLE-${tag}`,
      }),
    );
    if (created.status !== 201) {
      throw new Error(`bills/create: ${created.status} ${JSON.stringify(created.body)}`);
    }
    sbId = created.body.data.sbId as string;

    const rows = await h.prisma.$queryRaw<
      { type: number; status: string; due: string | null; doc: string }[]
    >`
      SELECT td_tender_type_id AS type, td_settle_status AS status,
             to_char(td_expected_settle_on, 'YYYY-MM-DD') AS due, to_char(td_doc_date, 'YYYY-MM-DD') AS doc
        FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = 'SALE_BILL' AND td_src_doc_id = ${sbId}::uuid AND td_is_deleted = false
       ORDER BY td_tender_type_id`;
    const cash = rows.find((r) => r.type === 1)!;
    const upi = rows.find((r) => r.type === 3)!;
    expect(cash).toEqual(expect.objectContaining({ status: 'NA', due: null }));
    expect(upi.status).toBe('PENDING');
    const due = new Date(`${upi.doc}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 2);
    expect(upi.due).toBe(due.toISOString().slice(0, 10));
  });
});
