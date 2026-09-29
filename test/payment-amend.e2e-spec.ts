import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACTOR,
  BEARER,
  BRANCH,
  COMPANY,
  bankTender,
  bootApp,
  CASH_TENDER_TYPE,
  chequeTender,
  createAndPost,
  data,
  dateOnly,
  expectStatus,
  draftBody,
  keys,
  loadMasters,
  PaymentFixtures,
  prisma,
  ROUTES,
  stamp,
  today,
  type Masters,
  ISSUED_CHEQUES_MENU,
  PAYMENT_MENU,
} from './helpers/payment-e2e';

/**
 * Plan "Payment (menu 100)" rev 2 §4 route 9 / §7 — R20 on a payment:
 * `/payments/amend` restates a POSTED payment whole, behind
 * `accounts.allow_posted_amend`, with `baseRevision` as the optimistic lock.
 *
 *   · setting ON: the payment keeps its id, number and refno; revision +1;
 *     the old money is unwound in place and the bill reads the same;
 *   · a stale baseRevision is a 409 naming the current revision;
 *   · the party is not amendable;
 *   · setting OFF: a 409 naming the key.
 *
 * `beforeAll` switches the setting ON for the company (notes 62 F8) —
 * creating the COMPANY row if there is none — and `afterAll` puts back
 * exactly what was there. A suite that returned early with a warning when
 * the setting was off could pass without testing anything. The OFF case flips
 * that row for the length of one request and puts it back in `finally`.
 *
 * notes (62) adds: an amend with a cheque (C1 — the old leaf stays on the
 * register as CANCELLED, a new leaf is taken), an amend with TDS (the old
 * deduction reversed), and the three refusals it shares with /cancel.
 *
 * notes (63) adds: the leaf an amend cancelled no longer blocks a later
 * /cancel or /amend of the same payment, while a leaf STOPPED on menu 52
 * still does. The Stop goes through the real `/issued-cheques/stop`, so the
 * suite grants menu 52 as well as menu 100.
 */

jest.setTimeout(240_000);

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();

const api = () => request(app.getHttpServer());

let settingMemo: { asvId: string; asvValue: string | null; created: boolean } | null = null;

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU, ISSUED_CHEQUES_MENU]);
  masters = await loadMasters();
  app = await bootApp();

  const row = await settingRow();
  if (row) {
    settingMemo = { asvId: row.asvId, asvValue: row.asvValue, created: false };
    if (row.asvValue !== 'true') {
      await prisma.appSettingValue.update({
        where: { asvId: row.asvId },
        data: { asvValue: 'true' },
      });
    }
  } else {
    const created = await prisma.appSettingValue.create({
      data: {
        asvSettingKey: 'accounts.allow_posted_amend',
        asvScope: 'COMPANY',
        asvCompanyId: COMPANY,
        asvValue: 'true',
        asvRemarks: 'E2E payment amend — removed by the suite',
        asvCreatedBy: ACTOR,
      },
      select: { asvId: true },
    });
    settingMemo = { asvId: created.asvId, asvValue: null, created: true };
  }
});

afterAll(async () => {
  if (settingMemo?.created) {
    await prisma.appSettingValue.delete({ where: { asvId: settingMemo.asvId } });
  } else if (settingMemo && settingMemo.asvValue !== 'true') {
    await prisma.appSettingValue.update({
      where: { asvId: settingMemo.asvId },
      data: { asvValue: settingMemo.asvValue ?? 'false' },
    });
  }
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

const amendBody = (
  voucherId: string,
  partyId: string,
  bill: { billId: string; billAccYear: string },
  amount: number,
  baseRevision: number,
  extra: Record<string, unknown> = {},
) => ({
  ...draftBody(partyId, [bankTender(masters, amount)], { avhRemarks: `E2E amend ${stamp()}` }),
  avhVoucherId: voucherId,
  allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount }],
  creditsApplied: [],
  otherLineBills: [],
  onAccount: 0,
  baseRevision,
  editRemark: 'E2E — UTR keyed wrong',
  ...extra,
});

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

async function settingRow() {
  return prisma.appSettingValue.findFirst({
    where: {
      asvSettingKey: 'accounts.allow_posted_amend',
      asvScope: 'COMPANY',
      asvCompanyId: COMPANY,
      asvIsDeleted: false,
    },
    select: { asvId: true, asvValue: true },
  });
}

