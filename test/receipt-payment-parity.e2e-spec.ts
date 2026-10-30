import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  ACTOR,
  BEARER,
  BRANCH,
  bankTender,
  CASH_TENDER_TYPE,
  CHEQUE_TENDER_TYPE,
  COMPANY,
  bootApp,
  data,
  draftBody as paymentDraftBody,
  expectStatus,
  isoDate,
  keys,
  loadMasters,
  PAYMENT_MENU,
  PaymentFixtures,
  prisma,
  RECEIPT_MENU,
  ROUTES as PAYMENT_ROUTES,
  stamp,
  today,
  type Masters,
} from './helpers/payment-e2e';
import { TESTER1 } from './helpers/menu-rights';

/**
 * Also notes (62): A2 — each module refuses the other's voucher (a 404, and
 * never a draft of one turned into the other); D2 — menu 99's rights.
 *
 * notes (61) — the three `/receipts` defects the payment module had already
 * fixed on its side, each driven end to end through the real HTTP surface:
 *
 *   1 · `/receipts/post` refused every post-dated cheque with a 422
 *       ACC_PARTY_OUT_OF_BALANCE. The shared books guard counts the cheque's
 *       voucher today but the bill's post-dated row only on maturity. The
 *       cancel used the same guard, so it refused a party that held an
 *       un-matured cheque from ANOTHER receipt.
 *   2 · `/receipts/adjacent` compared the `avh_voucher_date` DATE with a
 *       timestamptz. On an Asia/Kolkata box, same-day receipts were skipped or
 *       misordered and a one-day window matched nothing.
 *   3 · `/receipts/amend` answered with the header read before the revision
 *       bump. A client that sent it back as `baseRevision` got a 409.
 *
 * Built on the payment harness (test/helpers/payment-e2e.ts): the same stubbed
 * auth, the same own-party-and-opening-row fixtures, the same teardown by
 * party. The one difference is the party, which is a Sundry Debtors
 * customer, and its bills, which are DR receivables.
 *
 * Live dev database, writes, `--runInBand`. `accounts.reconcile_on_post` is ON
 * for the dev company, which is what makes defect 1 reachable.
 */

jest.setTimeout(240_000);

const ROUTES = {
  create: '/api/v1/receipts/create',
  post: '/api/v1/receipts/post',
  cancel: '/api/v1/receipts/cancel',
  amend: '/api/v1/receipts/amend',
  adjacent: '/api/v1/receipts/adjacent',
} as const;

/** The shared chart's Sundry Debtors group (prisma/seed/Account_Groups.sql pins the id). */
const SUNDRY_DEBTORS_GROUP = '019eee86-f34b-7ddc-91e2-efca49e5e8e8';

class ReceiptFixtures extends PaymentFixtures {
  /** A customer-shaped party ledger: Sundry Debtors, company owned, bill-by-bill. */
  async createDebtor(tag: string): Promise<string> {
    const ledger = await prisma.accLedgerMaster.create({
      data: {
        ledCompanyId: COMPANY,
        ledGroupId: SUNDRY_DEBTORS_GROUP,
        ledName: `E2E-RCT-${tag}-${stamp()}`,
        ledLedgerType: 'PARTY',
        ledIsBillByBill: true,
        ledIsActive: true,
        ledCreatedBy: ACTOR,
      },
      select: { ledId: true },
    });
    this.parties.push(ledger.ledId);
    return ledger.ledId;
  }
}

let app: INestApplication;
let masters: Masters;
const fixtures = new ReceiptFixtures();

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  await fixtures.grantRights([RECEIPT_MENU, PAYMENT_MENU]);
  masters = await loadMasters();
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════
//  Request builders
// ═══════════════════════════════════════════════════════════════════════════

