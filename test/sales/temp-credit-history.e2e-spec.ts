import '../../src/env.preload';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from '../helpers/menu-rights';
import {
  ACC_YEAR,
  ACTOR,
  API,
  BEARER,
  BRANCH,
  COMPANY,
  TENDER,
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  bootApp,
  explain,
  grantSalesRights,
  makeItem,
  num,
  postOpeningStock,
  probes,
  revokeSalesRights,
  runTag,
  shutdown,
  today,
  type Harness,
  type Item,
  type RightsMemo,
} from './sales-e2e.harness';

/**
 * Notes 90 — a temporary credit's own history.
 *
 *   /bills/post with 680 cash + 500 TEMP_CR   → CREATED (OPEN), an `insert` audit row
 *   /receipts/post 200 against the bill       → PARTIAL   "received 200.00 by RCT…, balance 300.00"
 *   /receipts/post 300                        → SETTLED
 *   /receipts/cancel that 300                 → REOPENED  (PARTIAL, "reversed 300.00 …")
 *   /receipts/post 100 + write-off 200        → WRITTEN_OFF (notes 90 C — derived, not stamped)
 *   /receipts/cancel that one                 → REOPENED  (PARTIAL)
 *   /receipts/cancel the first one            → REOPENED  (OPEN)
 *
 * Every step is read back from public.txn_status_log by atc_id under doc type
 * TEMP_CREDIT — what Ctrl+H on Temp Credits (grid 132) reads. Needs sales
 * rights, receipt rights (menu 99) and --runInBand like every rights suite.
 */
const tag = runTag();
const MOBILE = `9${String(Date.now()).slice(-9)}`;
const RECEIPT_MENU = 99;
const CASH_TENDER_TYPE = 1;

