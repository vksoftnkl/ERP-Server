import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  ACTOR,
  BEARER,
  COMPANY,
  bankTender,
  bootApp,
  chequeTender,
  createAndPost,
  data,
  expectStatus,
  draftBody,
  isoDate,
  keys,
  loadMasters,
  PaymentFixtures,
  prisma,
  ROUTES,
  today,
  type Masters,
  PAYMENT_MENU,
} from './helpers/payment-e2e';

/**
 * Plan "Payment (menu 100)" rev 2 §7 — the POST half, money going OUT:
 *
 *   · one bill by NEFT (and the bank charge on it);
 *   · discount by slab;
 *   · a debit we hold applied;
 *   · on account → an ADVANCE (DR) bill, spent later, and the cancel that
 *     is refused while it is spent;
 *   · cancel reverses the payment; a SETTLED transfer refuses it;
 *   · delete refuses a POSTED payment.
 *
 * Every party and bill is the suite's own, with the ledger opening that keeps
 * `accounts.reconcile_on_post` satisfied; `afterAll` removes all of it.
 */

jest.setTimeout(240_000);

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU]);
  masters = await loadMasters();
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

const cancel = (voucherId: string, reason = 'E2E payment — tidy up') =>
  api()
    .post(ROUTES.cancel)
    .set('Authorization', BEARER)
    .send({ ...keys(voucherId), reason });