const cashTender = (amount: number) => ({
  tdRowNo: 1,
  tdTenderId: masters.cashTenderId,
  tdTenderTypeId: CASH_TENDER_TYPE,
  ...(masters.cashLedgerId ? { tdTenderLedgerId: masters.cashLedgerId } : {}),
  tdAmount: amount,
  // ck_td_cash_change: received − change must equal tdAmount.
  tdReceivedAmt: amount,
  tdChangeAmt: 0,
});

/** A customer's cheque, dated `instrumentDate`. Later than today makes it post-dated. */
const chequeTender = (amount: number, instrumentDate: string) => ({
  tdRowNo: 1,
  tdTenderId: masters.chequeTenderId,
  tdTenderTypeId: CHEQUE_TENDER_TYPE,
  tdAmount: amount,
  tdRefNo: `E61${stamp()}`,
  tdInstrumentDate: instrumentDate,
  tdBankName: 'Karur Vysya Bank',
  cheque: { bankLedgerId: masters.bankLedgerId },
});

const draftBody = (
  partyId: string,
  tenders: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
) => ({
  avhCompanyId: COMPANY,
  avhBranchId: BRANCH,
  avhAccYear: ACC_YEAR,
  avhVoucherDate: today(),
  avhPartyId: partyId,
  avhRemarks: 'E2E notes (61)',
  avhUserId: ACTOR,
  tenders,
  ...extra,
});

const allocation = (bill: { billId: string; billAccYear: string }, amount: number) => ({
  billId: bill.billId,
  billAccYear: bill.billAccYear,
  amount,
});

async function createDraft(body: Record<string, unknown>): Promise<string> {
  const draft = await api().post(ROUTES.create).set('Authorization', BEARER).send(body);
  expectStatus(draft, 201);
  const voucherId = data<{ header: { avhVoucherId: string } }>(draft).header.avhVoucherId;
  fixtures.vouchers.push(voucherId);
  return voucherId;
}

/** `/create` then `/post`, the ordinary way. The post's response is returned unchecked. */
async function createAndPost(
  body: Record<string, unknown>,
  post: Record<string, unknown>,
): Promise<{ voucherId: string; posted: request.Response }> {
  const voucherId = await createDraft(body);
  const posted = await api()
    .post(ROUTES.post)
    .set('Authorization', BEARER)
    .send({ ...keys(voucherId), ...post });
  return { voucherId, posted };
}

const cancel = (voucherId: string, reason: string) =>
  api()
    .post(ROUTES.cancel)
    .set('Authorization', BEARER)
    .send({ ...keys(voucherId), reason });

/** The party's ledger less its open bills — what the books check compares. */
async function reconcileDiff(partyId: string): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ diff: string }>>(
    `SELECT diff::text AS diff
       FROM accounts.fn_party_bill_reconcile($1::uuid, $2::uuid, $3::char(9))`,
    COMPANY,
    partyId,
    ACC_YEAR,
  );
  return Number(row?.diff ?? 0);
}

interface PostPayload {
  numberedVouchers: Array<{ voucherId: string; voucherDate: string; isPdcVoucher: boolean }>;
  billsAfter: Array<{ billId: string; pendingAmount: number; postDatedHeld: number }>;
}

/** A receipt settling `amount` of a new DR bill with a cheque dated ten days out. */
async function postPostDatedReceipt(partyId: string, amount: number) {
  const bill = await fixtures.createOpeningBill(partyId, 'DR', amount);
  const chequeDate = isoDate(10);
  const { voucherId, posted } = await createAndPost(
    draftBody(partyId, [chequeTender(amount, chequeDate)]),
    { allocations: [allocation(bill, amount)], onAccount: 0 },
  );
  expectStatus(posted, 201);
  const payload = data<PostPayload>(posted);
  const pdc = payload.numberedVouchers.find((voucher) => voucher.isPdcVoucher);
  if (pdc) {
    fixtures.vouchers.push(pdc.voucherId);
  }
  return { voucherId, bill, chequeDate, payload, pdc };
}

