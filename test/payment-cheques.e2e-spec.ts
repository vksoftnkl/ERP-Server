import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  BEARER,
  bankTender,
  bootApp,
  chequeTender,
  createAndPost,
  dateOnly,
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
 * Plan "Payment (menu 100)" rev 2 §7 — the cheques WE issue (notes 55):
 *
 *   · a cheque row names a BOOK and no number; the leaf is taken at post,
 *     under the book's row lock, and lands on the tender row and the
 *     register (apd_tra_type P, HELD);
 *   · a finished book is a 409;
 *   · two concurrent posts on one book get different, consecutive leaves;
 *   · a post rolled back after the leaf was taken gives the leaf back;
 *   · a post-dated cheque gets its own voucher, dated the cheque;
 *   · cancel reverses the payment and CANCELS the register row, and is
 *     refused once the bank has acted on the cheque (menu 52 unwinds that);
 *   · notes (61): a payment carrying an un-matured post-dated cheque cancels
 *     cleanly, and so does ANOTHER payment of a party that still holds one —
 *     the books check allows exactly the un-matured difference.
 *
 * The books are the suite's own, on the BANK tender's ledger, and go with the
 * rest of the fixtures in `afterAll`.
 */

jest.setTimeout(240_000);

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();

const api = () => request(app.getHttpServer());
const pad = (leaf: number, width: number): string => String(leaf).padStart(width, '0');

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

interface PostCheque {
  tdRowNo: number;
  apdId: string;
  apdAccYear: string;
  leaf: string;
  bookNo: string;
}

interface IssuedCheque {
  pdcId: string;
  instrumentNo: string;
  status: string;
  chequeBookId: string | null;
  bookNo: string | null;
  favouring: string | null;
  acPayee: boolean;
  bankLedgerId: string | null;
  voucherId: string | null;
}