describe('POST /payments/post — one bill by NEFT (e2e, live DB, writes)', () => {
  it('posts DR party / CR bank, closes the bill, numbers the voucher and files the trail', async () => {
    const partyId = await fixtures.createParty('NEFT');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 10_000)], { avhRemarks: 'E2E NEFT' }),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    const payload = data<{
      header: { avhVoucherStatus: string; avhVoucherRefno: string | null; avhDocAmount: number };
      numberedVouchers: Array<{ isPdcVoucher: boolean }>;
      billsAfter: Array<{ billId: string; pendingAmount: number }>;
      totalOnAccount: number;
      cheques: unknown[];
      allocations: Array<{ adjType: string; drCr: string; amount: number; abjId: string | null }>;
      chequesIssued: unknown[];
    }>(posted);

    expect(payload.header.avhVoucherStatus).toBe('POSTED');
    expect(payload.header.avhVoucherRefno).toMatch(/^pmt/i);
    expect(payload.header.avhDocAmount).toBeCloseTo(10_000, 2);
    expect(payload.numberedVouchers).toHaveLength(1);
    expect(payload.numberedVouchers[0].isPdcVoucher).toBe(false);
    expect(payload.billsAfter).toEqual([
      expect.objectContaining({ billId: bill.billId, pendingAmount: 0 }),
    ]);
    expect(payload.totalOnAccount).toBe(0);
    expect(payload.cheques).toEqual([]);
    expect(payload.chequesIssued).toEqual([]);
    expect(payload.allocations).toEqual([
      expect.objectContaining({ adjType: 'ALLOCATION', drCr: 'DR', amount: 10_000 }),
    ]);
    expect(payload.allocations[0].abjId).not.toBeNull();

    // DR party 10,000 / CR bank 10,000 — the mirror of the receipt's legs.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs).toHaveLength(2);
    expect(legs.find((leg) => leg.drCr === 'DR')).toMatchObject({
      ledgerId: partyId,
      amount: 10_000,
      role: null,
    });
    expect(legs.find((leg) => leg.drCr === 'CR')).toMatchObject({
      ledgerId: masters.bankLedgerId,
      amount: 10_000,
    });

    // The bill: a DR settlement row, and the cache closed.
    const adjustments = await fixtures.adjustmentsOf(voucherId);
    expect(adjustments).toEqual([
      expect.objectContaining({
        billId: bill.billId,
        adjType: 'ALLOCATION',
        drCr: 'DR',
        amount: 10_000,
        mode: 'MIXED',
      }),
    ]);
    const billRow = await fixtures.billRow(bill.billId);
    expect(Number(billRow.ablPendingAmount)).toBe(0);
    expect(billRow.ablStatus).toBe('CLOSED');

    // The tender row now names its voucher; the trail says POSTED under PAYMENT.
    const tender = await prisma.accTenderDetail.findFirstOrThrow({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      select: { tdVoucherId: true, tdDrCr: true },
    });
    expect(tender.tdVoucherId).toBe(voucherId);
    expect(tender.tdDrCr).toBe('CR');
    const trail = await prisma.txnStatusLog.findMany({
      where: { tslSrcDocId: voucherId, tslSrcDocType: 'PAYMENT' },
      select: { tslEvent: true, tslToStatus: true },
    });
    expect(trail.map((row) => row.tslEvent)).toEqual(expect.arrayContaining(['CREATED', 'POSTED']));

    // The party's ledger and its bills still agree — the books check passed.
    const [reconcile] = await prisma.$queryRawUnsafe<Array<{ diff: string }>>(
      `SELECT diff::text FROM accounts.fn_party_bill_reconcile($1::uuid, $2::uuid, $3::char(9))`,
      COMPANY,
      partyId,
      ACC_YEAR,
    );
    expect(Number(reconcile.diff)).toBe(0);

    // A second post of the same voucher is a 409, not a second payment.
    const again = await api()
      .post(ROUTES.post)
      .set('Authorization', BEARER)
      .send({
        ...keys(voucherId),
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      });
    expectStatus(again, 409);

    // Delete refuses a POSTED payment and names cancel.
    const del = await api().post(ROUTES.delete).set('Authorization', BEARER).send(keys(voucherId));
    expectStatus(del, 409);
  });

  it("credits the bank GROSS of its charge and debits BANK_CHARGES for the bank's cut", async () => {
    const partyId = await fixtures.createParty('CHARGE');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 5_000);

    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      // tdAmount is what leaves our bank: the supplier's 5,000 and the bank's 12.50.
      draftBody(partyId, [bankTender(masters, 5_012.5, { tdMdrAmt: 12.5 })]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 5_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // The draft seeded the BANK_CHARGES line the client did not send.
    const seeded = data<{
      otherLines: Array<{ role: string | null; drCr: string; amount: number }>;
    }>(draft).otherLines;
    expect(seeded).toEqual([
      expect.objectContaining({ role: 'BANK_CHARGES', drCr: 'DR', amount: 12.5 }),
    ]);

    // CR bank 5,012.50 / DR party 5,000 / DR Bank Charges 12.50.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs.find((leg) => leg.drCr === 'CR')).toMatchObject({
      ledgerId: masters.bankLedgerId,
      amount: 5_012.5,
    });
    expect(legs.find((leg) => leg.role === 'BANK_CHARGES')).toMatchObject({
      drCr: 'DR',
      ledgerId: masters.ledgerByRole('BANK_CHARGES'),
      amount: 12.5,
    });
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 5_000,
    });
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);

    // A client line that disagrees with the tender is refused on the draft.
    const disagree = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 100, { tdMdrAmt: 5 })], {
          otherLines: [{ role: 'BANK_CHARGES', drCr: 'DR', amount: 7 }],
        }),
      );
    expectStatus(disagree, 400);
  });

  it("refuses an allocation that disagrees with the server's own figures, to the paisa", async () => {
    const partyId = await fixtures.createParty('IDENTITY');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 1_000);

    const { posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 1_000)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 999.99 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 400);
    expect(JSON.stringify(posted.body)).toContain('Paid 1000.00');
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(1_000);
  });

  it('settles more than a bill has pending as a 409 naming the bill', async () => {
    const partyId = await fixtures.createParty('OVER');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 1_000);

    const { posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 1_500)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 1_500 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 409);
    expect(JSON.stringify(posted.body)).toContain(bill.docRefno);
  });
});