describe('POST /payments/amend — R20 on a payment (e2e, live DB, writes)', () => {
  it('restates a posted payment in place, keeping its identity and moving the revision', async () => {
    expect((await settingRow())?.asvValue).toBe('true');

    const partyId = await fixtures.createParty('AMEND');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);
    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 10_000)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    const before = await fixtures.headerRow(voucherId);
    expect(before.avhRevisionNo).toBe(0);
    const oldTender = await prisma.accTenderDetail.findFirstOrThrow({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      select: { tdId: true, tdRefNo: true },
    });

    const amended = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(amendBody(voucherId, partyId, bill, 10_000, 0));
    expectStatus(amended, 201);
    const result = data<{
      header: {
        avhVoucherId: string;
        avhVoucherRefno: string | null;
        avhVoucherStatus: string;
        avhRevisionNo: number;
      };
      fromRevision: number;
      toRevision: number;
      editRemark: string;
      unwound: { adjustmentsReversed: number; legsRemoved: number; tdsReversed: number };
      tenders: Array<{ tdRefNo: string | null }>;
    }>(amended);

    expect(result.header.avhVoucherId).toBe(voucherId);
    expect(result.header.avhVoucherRefno).toBe(before.avhVoucherRefno);
    expect(result.header.avhVoucherStatus).toBe('POSTED');
    expect(result.header.avhRevisionNo).toBe(1);
    expect(result.fromRevision).toBe(0);
    expect(result.toRevision).toBe(1);
    // editRemark is an UpperMaxString, as on /receipts/amend.
    expect(result.editRemark).toBe('E2E — UTR KEYED WRONG');
    expect(result.unwound.adjustmentsReversed).toBe(1);
    expect(result.unwound.legsRemoved).toBe(2);
    expect(result.unwound.tdsReversed).toBe(0);
    // The UTR was re-keyed: a new tender row carries it.
    expect(result.tenders[0].tdRefNo).not.toBe(oldTender.tdRefNo);

    // No reversal voucher, no status change, and the bill still reads settled.
    const after = await fixtures.headerRow(voucherId);
    expect(after.avhVoucherStatus).toBe('POSTED');
    expect(after.avhReversalVoucherId).toBeNull();
    expect(after.avhVoucherNo).toEqual(before.avhVoucherNo);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);

    // The trail: the original row, its negative, and the replacement.
    const adjustments = await fixtures.adjustmentsOf(voucherId);
    expect(adjustments).toHaveLength(3);
    expect(adjustments.filter((a) => a.reversalOfId !== null)).toHaveLength(1);
    expect(adjustments.reduce((sum, a) => sum + a.amount, 0)).toBeCloseTo(10_000, 2);

    // Live legs are the new pair; the old pair is soft-deleted, not gone.
    expect(await fixtures.legsOf(voucherId)).toHaveLength(2);
    expect(
      await prisma.accVoucher.count({ where: { avVoucherId: voucherId, avIsDeleted: true } }),
    ).toBe(2);

    // POSTED → AMENDED → POSTED in the trail.
    const trail = await prisma.txnStatusLog.findMany({
      where: { tslSrcDocId: voucherId, tslSrcDocType: 'PAYMENT' },
      select: { tslEvent: true },
    });
    expect(trail.map((row) => row.tslEvent)).toEqual(expect.arrayContaining(['AMENDED', 'POSTED']));

    // A stale baseRevision is refused, naming what it now is.
    const stale = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(amendBody(voucherId, partyId, bill, 10_000, 0));
    expectStatus(stale, 409);
    expect(JSON.stringify(stale.body)).toContain('revision 1');
    expect((await fixtures.headerRow(voucherId)).avhRevisionNo).toBe(1);

    // The party is not amendable: cancel and re-enter is the way.
    const otherParty = await fixtures.createParty('AMEND-OTHER');
    const moved = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(amendBody(voucherId, otherParty, bill, 10_000, 1));
    expectStatus(moved, 409);
    expect(JSON.stringify(moved.body)).toContain('avhPartyId');

    // And only a POSTED payment is amended.
    const cancelled = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E amend — tidy up' });
    expectStatus(cancelled, 201);
    const history = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(amendBody(voucherId, partyId, bill, 10_000, 1));
    expectStatus(history, 409);
  });

  it('is a 409 naming the setting when accounts.allow_posted_amend is off', async () => {
    const setting = await settingRow();
    const partyId = await fixtures.createParty('AMEND-OFF');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 500);
    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 500)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 500 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // Switch the company OFF for one request only.
    let restore: (() => Promise<unknown>) | null = null;
    if (setting) {
      await prisma.appSettingValue.update({
        where: { asvId: setting.asvId },
        data: { asvValue: 'false' },
      });
      restore = () =>
        prisma.appSettingValue.update({
          where: { asvId: setting.asvId },
          data: { asvValue: setting.asvValue },
        });
    }
    try {
      const refused = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(amendBody(voucherId, partyId, bill, 500, 0));
      expectStatus(refused, 409);
      expect(JSON.stringify(refused.body)).toContain('accounts.allow_posted_amend');
    } finally {
      if (restore) {
        await restore();
      }
    }

    // Nothing moved.
    const header = await fixtures.headerRow(voucherId);
    expect(header.avhRevisionNo).toBe(0);
    expect(header.avhVoucherStatus).toBe('POSTED');
    expect(await fixtures.legsOf(voucherId)).toHaveLength(2);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });
  it('amends a payment made by cheque: the old leaf stays on the register CANCELLED, a new one is taken (notes 62 C1)', async () => {
    const partyId = await fixtures.createParty('AMEND-CHQ');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 3_000);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 3);
    const chequeBody = { cheque: { chequeBookId: book.chequeBookId, favouring: 'E2E PAYEE' } };

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [chequeTender(masters, 3_000, book.chequeBookId, chequeBody)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 3_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    const first = data<{ cheques: Array<{ apdId: string; leaf: string }> }>(posted).cheques[0];
    expect(Number(first.leaf)).toBe(book.leafFrom);

    // A3 on a posted payment: /get names the book on the cheque row.
    const got = await api().get(ROUTES.get).query(keys(voucherId)).set('Authorization', BEARER);
    expectStatus(got, 200);
    expect(
      data<{ tenders: Array<{ cheque: { chequeBookId: string; favouring: string } | null }> }>(got)
        .tenders[0].cheque,
    ).toMatchObject({ chequeBookId: book.chequeBookId, favouring: 'E2E PAYEE' });

    const amended = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(
        amendBody(voucherId, partyId, bill, 3_000, 0, {
          tenders: [chequeTender(masters, 3_000, book.chequeBookId, chequeBody)],
        }),
      );
    expectStatus(amended, 201);
    const result = data<{
      header: { avhRevisionNo: number };
      cheques: Array<{ apdId: string; leaf: string }>;
      unwound: { chequesRemoved: number };
    }>(amended);
    expect(result.header.avhRevisionNo).toBe(1);
    expect(result.unwound.chequesRemoved).toBe(1);
    expect(Number(result.cheques[0].leaf)).toBe(book.leafFrom + 1);

    // The old leaf is on the register still — CANCELLED, with why — not deleted.
    const old = await prisma.accPdcRegister.findFirstOrThrow({ where: { apdId: first.apdId } });
    expect(old.apdIsDeleted).toBe(false);
    expect(old.apdStatus).toBe('CANCELLED');
    expect(old.apdCancelReason).toBe('Amended into revision 1');
    const fresh = await prisma.accPdcRegister.findFirstOrThrow({
      where: { apdId: result.cheques[0].apdId },
    });
    expect(fresh.apdStatus).toBe('HELD');
    // Two leaves spent, none handed out twice.
    expect(Number((await fixtures.bookRow(book.chequeBookId)).acbNextLeaf)).toBe(book.leafFrom + 2);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });

  it('amends a payment with TDS: the old deduction is reversed and the new one registered (notes 62 F4)', async () => {
    const partyId = await fixtures.createParty('AMEND-TDS', {
      tds: { section: '194C', deducteeType: 'FIRM', pan: 'AAAFD1234A' },
    });
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 10_000);
    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 9_800)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 10_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    const amended = await api()
      .post(ROUTES.amend)
      .set('Authorization', BEARER)
      .send(
        amendBody(voucherId, partyId, bill, 10_000, 0, { tenders: [bankTender(masters, 9_800)] }),
      );
    expectStatus(amended, 201);
    expect(data<{ unwound: { tdsReversed: number } }>(amended).unwound.tdsReversed).toBe(1);

    // One live deduction is left un-reversed: the new post's.
    const live = await prisma.$queryRawUnsafe<Array<{ tax: string }>>(
      `SELECT t.atd_tax_amount::text AS tax
         FROM accounts.acc_tds_register t
        WHERE t.atd_voucher_id = $1::uuid AND t.atd_is_deleted = false
          AND t.atd_reversal_of_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                           WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`,
      voucherId,
    );
    expect(live.map((row) => Number(row.tax))).toEqual([200]);
  });

  describe('refusals it shares with /cancel (notes 62 F5)', () => {
    it('refuses once our cheque has been presented', async () => {
      const partyId = await fixtures.createParty('AMEND-PRESENTED');
      const bill = await fixtures.createOpeningBill(partyId, 'CR', 800);
      const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
      const { voucherId, posted } = await createAndPost(
        app,
        fixtures,
        draftBody(partyId, [chequeTender(masters, 800, book.chequeBookId)]),
        {
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 800 }],
          onAccount: 0,
        },
      );
      expectStatus(posted, 201);
      const cheque = data<{ cheques: Array<{ apdId: string; apdAccYear: string }> }>(posted)
        .cheques[0];
      await prisma.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
        // What /issued-cheques/presented writes (menu 52); ck_apd_cleared wants the dates.
        data: {
          apdStatus: 'CLEARED',
          apdDepositDate: dateOnly(today()),
          apdClearDate: dateOnly(today()),
          apdStatusOn: new Date(),
          apdPresentCount: { increment: 1 },
        },
      });

      const refused = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(
          amendBody(voucherId, partyId, bill, 800, 0, {
            tenders: [chequeTender(masters, 800, book.chequeBookId)],
          }),
        );
      expectStatus(refused, 409);
      expect(JSON.stringify(refused.body)).toContain('CLEARED');
      expect((await fixtures.headerRow(voucherId)).avhRevisionNo).toBe(0);
    });

    it('refuses once the advance it left has been spent', async () => {
      const partyId = await fixtures.createParty('AMEND-SPENT');
      const bill = await fixtures.createOpeningBill(partyId, 'CR', 1_000);
      const paid = await createAndPost(
        app,
        fixtures,
        draftBody(partyId, [bankTender(masters, 1_500)]),
        {
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 1_000 }],
          onAccount: 500,
        },
      );
      expectStatus(paid.posted, 201);
      const advance = data<{ advanceBills: Array<{ billId: string }> }>(paid.posted)
        .advanceBills[0];
      const next = await fixtures.createOpeningBill(partyId, 'CR', 700);
      const spent = await createAndPost(
        app,
        fixtures,
        draftBody(partyId, [bankTender(masters, 200)]),
        {
          allocations: [{ billId: next.billId, billAccYear: next.billAccYear, amount: 700 }],
          creditsApplied: [{ billId: advance.billId, billAccYear: bill.billAccYear, amount: 500 }],
          onAccount: 0,
        },
      );
      expectStatus(spent.posted, 201);

      const refused = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(
          amendBody(paid.voucherId, partyId, bill, 1_000, 0, {
            tenders: [bankTender(masters, 1_500)],
            onAccount: 500,
          }),
        );
      expectStatus(refused, 409);
      expect(JSON.stringify(refused.body)).toContain('already been used');
      expect((await fixtures.headerRow(paid.voucherId)).avhRevisionNo).toBe(0);
    });

    it('refuses once the bank has SETTLED the transfer', async () => {
      const partyId = await fixtures.createParty('AMEND-SETTLED');
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

      const refused = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(amendBody(voucherId, partyId, bill, 2_000, 0));
      expectStatus(refused, 409);
      expect(JSON.stringify(refused.body)).toContain('SETTLED');
      expect((await fixtures.headerRow(voucherId)).avhRevisionNo).toBe(0);
    });
  });

  describe('a leaf the amend cancelled is history, not an act on the cheque (notes 63)', () => {
    /** Posted by cheque, then amended to cash — pmt00398's path. */
    async function chequeAmendedToCash(tag: string, amount: number) {
      const partyId = await fixtures.createParty(tag);
      const bill = await fixtures.createOpeningBill(partyId, 'CR', amount);
      const book = await fixtures.createChequeBook(masters.bankLedgerId, 3);
      const { voucherId, posted } = await createAndPost(
        app,
        fixtures,
        draftBody(partyId, [chequeTender(masters, amount, book.chequeBookId)]),
        {
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount }],
          onAccount: 0,
        },
      );
      expectStatus(posted, 201);
      const leaf = data<{ cheques: Array<{ apdId: string }> }>(posted).cheques[0];

      const amended = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(amendBody(voucherId, partyId, bill, amount, 0, { tenders: [cashTender(amount)] }));
      expectStatus(amended, 201);
      expect(await leafRow(leaf.apdId)).toMatchObject({
        apdStatus: 'CANCELLED',
        apdIsDeleted: false,
        apdCancelReason: 'Amended into revision 1',
        apdAmendedIntoRevision: 1,
      });
      return { partyId, bill, book, voucherId, leafId: leaf.apdId };
    }

    const leafRow = (apdId: string) =>
      prisma.accPdcRegister.findFirstOrThrow({
        where: { apdId },
        select: {
          apdStatus: true,
          apdIsDeleted: true,
          apdCancelReason: true,
          apdAmendedIntoRevision: true,
        },
      });

    it('cancels a payment whose cheque an amend replaced by cash; the leaf keeps its amend reason', async () => {
      const { bill, voucherId, leafId } = await chequeAmendedToCash('AMEND-THEN-CANCEL', 70);

      const cancelled = await api()
        .post(ROUTES.cancel)
        .set('Authorization', BEARER)
        .send({ ...keys(voucherId), reason: 'E2E notes 63 — amended, then cancelled' });
      expectStatus(cancelled, 201);
      expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('CANCELLED');

      // The cancel leaves the amend's leaf exactly as the amend left it.
      expect(await leafRow(leafId)).toMatchObject({
        apdStatus: 'CANCELLED',
        apdIsDeleted: false,
        apdCancelReason: 'Amended into revision 1',
        apdAmendedIntoRevision: 1,
      });
      expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(70);
    });

    it('amends it a second time; the new leaf is a fresh one', async () => {
      const { partyId, bill, book, voucherId, leafId } = await chequeAmendedToCash(
        'AMEND-TWICE',
        90,
      );

      const again = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(
          amendBody(voucherId, partyId, bill, 90, 1, {
            tenders: [chequeTender(masters, 90, book.chequeBookId)],
          }),
        );
      expectStatus(again, 201);
      const result = data<{
        header: { avhRevisionNo: number };
        cheques: Array<{ apdId: string; leaf: string }>;
        unwound: { chequesRemoved: number };
      }>(again);
      expect(result.header.avhRevisionNo).toBe(2);
      // Revision 1 was cash: there was no HELD leaf for this amend to cancel.
      expect(result.unwound.chequesRemoved).toBe(0);
      expect(Number(result.cheques[0].leaf)).toBe(book.leafFrom + 1);
      expect(await leafRow(result.cheques[0].apdId)).toMatchObject({
        apdStatus: 'HELD',
        apdAmendedIntoRevision: null,
      });
      expect(await leafRow(leafId)).toMatchObject({
        apdStatus: 'CANCELLED',
        apdCancelReason: 'Amended into revision 1',
        apdAmendedIntoRevision: 1,
      });
      expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
    });

    it('still refuses once the leaf was STOPPED on menu 52', async () => {
      const partyId = await fixtures.createParty('AMEND-STOPPED');
      const bill = await fixtures.createOpeningBill(partyId, 'CR', 60);
      const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
      const { voucherId, posted } = await createAndPost(
        app,
        fixtures,
        draftBody(partyId, [chequeTender(masters, 60, book.chequeBookId)]),
        {
          allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 60 }],
          onAccount: 0,
        },
      );
      expectStatus(posted, 201);
      const cheque = data<{ cheques: Array<{ apdId: string; apdAccYear: string; leaf: string }> }>(
        posted,
      ).cheques[0];

      const stopped = await api()
        .post('/api/v1/issued-cheques/stop')
        .set('Authorization', BEARER)
        .send({
          apdId: cheque.apdId,
          apdAccYear: cheque.apdAccYear,
          companyId: COMPANY,
          branchId: BRANCH,
          date: today(),
          reason: 'E2E notes 63 — supplier asked for a transfer',
        });
      expectStatus(stopped, 200);
      const stop = data<{ status: string; reversalVoucherId: string | null }>(stopped);
      expect(stop.status).toBe('CANCELLED');
      expect(stop.reversalVoucherId).not.toBeNull();
      fixtures.vouchers.push(stop.reversalVoucherId as string);
      expect((await leafRow(cheque.apdId)).apdAmendedIntoRevision).toBeNull();

      const cancel = await api()
        .post(ROUTES.cancel)
        .set('Authorization', BEARER)
        .send({ ...keys(voucherId), reason: 'E2E notes 63 — must be refused' });
      expectStatus(cancel, 409);
      const body = JSON.stringify(cancel.body);
      expect(body).toContain(cheque.leaf);
      expect(body).toContain('CANCELLED');
      expect(body).toContain('52');

      const amend = await api()
        .post(ROUTES.amend)
        .set('Authorization', BEARER)
        .send(amendBody(voucherId, partyId, bill, 60, 0, { tenders: [cashTender(60)] }));
      expectStatus(amend, 409);
      expect(JSON.stringify(amend.body)).toContain('CANCELLED');

      const header = await fixtures.headerRow(voucherId);
      expect(header.avhVoucherStatus).toBe('POSTED');
      expect(header.avhRevisionNo).toBe(0);
    });
  });
});