describe('cheques we issue (e2e, live DB, writes)', () => {
  it("takes the book's next leaf at post and registers the cheque as ours, HELD", async () => {
    const partyId = await fixtures.createParty('LEAF');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 7_500);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 3);

    const { voucherId, draft, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [
        chequeTender(masters, 7_500, book.chequeBookId, {
          cheque: {
            chequeBookId: book.chequeBookId,
            favouring: 'Sundaram Facility Services',
            acPayee: true,
          },
        }),
      ]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 7_500 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    // The draft promised no number: the leaf was not taken on /create.
    const drafted = data<{ tenders: Array<{ tdRefNo: string | null }> }>(draft);
    expect(drafted.tenders[0].tdRefNo).toBeNull();
    expect(Number((await fixtures.bookRow(book.chequeBookId)).acbNextLeaf)).toBe(book.leafFrom + 1);

    const payload = data<{
      cheques: PostCheque[];
      chequesIssued: IssuedCheque[];
      tenders: Array<{ tdRefNo: string | null }>;
    }>(posted);
    expect(payload.cheques).toEqual([
      expect.objectContaining({
        tdRowNo: 1,
        leaf: pad(book.leafFrom, book.width),
        bookNo: book.bookNo,
      }),
    ]);
    expect(payload.tenders[0].tdRefNo).toBe(pad(book.leafFrom, book.width));
    expect(payload.chequesIssued).toHaveLength(1);
    const issued = payload.chequesIssued[0];
    expect(issued).toMatchObject({
      pdcId: payload.cheques[0].apdId,
      instrumentNo: pad(book.leafFrom, book.width),
      status: 'HELD',
      chequeBookId: book.chequeBookId,
      bookNo: book.bookNo,
      favouring: 'Sundaram Facility Services',
      acPayee: true,
      bankLedgerId: masters.bankLedgerId,
      voucherId,
    });

    // The register row is OURS: apd_tra_type P, drawn on the book's bank.
    const register = await prisma.accPdcRegister.findFirstOrThrow({
      where: { apdId: issued.pdcId },
    });
    expect(register.apdTraType.trim()).toBe('P');
    expect(register.apdPartyId).toBe(partyId);
    expect(register.apdChequeBookId).toBe(book.chequeBookId);
    expect(register.apdBankLedgerId).toBe(masters.bankLedgerId);
    expect(register.apdStatus).toBe('HELD');
    expect(Number(register.apdAmount)).toBe(7_500);
    expect(register.apdTenderId).not.toBeNull();

    // CR the book's bank / DR the party — and the money never touched Cheques in Hand.
    const legs = await fixtures.legsOf(voucherId);
    expect(legs).toHaveLength(2);
    expect(legs.find((leg) => leg.drCr === 'CR')).toMatchObject({
      ledgerId: masters.bankLedgerId,
      amount: 7_500,
    });
    expect(legs.find((leg) => leg.drCr === 'DR')).toMatchObject({
      ledgerId: partyId,
      amount: 7_500,
    });
    expect((await fixtures.adjustmentsOf(voucherId))[0]).toMatchObject({
      mode: 'CHEQUE',
      drCr: 'DR',
      amount: 7_500,
    });
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);

    // The leaf files its own status step, under the issued register's doc type.
    const steps = await prisma.txnStatusLog.findMany({
      where: { tslSrcDocId: issued.pdcId, tslSrcDocType: 'CHEQUE_ISSUED' },
      select: { tslEvent: true, tslToStatus: true },
    });
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].tslToStatus).toBe('HELD');

    // /get reads the same strip.
    const read = await api().get(ROUTES.get).query(keys(voucherId)).set('Authorization', BEARER);
    expectStatus(read, 200);
    expect(data<{ chequesIssued: IssuedCheque[] }>(read).chequesIssued[0].instrumentNo).toBe(
      pad(book.leafFrom, book.width),
    );
  });

  it('refuses a cheque row that carries a number or names no book', async () => {
    const partyId = await fixtures.createParty('NOREF');
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);

    const numbered = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [chequeTender(masters, 100, book.chequeBookId, { tdRefNo: '123456' })]),
      );
    expectStatus(numbered, 400);
    expect(JSON.stringify(numbered.body)).toContain('tdRefNo');

    const bookless = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(
        draftBody(partyId, [
          { ...chequeTender(masters, 100, book.chequeBookId), cheque: undefined },
        ]),
      );
    expectStatus(bookless, 400);
    expect(JSON.stringify(bookless.body)).toContain('chequeBookId');

    // Nothing was taken from the book.
    expect(Number((await fixtures.bookRow(book.chequeBookId)).acbNextLeaf)).toBe(book.leafFrom);
  });

  it('answers a finished book with a 409 and takes nothing from it', async () => {
    const partyId = await fixtures.createParty('FINISHED');
    const first = await fixtures.createOpeningBill(partyId, 'CR', 100);
    const second = await fixtures.createOpeningBill(partyId, 'CR', 100);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 1);

    // Two drafts on the last leaf: a draft only LOOKS at the book.
    const a = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [chequeTender(masters, 100, book.chequeBookId)]),
      {
        allocations: [{ billId: first.billId, billAccYear: first.billAccYear, amount: 100 }],
        onAccount: 0,
      },
    );
    expectStatus(a.posted, 201);
    const row = await fixtures.bookRow(book.chequeBookId);
    expect(row.acbStatus).toBe('FINISHED');
    expect(Number(row.acbNextLeaf)).toBe(book.leafFrom + 1);

    // A new draft on a finished book is refused at once.
    const draft = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(draftBody(partyId, [chequeTender(masters, 100, book.chequeBookId)]));
    expectStatus(draft, 409);
    expect(JSON.stringify(draft.body)).toContain(book.bookNo);
    expect(Number((await fixtures.billRow(second.billId)).ablPendingAmount)).toBe(100);
  });

  it('gives two concurrent posts on one book different, consecutive leaves', async () => {
    const partyId = await fixtures.createParty('CONCURRENT');
    const amounts = [200, 300];
    const bills = await Promise.all(
      amounts.map((amount) => fixtures.createOpeningBill(partyId, 'CR', amount)),
    );
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 5);

    const drafts: string[] = [];
    for (const [index, amount] of amounts.entries()) {
      const res = await api()
        .post(ROUTES.create)
        .set('Authorization', BEARER)
        .send(draftBody(partyId, [chequeTender(masters, amount, book.chequeBookId)]));
      expectStatus(res, 201);
      const id = data<{ header: { avhVoucherId: string } }>(res).header.avhVoucherId;
      fixtures.vouchers.push(id);
      drafts[index] = id;
    }

    // Both posts in flight at once: the book's row lock hands the leaves out in turn.
    const posts = await Promise.all(
      drafts.map((voucherId, index) =>
        api()
          .post(ROUTES.post)
          .set('Authorization', BEARER)
          .send({
            ...keys(voucherId),
            allocations: [
              {
                billId: bills[index].billId,
                billAccYear: bills[index].billAccYear,
                amount: amounts[index],
              },
            ],
            onAccount: 0,
          }),
      ),
    );
    expect(posts.map((res) => res.status)).toEqual([201, 201]);

    const leaves = posts
      .map((res) => Number(data<{ cheques: PostCheque[] }>(res).cheques[0].leaf))
      .sort((left, right) => left - right);
    expect(leaves).toEqual([book.leafFrom, book.leafFrom + 1]);
    expect(Number((await fixtures.bookRow(book.chequeBookId)).acbNextLeaf)).toBe(book.leafFrom + 2);
  });

  it('gives the leaf back when the post is rolled back after taking it', async () => {
    const partyId = await fixtures.createParty('ROLLBACK');
    // No ledger opening: the party's bills and ledger disagree, so the trial
    // books check (accounts.reconcile_on_post, ON for this company) refuses
    // the post at its LAST step — after the leaf was taken inside the same
    // transaction.
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 400, { ledgerOpening: false });
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 3);

    const { posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [chequeTender(masters, 400, book.chequeBookId)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 400 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 422);
    expect(JSON.stringify(posted.body)).toContain('ACC_PARTY_OUT_OF_BALANCE');

    // The whole transaction went, the leaf with it.
    const row = await fixtures.bookRow(book.chequeBookId);
    expect(Number(row.acbNextLeaf)).toBe(book.leafFrom);
    expect(row.acbStatus).toBe('ACTIVE');
    expect(await prisma.accPdcRegister.count({ where: { apdPartyId: partyId } })).toBe(0);
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(400);
  });

  it('gives a post-dated cheque a voucher of its own, dated the cheque, and settles on maturity', async () => {
    const partyId = await fixtures.createParty('PDC');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 9_000);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
    const chequeDate = isoDate(10);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [
        chequeTender(masters, 9_000, book.chequeBookId, { tdInstrumentDate: chequeDate }),
      ]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 9_000 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    const payload = data<{
      numberedVouchers: Array<{
        voucherId: string;
        voucherDate: string;
        isPdcVoucher: boolean;
        docAmount: number;
      }>;
      pdcVouchers: Array<{ voucherId: string; voucherDate: string; status: string }>;
      billsAfter: Array<{ billId: string; pendingAmount: number; postDatedHeld: number }>;
      chequesIssued: IssuedCheque[];
      allocations: Array<{ isPostDated: boolean; matured: boolean; adjDate: string }>;
    }>(posted);

    const pdc = payload.numberedVouchers.find((v) => v.isPdcVoucher);
    expect(pdc).toBeDefined();
    expect(pdc!.voucherDate).toBe(chequeDate);
    expect(pdc!.docAmount).toBe(9_000);
    expect(payload.pdcVouchers).toEqual([
      expect.objectContaining({ voucherId: pdc!.voucherId, status: 'POSTED' }),
    ]);
    fixtures.vouchers.push(pdc!.voucherId);

    // The bill is still owed until the cheque matures — and the screen can see why.
    expect(payload.billsAfter).toEqual([
      expect.objectContaining({ billId: bill.billId, pendingAmount: 9_000, postDatedHeld: 9_000 }),
    ]);
    expect(payload.allocations[0]).toMatchObject({
      isPostDated: true,
      matured: false,
      adjDate: chequeDate,
    });
    expect(payload.chequesIssued[0]).toMatchObject({ status: 'HELD', voucherId: pdc!.voucherId });

    // The payment's own voucher carries no money today; the cheque's does.
    expect(await fixtures.legsOf(voucherId)).toEqual([]);
    const legs = await fixtures.legsOf(pdc!.voucherId);
    expect(legs.find((leg) => leg.drCr === 'DR')).toMatchObject({
      ledgerId: partyId,
      amount: 9_000,
    });
    const child = await fixtures.headerRow(pdc!.voucherId);
    expect(child.avhAgainstVoucherId).toBe(voucherId);
    expect(child.avhVoucherStatus).toBe('POSTED');
  });

  it('cancels the payment, CANCELS the register row and keeps the leaf spent', async () => {
    const partyId = await fixtures.createParty('CANCEL');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 1_200);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [chequeTender(masters, 1_200, book.chequeBookId)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 1_200 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    const apdId = data<{ cheques: PostCheque[] }>(posted).cheques[0].apdId;

    const cancelled = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E — cheque voided before it left' });
    expectStatus(cancelled, 201);
    const result = data<{ chequesCancelled: string[]; reversals: unknown[] }>(cancelled);
    expect(result.chequesCancelled).toEqual([apdId]);
    expect(result.reversals).toHaveLength(1);

    const register = await prisma.accPdcRegister.findFirstOrThrow({ where: { apdId } });
    expect(register.apdStatus).toBe('CANCELLED');
    expect(register.apdCancelReason).toContain('E2E');
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(1_200);
    // notes (55): a leaf once taken stays taken.
    expect(Number((await fixtures.bookRow(book.chequeBookId)).acbNextLeaf)).toBe(book.leafFrom + 1);
  });

  it('refuses to cancel once the bank has paid the cheque, naming the Issued Cheques screen', async () => {
    const partyId = await fixtures.createParty('PRESENTED');
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
    const cheque = data<{ cheques: PostCheque[] }>(posted).cheques[0];

    // The bank paid it. What /issued-cheques/presented writes (menu 52) — an
    // ISSUED cheque clears without a voucher (P11b), so the register row alone
    // says so. Written directly because tester1 holds no rights on menu 52 and
    // this suite is about the PAYMENT's guard, not the cheque screen's.
    const paidOn = dateOnly(today());
    await prisma.accPdcRegister.update({
      where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
      data: {
        apdStatus: 'CLEARED',
        apdDepositDate: paidOn,
        apdClearDate: paidOn,
        apdStatusOn: new Date(),
        apdPresentCount: { increment: 1 },
      },
    });

    const refused = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E — must be refused' });
    expectStatus(refused, 409);
    const body = JSON.stringify(refused.body);
    expect(body).toContain(cheque.leaf);
    expect(body).toContain('CLEARED');
    expect(body).toContain('52');
    expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('POSTED');
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(0);
  });

  it('cancels a payment carrying an un-matured post-dated cheque, reversing the cheque voucher', async () => {
    const partyId = await fixtures.createParty('PDC-CANCEL');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 2_600);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [
        chequeTender(masters, 2_600, book.chequeBookId, { tdInstrumentDate: isoDate(10) }),
      ]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 2_600 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    const payload = data<{
      numberedVouchers: Array<{ voucherId: string; isPdcVoucher: boolean }>;
      cheques: PostCheque[];
    }>(posted);
    const pdc = payload.numberedVouchers.find((v) => v.isPdcVoucher);
    expect(pdc).toBeDefined();
    fixtures.vouchers.push(pdc!.voucherId);

    const cancelled = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E notes 61 — post-dated cheque torn up' });
    expectStatus(cancelled, 201);
    expect(data<{ chequesCancelled: string[] }>(cancelled).chequesCancelled).toEqual([
      payload.cheques[0].apdId,
    ]);

    expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('CANCELLED');
    expect((await fixtures.headerRow(pdc!.voucherId)).avhVoucherStatus).toBe('CANCELLED');
    expect(Number((await fixtures.billRow(bill.billId)).ablPendingAmount)).toBe(2_600);
  });

  it('cancels another payment while the party still holds an un-matured post-dated cheque', async () => {
    // THIS payment nets to zero, but the party is already off by the other
    // payment's cheque: its voucher counts on the ledger today, its bill row
    // only on maturity. The shared guard refused this cancel for that.
    const partyId = await fixtures.createParty('PDC-OTHER');
    const chequeBill = await fixtures.createOpeningBill(partyId, 'CR', 3_100);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);
    const held = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [
        chequeTender(masters, 3_100, book.chequeBookId, { tdInstrumentDate: isoDate(10) }),
      ]),
      {
        allocations: [
          { billId: chequeBill.billId, billAccYear: chequeBill.billAccYear, amount: 3_100 },
        ],
        onAccount: 0,
      },
    );
    expectStatus(held.posted, 201);
    data<{ numberedVouchers: Array<{ voucherId: string; isPdcVoucher: boolean }> }>(
      held.posted,
    ).numberedVouchers.forEach((v) => fixtures.vouchers.push(v.voucherId));

    const bankBill = await fixtures.createOpeningBill(partyId, 'CR', 900);
    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [bankTender(masters, 900)]),
      {
        allocations: [{ billId: bankBill.billId, billAccYear: bankBill.billAccYear, amount: 900 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);

    const cancelled = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E notes 61 — paid the wrong supplier' });
    expectStatus(cancelled, 201);
    expect(Number((await fixtures.billRow(bankBill.billId)).ablPendingAmount)).toBe(900);
    // The post-dated payment is untouched.
    expect((await fixtures.headerRow(held.voucherId)).avhVoucherStatus).toBe('POSTED');
    expect(Number((await fixtures.billRow(chequeBill.billId)).ablPendingAmount)).toBe(3_100);
  });
  it('refuses to cancel once the bank has RETURNED our cheque unpaid (notes 62 F6)', async () => {
    const partyId = await fixtures.createParty('RETURNED');
    const bill = await fixtures.createOpeningBill(partyId, 'CR', 650);
    const book = await fixtures.createChequeBook(masters.bankLedgerId, 2);

    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(partyId, [chequeTender(masters, 650, book.chequeBookId)]),
      {
        allocations: [{ billId: bill.billId, billAccYear: bill.billAccYear, amount: 650 }],
        onAccount: 0,
      },
    );
    expectStatus(posted, 201);
    const cheque = data<{ cheques: PostCheque[] }>(posted).cheques[0];

    // What /issued-cheques/returned writes (menu 52): our cheque came back
    // unpaid, which the register records as BOUNCED. Written directly for the
    // reason the CLEARED case above gives.
    const on = dateOnly(today());
    await prisma.accPdcRegister.update({
      where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
      data: {
        apdStatus: 'BOUNCED',
        apdDepositDate: on,
        apdBounceDate: on,
        apdBounceReason: 'E2E — funds insufficient',
        apdStatusOn: new Date(),
        apdPresentCount: { increment: 1 },
      },
    });

    const refused = await api()
      .post(ROUTES.cancel)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'E2E — must be refused' });
    expectStatus(refused, 409);
    const body = JSON.stringify(refused.body);
    expect(body).toContain(cheque.leaf);
    expect(body).toContain('BOUNCED');
    expect(body).toContain('52');
    expect((await fixtures.headerRow(voucherId)).avhVoucherStatus).toBe('POSTED');
  });
});