describe("the supplier's prompt-payment terms (R16 mirrored, notes 62 A4) — DISCOUNT_RECEIVED", () => {
  let slabRowId: string | null = null;

  beforeAll(async () => {
    // The CUSTOMER slab — 5% within 30 days — for the length of this block,
    // to prove a payment does not read it: that is the discount WE give.
    const row = await prisma.appSettingValue.create({
      data: {
        asvSettingKey: 'accounts.ppd_slabs',
        asvScope: 'COMPANY',
        asvCompanyId: COMPANY,
        asvValue: JSON.stringify([{ days: 30, perc: 5 }]),
        asvRemarks: 'E2E payment slab — removed by the suite',
        asvCreatedBy: ACTOR,
      },
      select: { asvId: true },
    });
    slabRowId = row.asvId;
  });

  afterAll(async () => {
    if (slabRowId) {
      await prisma.appSettingValue.delete({ where: { asvId: slabRowId } });
    }
  });

  const suggested = async (partyId: string, billId: string): Promise<number | undefined> => {
    const open = await api()
      .get(ROUTES.openItems)
      .query({ partyId, companyId: COMPANY, onDate: today() })
      .set('Authorization', BEARER);
    expectStatus(open, 200);
    return data<{ bills: Array<{ billId: string; ppdSuggested: number }> }>(open).bills.find(
      (b) => b.billId === billId,
    )?.ppdSuggested;
  };

  it('offers nothing to a party with no supplier terms, whatever accounts.ppd_slabs says', async () => {
    const partyId = await fixtures.createParty('NOTERMS');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000, { docDate: today() });
    expect(await suggested(partyId, bill.billId)).toBe(0);
  });

  it("offers nothing once the supplier's window has closed", async () => {
    const partyId = await fixtures.createParty('LATE');
    await fixtures.createSupplierTerms(partyId, 30, 2);
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000, {
      docDate: isoDate(-40),
    });
    expect(await suggested(partyId, bill.billId)).toBe(0);
  });

  it("suggests the supplier's cash discount on /open-items and posts the discount the operator left as CR income", async () => {
    const partyId = await fixtures.createParty('SLAB');
    // 2% within 30 days — the supplier's own terms, not the 5% customer slab.
    await fixtures.createSupplierTerms(partyId, 30, 2);
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000, { docDate: today() });

    const open = await api()
      .get(ROUTES.openItems)
      .query({ partyId, companyId: COMPANY, onDate: today() })
      .set('Authorization', BEARER);
    expectStatus(open, 200);
    const items = data<{
      bills: Array<{
        billId: string;
        ppdSuggested: number;
        pendingAmount: number;
        billType: string;
      }>;
      credits: unknown[];
      party: {
        ledId: string;
        isMoneyLedger: boolean;
        isTdsApplicable: boolean;
        favouringName: string;
      };
      summary: { totalPending: number; billCount: number; creditsHeld: number };
    }>(open);
    const row = items.bills.find((b) => b.billId === bill.billId);
    expect(row).toBeDefined();
    expect(row!.billType).toBe('OPENING');
    expect(row!.pendingAmount).toBe(10_000);
    expect(row!.ppdSuggested).toBeCloseTo(200, 2);
    expect(items.party.isMoneyLedger).toBe(false);
    expect(items.party.isTdsApplicable).toBe(false);
    expect(items.party.favouringName.length).toBeGreaterThan(0);
    expect(items.summary.totalPending).toBe(10_000);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 9_800)]),
      {
        allocations: [
          { billId: bill.billId, billAccYear: bill.billAccYear, amount: 9_800, discount: 200 },
        ],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // DR party 10,000 / CR bank 9,800 / CR Discount Received 200.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 10_000,
    });
    expect(legs.find((leg) => leg.role === 'DISCOUNT_RECEIVED')).toMatchObject({
      drCr: 'CR',
      ledgerId: masters.ledgerByRole('DISCOUNT_RECEIVED'),
      amount: 200,
    });
    const adjustments = await fixtures.adjustmentsOf(voucherId);
    expect(adjustments.map((a) => [a.adjType, a.amount, a.drCr])).toEqual(
      expect.arrayContaining([
        ['ALLOCATION', 9_800, 'DR'],
        ['DISCOUNT', 200, 'DR'],
      ]),
    );
    const billRow = await fixtures.billRow(bill.billId);
    expect(Number(billRow.ablPendingAmount)).toBe(0);
    expect(Number(billRow.ablDiscAmount)).toBe(200);
  });
});