describe('Temporary credit — its own status trail (http, notes 90)', () => {
  let h: Harness;
  let rights: RightsMemo;
  let receiptRights: MenuRightsMemo;
  let p: ReturnType<typeof probes>;
  let item: Item;
  let bill: Record<string, any>;
  let atcId: string;
  let balance: { abl_id: string; abl_party_id: string };
  const receipts: string[] = [];

  const post = (path: string, body: Record<string, unknown>) =>
    h.http.post(`${API}/${path}`).set('Authorization', BEARER).send(body);

  const trail = async () =>
    h.prisma.$queryRaw<
      {
        tsl_event: string;
        tsl_from_status: string | null;
        tsl_to_status: string;
        tsl_remarks: string | null;
        tsl_src_doc_refno: string | null;
      }[]
    >`
      SELECT tsl_event, tsl_from_status, tsl_to_status, tsl_remarks, tsl_src_doc_refno
        FROM public.txn_status_log
       WHERE tsl_src_doc_type = 'TEMP_CREDIT' AND tsl_src_doc_id = ${atcId}::uuid
       ORDER BY tsl_seq_no`;

  const credit = async () => {
    const [row] = await p.tempCredits(bill.sbId);
    return row;
  };

  const receipt = async (
    amount: number,
    allocation: { amount: number; writeoff?: number },
    label: string,
  ): Promise<{ voucherId: string; refno: string }> => {
    const created = explain(
      `receipt ${label} create`,
      await post('receipts/create', {
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherDate: today(),
        avhPartyId: balance.abl_party_id,
        avhRemarks: `E2E-TCH-${tag} ${label}`,
        avhUserId: ACTOR,
        tenders: [
          {
            tdRowNo: 1,
            tdTenderId: TENDER.CASH,
            tdTenderTypeId: CASH_TENDER_TYPE,
            tdAmount: amount,
            tdReceivedAmt: amount,
            tdChangeAmt: 0,
          },
        ],
      }),
      201,
    );
    const voucherId = created.body.data.header.avhVoucherId as string;
    receipts.push(voucherId);
    const posted = explain(
      `receipt ${label} post`,
      await post('receipts/post', {
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [
          {
            billId: balance.abl_id,
            billAccYear: ACC_YEAR,
            amount: allocation.amount,
            ...(allocation.writeoff
              ? { writeoff: allocation.writeoff, writeoffApprovedBy: ACTOR }
              : {}),
          },
        ],
        onAccount: 0,
      }),
      201,
    );
    expect(posted.status).toBe(201);
    const refno = (posted.body.data.header?.avhVoucherRefno ??
      created.body.data.header?.avhVoucherRefno ??
      '') as string;
    return { voucherId, refno };
  };

  const cancelReceipt = async (voucherId: string, label: string) => {
    const res = explain(
      `receipt ${label} cancel`,
      await post('receipts/cancel', {
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        reason: `E2E-TCH-${tag} ${label} cancelled`,
      }),
      201,
    );
    expect(res.status).toBe(201);
  };

  beforeAll(async () => {
    h = await bootApp(`e2e-tch-${tag}`);
    p = probes(h.prisma);
    rights = await grantSalesRights(h.prisma);
    receiptRights = await grantMenuRights(h.prisma, [RECEIPT_MENU]);
    item = await makeItem(h.prisma, `E2E-TCH-${tag}`);
    await postOpeningStock(h, item, 20, 20, `E2E-TCH-${tag} opening`);
  }, 180_000);

  afterAll(async () => {
    if (h?.prisma) {
      if (receiptRights) {
        await restoreMenuRights(h.prisma, receiptRights);
      }
      if (rights) {
        await revokeSalesRights(h.prisma, rights);
      }
    }
    await shutdown(h);
  }, 60_000);

  it('the post writes CREATED (→ OPEN) and an insert audit row keyed by the credit', async () => {
    const created = explain(
      'create',
      await post(
        'bills/create',
        billBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          lines: [{ item, qty: 10, rate: 100 }],
          tenders: [
            { tenderId: TENDER.CASH, amount: 680 },
            {
              tenderId: TENDER.TEMP_CR,
              amount: 500,
              tempCredit: { name: 'Ravi (e2e)', mobile: MOBILE, days: 10, place: 'Peelamedu' },
            },
          ],
          usrRefno: `E2E-TCH-${tag}`,
        }),
      ),
      201,
    );
    const posted = explain('post', await post('bills/post', billKeys(created.body.data.sbId)), 201);
    bill = posted.body.data;
    const tc = await credit();
    atcId = tc.atc_id;
    expect(tc.atc_status).toBe('OPEN');
    const [row] = await p.balanceRows('SALE_BILL', bill.sbId);
    balance = { abl_id: String(row.abl_id), abl_party_id: String(row.abl_party_id) };

    const steps = await trail();
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      tsl_event: 'CREATED',
      tsl_from_status: null,
      tsl_to_status: 'OPEN',
    });
    expect(steps[0].tsl_remarks).toContain('credit 500.00 to Ravi (e2e)');
    expect(steps[0].tsl_remarks).toContain('10 days');
    expect(steps[0].tsl_src_doc_refno).toBe(bill.sbBillRefno);

    const audit = await h.prisma.$queryRaw<
      { log_action: string; log_entity_id: string | null; log_notes: string | null }[]
    >`
      SELECT log_action::text AS log_action, log_entity_id, log_notes
        FROM audit.audit_log
       WHERE log_table_name = 'acc_temp_credit' AND log_pk = ${atcId}
       ORDER BY log_date`;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ log_action: 'insert', log_entity_id: atcId });
    expect(audit[0].log_notes).toContain(bill.sbBillRefno);
  });

  it('a receipt of 200 → PARTIAL, with the amount, the balance and the receipt refno', async () => {
    const { refno } = await receipt(200, { amount: 200 }, 'first');
    expect((await credit()).atc_status).toBe('PARTIAL');
    const steps = await trail();
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({
      tsl_event: 'PARTIAL',
      tsl_from_status: 'OPEN',
      tsl_to_status: 'PARTIAL',
    });
    expect(steps[1].tsl_remarks).toContain('received 200.00');
    expect(steps[1].tsl_remarks).toContain('balance 300.00');
    if (refno) {
      expect(steps[1].tsl_remarks).toContain(refno);
    }
  });

  it('a receipt of 300 → SETTLED; cancelling it → REOPENED back to PARTIAL', async () => {
    const { voucherId } = await receipt(300, { amount: 300 }, 'second');
    expect((await credit()).atc_status).toBe('SETTLED');
    let steps = await trail();
    expect(steps).toHaveLength(3);
    expect(steps[2]).toMatchObject({
      tsl_event: 'SETTLED',
      tsl_from_status: 'PARTIAL',
      tsl_to_status: 'SETTLED',
    });
    expect(steps[2].tsl_remarks).toContain('balance 0.00');

    await cancelReceipt(voucherId, 'second');
    const tc = await credit();
    expect(tc.atc_status).toBe('PARTIAL');
    expect(num(tc.atc_balance_amount)).toBe(300);
    steps = await trail();
    expect(steps).toHaveLength(4);
    expect(steps[3]).toMatchObject({
      tsl_event: 'REOPENED',
      tsl_from_status: 'SETTLED',
      tsl_to_status: 'PARTIAL',
    });
    expect(steps[3].tsl_remarks).toContain('reversed 300.00');
    expect(steps[3].tsl_remarks).toContain('balance 300.00');
  });

  it('100 received + 200 written off → WRITTEN_OFF (derived); cancelling it reopens', async () => {
    const { voucherId } = await receipt(100, { amount: 100, writeoff: 200 }, 'writeoff');
    const tc = await credit();
    expect(tc.atc_status).toBe('WRITTEN_OFF');
    expect(num(tc.atc_balance_amount)).toBe(0);
    let steps = await trail();
    expect(steps).toHaveLength(5);
    expect(steps[4]).toMatchObject({
      tsl_event: 'WRITTEN_OFF',
      tsl_from_status: 'PARTIAL',
      tsl_to_status: 'WRITTEN_OFF',
    });
    expect(steps[4].tsl_remarks).toContain('written off 300.00');

    await cancelReceipt(voucherId, 'writeoff');
    expect((await credit()).atc_status).toBe('PARTIAL');
    steps = await trail();
    expect(steps).toHaveLength(6);
    expect(steps[5]).toMatchObject({
      tsl_event: 'REOPENED',
      tsl_from_status: 'WRITTEN_OFF',
      tsl_to_status: 'PARTIAL',
    });
  });

  it('cancelling the first receipt moves PARTIAL → OPEN as REOPENED', async () => {
    await cancelReceipt(receipts[0], 'first');
    const tc = await credit();
    expect(tc.atc_status).toBe('OPEN');
    expect(num(tc.atc_balance_amount)).toBe(500);
    const steps = await trail();
    expect(steps).toHaveLength(7);
    expect(steps[6]).toMatchObject({
      tsl_event: 'REOPENED',
      tsl_from_status: 'PARTIAL',
      tsl_to_status: 'OPEN',
    });
    expect(steps[6].tsl_remarks).toContain('reversed 200.00');
    expect(steps[6].tsl_remarks).toContain('balance 500.00');
    // The bill itself stays: /bills/cancel refuses a bill that ever had an
    // allocation (SALES_ALLOCATION_LOCKS_BILL), reversed or not. The CANCELLED
    // step is covered by bill-tender-http.e2e-spec.ts, whose bill has none.
  });
});