// ═══════════════════════════════════════════════════════════════════════════
//  1 · the books check and a post-dated cheque
// ═══════════════════════════════════════════════════════════════════════════

describe('notes (61) §1 — a post-dated cheque and the books check', () => {
  it('posts a receipt carrying a post-dated cheque: 201, not 422 ACC_PARTY_OUT_OF_BALANCE', async () => {
    const partyId = await fixtures.createDebtor('PDC-POST');
    const { payload, pdc, bill, chequeDate } = await postPostDatedReceipt(partyId, 6_000);

    expect(pdc).toBeDefined();
    expect(pdc!.voucherDate).toBe(chequeDate);
    // The bill is still owed until the cheque matures, and says why.
    expect(payload.billsAfter).toEqual([
      expect.objectContaining({ billId: bill.billId, pendingAmount: 6_000, postDatedHeld: 6_000 }),
    ]);
    expect((await fixtures.headerRow(pdc!.voucherId)).avhVoucherStatus).toBe('POSTED');

    // The difference the shared guard refused: the ledger already carries the
    // cheque, the bill does not until it matures.
    expect(Math.abs(await reconcileDiff(partyId))).toBeCloseTo(6_000, 2);
  });

  it('cancels that receipt cleanly, reversing the cheque voucher with it', async () => {
    const partyId = await fixtures.createDebtor('PDC-CANCEL');
    const { voucherId, pdc, bill } = await postPostDatedReceipt(partyId, 4_500);
    expect(pdc).toBeDefined();

    const cancelled = await cancel(voucherId, 'E2E notes 61 — post-dated cheque returned unbanked');
    expectStatus(cancelled, 201);
    const result = data<{ toStatus: string; reversals: Array<{ reversalVoucherId: string }> }>(
      cancelled,
    );
    expect(result.toStatus).toBe('CANCELLED');
    result.reversals.forEach((row) => fixtures.vouchers.push(row.reversalVoucherId));

    expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('CANCELLED');
    expect((await fixtures.headerRow(pdc!.voucherId)).avhVoucherStatus).toBe('CANCELLED');
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(4_500);
    // Both sides net to zero again.
    expect(await reconcileDiff(partyId)).toBeCloseTo(0, 2);
  });

  it('cancels another receipt while the party still holds an un-matured post-dated cheque', async () => {
    // The shape the shared guard got wrong on cancel: THIS receipt nets to
    // zero, but the party is already off by the other receipt's cheque.
    const partyId = await fixtures.createDebtor('PDC-OTHER');
    await postPostDatedReceipt(partyId, 3_000);

    const cashBill = await fixtures.createOpeningBill(partyId, 'DR', 1_200);
    const { voucherId, posted } = await createAndPost(draftBody(partyId, [cashTender(1_200)]), {
      allocations: [allocation(cashBill, 1_200)],
      onAccount: 0,
    });
    expectStatus(posted, 201);
    expect(Number((await fixtures.billRow(cashBill.billId)).ablPendingAmount)).toBe(0);

    const cancelled = await cancel(voucherId, 'E2E notes 61 — keyed against the wrong customer');
    expectStatus(cancelled, 201);
    data<{ reversals: Array<{ reversalVoucherId: string }> }>(cancelled).reversals.forEach((row) =>
      fixtures.vouchers.push(row.reversalVoucherId),
    );
    expect(Number((await fixtures.billRow(cashBill.billId)).ablPendingAmount)).toBe(1_200);
    // Still off by exactly the un-matured cheque, and by nothing else.
    expect(Math.abs(await reconcileDiff(partyId))).toBeCloseTo(3_000, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2 · /adjacent on a DATE column
// ═══════════════════════════════════════════════════════════════════════════

describe('notes (61) §2 — GET /receipts/adjacent walks same-day receipts', () => {
  let first: string;
  let second: string;

  const walk = async (
    voucherId: string,
    direction: 'prev' | 'next',
    range: { fromDate?: string; toDate?: string } = {},
  ): Promise<string | null> => {
    const res = await api()
      .get(ROUTES.adjacent)
      .query({
        voucherId,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        direction,
        status: 'DRAFT',
        ...range,
      })
      .set('Authorization', BEARER);
    expectStatus(res, 200);
    const payload = data<{ direction: string; voucher: { voucherId: string } | null }>(res);
    expect(payload.direction).toBe(direction);
    return payload.voucher?.voucherId ?? null;
  };

  beforeAll(async () => {
    // Two drafts keyed back to back, both dated today: the pair the old
    // comparison put on the wrong side of the receipt being walked from.
    const partyId = await fixtures.createDebtor('WALK');
    first = await createDraft(draftBody(partyId, [cashTender(110)]));
    second = await createDraft(draftBody(partyId, [cashTender(120)]));
  });

  it('steps between them in both directions', async () => {
    expect(await walk(second, 'prev')).toBe(first);
    expect(await walk(first, 'next')).toBe(second);
    // And the later one is never behind the earlier one.
    expect(await walk(first, 'prev')).not.toBe(second);
  });

  it('finds them inside a one-day fromDate / toDate window', async () => {
    const day = { fromDate: today(), toDate: today() };
    expect(await walk(second, 'prev', day)).toBe(first);
    expect(await walk(first, 'next', day)).toBe(second);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  3 · /amend answers the revision it just made
// ═══════════════════════════════════════════════════════════════════════════

describe('notes (61) §3 — POST /receipts/amend answers the new revision', () => {
  it('lets a second amend send back the first response’s avhRevisionNo', async () => {
    const [setting] = await prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
      `SELECT out_effective_value AS value
         FROM public.fn_app_settings_effective($1::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
        WHERE out_asd_key = 'accounts.allow_posted_amend'`,
      COMPANY,
    );
    if (setting?.value !== 'true') {
      // eslint-disable-next-line no-console
      console.warn(
        '[receipt parity e2e] accounts.allow_posted_amend is OFF for this company — the amend case cannot be reached.',
      );
      return;
    }

    const partyId = await fixtures.createDebtor('AMEND');
    const bill = await fixtures.createOpeningBill(partyId, 'DR', 2_000);
    const { voucherId, posted } = await createAndPost(draftBody(partyId, [cashTender(2_000)]), {
      allocations: [allocation(bill, 2_000)],
      onAccount: 0,
    });
    expectStatus(posted, 201);

    const amendBody = (baseRevision: number, remark: string) => ({
      ...draftBody(partyId, [cashTender(2_000)], { avhRemarks: remark }),
      avhVoucherId: voucherId,
      allocations: [allocation(bill, 2_000)],
      onAccount: 0,
      baseRevision,
      editRemark: remark,
    });

    const once = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(amendBody(0, 'E2E notes 61 — first amend'));
    expectStatus(once, 201);
    const first = data<{ header: { avhRevisionNo: number }; toRevision: number }>(once);
    expect(first.toRevision).toBe(1);
    expect(first.header.avhRevisionNo).toBe(1);

    // The client's ordinary next step: send back the revision it was given.
    const twice = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(amendBody(first.header.avhRevisionNo, 'E2E notes 61 — second amend'));
    expectStatus(twice, 201);
    const second = data<{ header: { avhRevisionNo: number }; toRevision: number }>(twice);
    expect(second.toRevision).toBe(2);
    expect(second.header.avhRevisionNo).toBe(2);
    expect((await fixtures.headerRow(voucherId)).avhRevisionNo).toBe(2);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  notes (62) A2 · a receipt is not a payment, and the other way round
// ═══════════════════════════════════════════════════════════════════════════

describe("notes (62) A2 — each module refuses the other's voucher", () => {
  it('answers 404 on every route handed the wrong type, and rewrites nothing', async () => {
    const debtor = await fixtures.createDebtor('A2');
    const receiptId = await createDraft(draftBody(debtor, [cashTender(150)]));
    const creditor = await fixtures.createParty('A2');
    const created = await api()
      .post(PAYMENT_ROUTES.create)
      .set('Authorization', BEARER)
      .send(paymentDraftBody(creditor, [bankTender(masters, 175)]));
    expectStatus(created, 201);
    const paymentId = data<{ header: { avhVoucherId: string } }>(created).header.avhVoucherId;
    fixtures.vouchers.push(paymentId);
    const receiptBefore = await fixtures.headerRow(receiptId);
    const paymentBefore = await fixtures.headerRow(paymentId);

    // Reads.
    const paymentsGet = await api()
      .get(PAYMENT_ROUTES.get)
      .query(keys(receiptId))
      .set('Authorization', BEARER);
    expectStatus(paymentsGet, 404);
    const receiptsGet = await api()
      .get('/api/v1/receipts/get')
      .query(keys(paymentId))
      .set('Authorization', BEARER);
    expectStatus(receiptsGet, 404);
    const walk = await api()
      .get(PAYMENT_ROUTES.adjacent)
      .query({
        voucherId: receiptId,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: ACC_YEAR,
        direction: 'prev',
      })
      .set('Authorization', BEARER);
    expectStatus(walk, 404);

    // Writes: a delete, and a save that would have re-typed the other's draft.
    expectStatus(
      await api().post(PAYMENT_ROUTES.delete).set('Authorization', BEARER).send(keys(receiptId)),
      404,
    );
    expectStatus(
      await api()
        .post(PAYMENT_ROUTES.create)
        .set('Authorization', BEARER)
        .send(paymentDraftBody(creditor, [bankTender(masters, 175)], { avhVoucherId: receiptId })),
      404,
    );
    expectStatus(
      await api()
        .post(ROUTES.create)
        .set('Authorization', BEARER)
        .send(draftBody(debtor, [cashTender(150)], { avhVoucherId: paymentId })),
      404,
    );

    const receiptAfter = await fixtures.headerRow(receiptId);
    const paymentAfter = await fixtures.headerRow(paymentId);
    expect(receiptAfter.avhVoucherTypeId).toBe(receiptBefore.avhVoucherTypeId);
    expect(receiptAfter.avhPartyId).toBe(debtor);
    expect(receiptAfter.avhIsDeleted).toBe(false);
    expect(paymentAfter.avhVoucherTypeId).toBe(paymentBefore.avhVoucherTypeId);
    expect(paymentAfter.avhPartyId).toBe(creditor);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  notes (62) D2 · menu 99 rights
// ═══════════════════════════════════════════════════════════════════════════

describe('notes (62) D2 — /receipts is judged on menu 99', () => {
  it('refuses a post without um_can_post, naming the column', async () => {
    const setPost = (value: boolean) =>
      prisma.$executeRawUnsafe(
        `UPDATE public.user_menus SET um_can_post = $3
          WHERE um_user_id = $1::uuid AND um_menu_id = $2::int AND um_is_deleted = false`,
        TESTER1,
        RECEIPT_MENU,
        value,
      );
    const partyId = await fixtures.createDebtor('RIGHTS');
    const bill = await fixtures.createOpeningBill(partyId, 'DR', 250);
    const voucherId = await createDraft(draftBody(partyId, [cashTender(250)]));

    await setPost(false);
    try {
      const refused = await api()
        .post(ROUTES.post)
        .set('Authorization', BEARER)
        .send({ ...keys(voucherId), allocations: [allocation(bill, 250)], onAccount: 0 });
      expectStatus(refused, 403);
      const body = JSON.stringify(refused.body);
      expect(body).toContain('RCT_RIGHT_POST');
      expect(body).toContain('um_can_post');
      expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('DRAFT');
    } finally {
      await setPost(true);
    }
  });
});