describe('a debit we hold, applied (R4, mirrored)', () => {
  it('spends an OPENING debit against the bill as a pair, with no leg for it', async () => {
    const partyId = await fixtures.createParty('DEBIT');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 5_000);
    const held = await fixtures.createOpeningBill(partyId, 'DR', 1_000);

    const open = await api()
      .get(ROUTES.openItems)
      .query({ partyId, companyId: COMPANY })
      .set('Authorization', BEARER);
    expectStatus(open, 200);
    const items = data<{
      credits: Array<{ billId: string; drCr: string; adjType: string; pendingAmount: number }>;
      summary: { creditsHeld: number };
    }>(open);
    expect(items.credits).toEqual([
      expect.objectContaining({
        billId: held.billId,
        drCr: 'DR',
        adjType: 'ADVANCE_ADJUST',
        pendingAmount: 1_000,
      }),
    ]);
    expect(items.summary.creditsHeld).toBe(1_000);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 4_000)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 5_000 }],
        creditsApplied: [{ billId: held.billId, billAccYear: held.billAccYear, amount: 1_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // The party leg is the MONEY: 4,000. The debit moves only in the sub-ledger.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs).toHaveLength(2);
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 4_000,
    });

    const pair = (await fixtures.adjustmentsOf(voucherId)).filter((a) => a.againstBillId !== null);
    expect(pair).toHaveLength(2);
    expect(pair.find((a) => a.billId === bill.billId)).toMatchObject({
      drCr: 'DR',
      amount: 1_000,
      adjType: 'ADVANCE_ADJUST',
    });
    expect(pair.find((a) => a.billId === held.billId)).toMatchObject({ drCr: 'CR', amount: 1_000 });

    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
    expect(Number((await fixtures.billRow(held.billId)).ablPendingAmount)).toBe(0);

    const payload = data<{
      creditsApplied: Array<{ billId: string; againstBillId: string | null }>;
    }>(posted);
    expect(payload.creditsApplied.map((row) => row.billId).sort()).toEqual(
      [bill.billId, held.billId].sort(),
    );
  });
});

describe('on account → an ADVANCE (DR) bill, spent later (R7, mirrored)', () => {
  it('holds the remainder as an ADVANCE we can spend on the next bill, and guards the cancel', async () => {
    const partyId = await fixtures.createParty('ONACCOUNT');
    const first = await fixtures.createOpeningBill(partyId, 'CR', 10_000);

    const paid = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 12_000)]),
      {
        allocations: [{ billId: first.billId, billAccYear: first.billAccYear, amount: 10_000 }],
        onAccount: 2_000,
      },
    );
    expectStatus(paid.posted, 201);
    const advanceBills = data<{
      advanceBills: Array<{ billId: string; billAmount: number; pendingAmount: number }>;
      totalOnAccount: number;
    }>(paid.posted);
    expect(advanceBills.totalOnAccount).toBe(2_000);
    expect(advanceBills.advanceBills).toHaveLength(1);
    const advance = advanceBills.advanceBills[0];
    expect(advance.billAmount).toBe(2_000);
    expect(advance.pendingAmount).toBe(2_000);

    const advanceRow = await fixtures.billRow(advance.billId);
    expect(advanceRow.ablBillType).toBe('ADVANCE');
    expect(advanceRow.ablDrCr).toBe('DR');
    expect(advanceRow.ablSrcDocType).toBe('PAYMENT_ADVANCE');
    expect(advanceRow.ablVoucherId).toBe(paid.voucherId);
    // The whole 12,000 is on the party leg; the advance is a sub-ledger row.
    expect(
      (await fixtures.legsOf(paid.voucherId)).find((leg) => leg.ledgerId === partyId),
    ).toMatchObject({ drCr: 'DR', amount: 12_000 });

    // It is offered on the next payment...
    const open = await api()
      .get(ROUTES.openItems)
      .query({ partyId, companyId: COMPANY })
      .set('Authorization', BEARER);
    expect(
      data<{ credits: Array<{ billId: string }> }>(open).credits.map((c) => c.billId),
    ).toContain(advance.billId);

    // ...and spent by it.
    const second = await fixtures.createOpeningBill(partyId, 'CR', 5_000);
    const spent = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 3_000)]),
      {
        allocations: [{ billId: second.billId, billAccYear: second.billAccYear, amount: 5_000 }],
        creditsApplied: [{ billId: advance.billId, billAccYear: ACC_YEAR, amount: 2_000 }],
        onAccount: 0,
      },
    );
    expectStatus(spent.posted, 201);
    expect(Number((await fixtures.billRow(advance.billId)).ablPendingAmount)).toBe(0);
    expect(Number((await fixtures.billRow(second.billId)).ablPendingAmount)).toBe(0);

    // The first payment cannot be cancelled while its advance is spent.
    const refused = await cancel(paid.voucherId, 'E2E — must be refused');
    expectStatus(refused, 409);
    expect(JSON.stringify(refused.body)).toContain('already been used');

    // Unwind in order: the second, then the first.
    const secondCancelled = await cancel(spent.voucherId);
    expectStatus(secondCancelled, 201);
    expect(Number((await fixtures.billRow(advance.billId)).ablPendingAmount)).toBe(2_000);
    expect(Number((await fixtures.billRow(second.billId)).ablPendingAmount)).toBe(5_000);

    const firstCancelled = await cancel(paid.voucherId);
    expectStatus(firstCancelled, 201);
    const result = data<{
      toStatus: string;
      reversals: Array<{ ofVoucherId: string; reversalVoucherId: string; legCount: number }>;
      billsReopened: Array<{ billId: string; pendingAmount: number }>;
      advanceBillsRemoved: string[];
      tdsReversed: number;
    }>(firstCancelled);
    expect(result.toStatus).toBe('CANCELLED');
    expect(result.reversals).toHaveLength(1);
    expect(result.reversals[0].ofVoucherId).toBe(paid.voucherId);
    expect(result.advanceBillsRemoved).toEqual([advance.billId]);
    expect(result.tdsReversed).toBe(0);
    expect(Number((await fixtures.billRow(first.billId)).ablPendingAmount)).toBe(10_000);
    expect((await fixtures.billRow(advance.billId)).ablIsDeleted).toBe(true);

    // The reversal mirrors the legs and keeps the original's number.
    const header = await fixtures.headerRow(paid.voucherId);
    expect(header.avhVoucherStatus).toBe('CANCELLED');
    expect(header.avhReversalVoucherId).toBe(result.reversals[0].reversalVoucherId);
    const reversalLegs = await fixtures.legsOf(result.reversals[0].reversalVoucherId);
    expect(reversalLegs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'CR',
      amount: 12_000,
    });

    const [reconcile] = await prisma.$queryRawUnsafe<Array<{ diff: string }>>(
      `SELECT diff::text FROM accounts.fn_party_bill_reconcile($1::uuid, $2::uuid, $3::char(9))`,
      COMPANY,
      partyId,
      ACC_YEAR,
    );
    expect(Number(reconcile.diff)).toBe(0);
  });
});

describe('cancel refusals the receipt does not have', () => {
  it('refuses to cancel a payment whose transfer the bank has SETTLED', async () => {
    const partyId = await fixtures.createParty('SETTLED');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 2_000);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 2_000)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 2_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    await prisma.accTenderDetail.updateMany({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      data: { tdSettleStatus: 'SETTLED', tdSettledOn: new Date() },
    });

    const refused = await cancel(voucherId, 'E2E — must be refused');
    expectStatus(refused, 409);
    expect(JSON.stringify(refused.body)).toContain('SETTLED');
    expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('POSTED');
  });
});

describe('a balance written back keeps its approver (notes 62 E1)', () => {
  it('writes the approver onto the bill row the line settles', async () => {
    const partyId = await fixtures.createParty('WRITEBACK');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 5_000);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 4_900)], {
        otherLines: [{ role: 'BALANCES_WRITTEN_BACK', drCr: 'CR', amount: 100, approvedBy: ACTOR }],
      }),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 5_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // The draft line that held the approver is cleared at post; the bill row keeps it.
    const approvers = await fixtures.approversOf(voucherId);
    expect(approvers).toEqual([
      expect.objectContaining({ abjBillId: bill.billId, abjApprovedBy: ACTOR }),
    ]);
    expect(Number(approvers[0].abjAmount)).toBe(100);
  });
});

describe('rounding a payment UP (notes 62 E2)', () => {
  it('expenses the paise paid over a bill to Round Off instead of parking them as an advance', async () => {
    const partyId = await fixtures.createParty('ROUNDUP');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 4_999.6);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 5_000)], {
        otherLines: [{ role: 'ROUND_OFF', drCr: 'DR', amount: 0.4 }],
      }),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 4_999.6 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // DR party 4,999.60 + DR Round Off 0.40 = CR bank 5,000.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs).toHaveLength(3);
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 4_999.6,
    });
    expect(legs.find((leg) => leg.role === 'ROUND_OFF')).toMatchObject({
      drCr: 'DR',
      ledgerId: masters.ledgerByRole('ROUND_OFF'),
      amount: 0.4,
    });
    expect(legs.find((leg) => leg.ledgerId === masters.bankLedgerId)).toMatchObject({
      drCr: 'CR',
      amount: 5_000,
    });
    expect(data<{ advanceBills: unknown[] }>(posted).advanceBills).toEqual([]);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });

  it('still refuses a CR ROUND_OFF line — rounding DOWN rides on allocations[].roundoff', async () => {
    const partyId = await fixtures.createParty('ROUNDDOWN');
    const refused = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [bankTender(masters, 5_000)], {
          otherLines: [{ role: 'ROUND_OFF', drCr: 'CR', amount: 0.4 }],
        }),
      );
    expectStatus(refused, 400);
    expect(JSON.stringify(refused.body)).toContain('allocations[].discount');
  });
});

describe('the worked example (§7) — NEFT + post-dated cheque + TDS + discount + a debit note', () => {
  it('posts all of it in one payment, balanced, with the cheque on a voucher of its own', async () => {
    const partyId = await fixtures.createParty('WORKED', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFW1234A' },
    });
    const first = await fixtures.createOpeningBill(partyId, 'CR', 10_000);
    const second = await fixtures.createOpeningBill(partyId, 'CR', 20_000);
    const note = await fixtures.createOpeningBill(partyId, 'DR', 1_000);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
    const chequeDate = isoDate(10);

    // 29,800 is settled: the first bill 9,800 + 200 discount, the second 20,000.
    // The 1,000 debit note pays part of it, leaving 28,800 gross to the
    // supplier; 2% of that (576) is withheld, so 28,224 is paid — 18,224 by
    // NEFT today and 10,000 by a cheque dated ten days out.
    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [
        bankTender(masters, 18_224),
        chequeTender(masters, 10_000, book.chequeBookId, {
          tdRowNo: 2,
          tdInstrumentDate: chequeDate,
        }),
      ]),
      {
        allocations: [
          { billId: first.billId, billAccYear: first.billAccYear, amount: 9_800, discount: 200 },
          { billId: second.billId, billAccYear: second.billAccYear, amount: 20_000 },
        ],
        creditsApplied: [{ billId: note.billId, billAccYear: note.billAccYear, amount: 1_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    expect(
      data<{ otherLines: Array<{ role: string | null; amount: number }> }>(draft).otherLines,
    ).toEqual([expect.objectContaining({ role: 'TDS_PAYABLE', amount: 576 })]);

    const payload = data<{
      numberedVouchers: Array<{ voucherId: string; voucherDate: string; isPdcVoucher: boolean }>;
      billsAfter: Array<{ billId: string; pendingAmount: number; postDatedHeld: number }>;
    }>(posted);
    const pdc = payload.numberedVouchers.find((voucher) => voucher.isPdcVoucher);
    expect(pdc).toBeDefined();
    fixtures.vouchers.push(pdc!.voucherId);
    expect(pdc!.voucherDate).toBe(chequeDate);

    // The payment: DR party 19,000 = CR bank 18,224 + CR TDS 576 + CR discount
    // 200. The note moves only in the sub-ledger, so it has no leg.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs).toHaveLength(4);
    expect(legs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 19_000,
    });
    expect(legs.find((leg) => leg.ledgerId === masters.bankLedgerId)).toMatchObject({
      drCr: 'CR',
      amount: 18_224,
    });
    expect(legs.find((leg) => leg.role === 'TDS_PAYABLE')).toMatchObject({
      drCr: 'CR',
      amount: 576,
    });
    expect(legs.find((leg) => leg.role === 'DISCOUNT_RECEIVED')).toMatchObject({
      drCr: 'CR',
      amount: 200,
    });

    // The cheque: DR party 10,000 / CR bank 10,000, on its own voucher.
    const pdcLegs = await fixtures.legsOf(pdc!.voucherId);
    expect(pdcLegs.find((leg) => leg.ledgerId === partyId)).toMatchObject({
      drCr: 'DR',
      amount: 10_000,
    });
    expect(pdcLegs.find((leg) => leg.ledgerId === masters.bankLedgerId)).toMatchObject({
      drCr: 'CR',
      amount: 10_000,
    });

    // The first bill is closed; the second waits on the cheque; the note is spent.
    expect(payload.billsAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ billId: first.billId, pendingAmount: 0 }),
        expect.objectContaining({
          billId: second.billId,
          pendingAmount: 10_000,
          postDatedHeld: 10_000,
        }),
        expect.objectContaining({ billId: note.billId, pendingAmount: 0 }),
      ]),
    );

    // 26Q: one row, on the gross.
    const tds = await prisma.$queryRawUnsafe<Array<{ base: string; tax: string; section: string }>>(
      `SELECT atd_base_amount::text AS base, atd_tax_amount::text AS tax, atd_section AS section
         FROM accounts.acc_tds_register
        WHERE atd_voucher_id = $1::uuid AND atd_is_deleted = false`,
      voucherId,
    );
    expect(tds).toHaveLength(1);
    expect(Number(tds[0].base)).toBe(28_800);
    expect(Number(tds[0].tax)).toBe(576);
    expect(tds[0].section).toBe('194C');
  });
});
