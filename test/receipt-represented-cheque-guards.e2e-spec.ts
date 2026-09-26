// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * Notes (38) and (39) — what a receipt owns once the cheques module has been
 * over its instrument, driven end to end over HTTP against the live dev
 * database.
 *
 * Two questions, one fixture, and the same wrong answer behind both: a link is
 * not ownership.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Both routes refuse when a cheque of the receipt has gone past HELD, and both
 * resolved "a cheque of the receipt" by `acc_pdc_register.apd_voucher_id`.
 * `/cheques/re-present` repoints that column at the re-issue voucher, so from
 * the moment a bounced cheque goes back to the bank the receipt looks
 * cheque-free — and an amend sailed through, reversing nothing:
 *
 *     rct00821 posted, cheque 500 -> bill A78561
 *     bounce / re-present / clear
 *     amend cheque -> cash                 201, and bill A78561 settled 1,000
 *
 * The customer handed over 500 and a thousand of debt was cleared. Measured on
 * live rct00819, then reproduced twice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NOTES (39) — A BOUNCE VOUCHER IS NOT PART OF THE RECEIPT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `avh_against_voucher_id` on a ChqBnc names the voucher the cheque was
 * carried by, which is the receipt. The receipt read that backwards — anything
 * pointing at me is one of my post-dated cheque vouchers — and so listed the
 * bounce under `pdcVouchers` and folded the bounce's reversal rows into its own
 * `allocations`, while `/amend` took the bounce apart: DRAFT, legs and header
 * soft-deleted, with its bill rows still counting. Three such bounce vouchers
 * were found on the dev box, each one against a receipt that had been amended
 * through the notes (38) hole.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THIS SUITE MUTATES, AND CLEANS UP AFTER ITSELF
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It creates its OWN opening bill so nothing pre-existing is settled, posts a
 * real receipt against it through the API, and drives the cheque round the full
 * bounce → re-present → clear loop. Neither route can tidy up afterwards — that
 * is the whole point of the fix — so `afterAll` deletes every row the suite
 * created, newest table first.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const CREATE = '/api/v1/receipts/create';
const POST = '/api/v1/receipts/post';
const AMEND = '/api/v1/receipts/amend';
const CANCEL = '/api/v1/receipts/cancel';
const BEARER = 'Bearer dummy-test-token';

// Real master rows on the dev database.
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
const ACC_YEAR = '2026-2027';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1 (SUPER ADMIN)
const PARTY = '01a0aa0b-31c3-7602-9209-8cf164d4b6c8';

const AMOUNT = 500;
/**
 * The bill is DOUBLE the cheque, deliberately: with room left on it the old
 * behaviour did not merely mis-post, it SUCCEEDED — the amend returned 201 and
 * the bill ended up settled 1,000 by a payment of 500. A bill sized exactly to
 * the cheque would have been rescued by the allocation engine and hidden the
 * defect behind a different error.
 */
const BILL_AMOUNT = AMOUNT * 2;
const CHEQUE_TENDER_TYPE = 5;

const prisma = new PrismaClient();

jest.setTimeout(240_000);

interface Masters {
  chequeTenderId: string;
  cashTenderId: string;
  cashTenderTypeId: number;
  cashTenderLedgerId: string | null;
  bankLedgerId: string;
}

/** Everything this suite wrote, for the teardown. */
const created = {
  vouchers: [] as string[],
  bills: [] as string[],
  cheques: [] as string[],
};

let app: INestApplication;
let masters: Masters;
let amendAllowed = false;

const api = () => request(app.getHttpServer());
const today = (): string => new Date().toISOString().slice(0, 10);
const data = <T>(res: request.Response): T => (res.body as { data: T }).data;

beforeAll(async () => {
  const chequeTender = await prisma.accTenderMaster.findFirstOrThrow({
    where: { tndTypeId: CHEQUE_TENDER_TYPE, tndCompanyId: COMPANY, tndIsDeleted: false },
    select: { tndId: true },
  });
  // The tender the amend switches TO: anything that is not a cheque, so the
  // amended receipt has no instrument of its own and the old one must be the
  // reason it is refused.
  const cashTender = await prisma.accTenderMaster.findFirstOrThrow({
    where: { tndTypeId: 1, tndIsDeleted: false, tndIsActive: true },
    select: { tndId: true, tndTypeId: true, tndLedgerId: true },
  });
  const bank = await prisma.accLedgerMaster.findFirstOrThrow({
    where: { ledLedgerType: 'BANK', ledIsDeleted: false, ledIsActive: true },
    select: { ledId: true },
  });

  masters = {
    chequeTenderId: chequeTender.tndId,
    cashTenderId: cashTender.tndId,
    cashTenderTypeId: cashTender.tndTypeId,
    cashTenderLedgerId: cashTender.tndLedgerId,
    bankLedgerId: bank.ledId,
  };

  // `/amend` is gated by a company setting. With it off every call is a 409
  // naming the key, which would make the amend case a false pass.
  const [setting] = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
    `SELECT COALESCE(v.asv_value, d.asd_default_value) AS value
       FROM public.app_setting_def d
       LEFT JOIN public.app_setting_value v
              ON v.asv_setting_key = d.asd_key AND v.asv_company_id = $1::uuid
      WHERE d.asd_key = 'accounts.allow_posted_amend'
      LIMIT 1`,
    COMPANY,
  );
  amendAllowed = setting?.value === 'true';

  const claims: AccessTokenPayload = {
    sub: ACTOR,
    user_name: 'tester1',
    sid: 'e2e-test-session',
    user_type: 'SUPER ADMIN',
    company_id: COMPANY,
    branch_id: BRANCH,
    device_id: null,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    typ: 'access',
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenService)
    .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
    .overrideProvider(AuthSessionService)
    .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
    .compile();

  app = moduleRef.createNestApplication();
  // Mirror src/main.ts so the route, validation and errors behave as live.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: process.env.API_VERSION ?? '1',
  });
  app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
  await app.init();

  if (!amendAllowed) {
    // eslint-disable-next-line no-console
    console.warn(
      '[represented-cheque e2e] accounts.allow_posted_amend is OFF for this company — the amend ' +
        'case cannot be reached.',
    );
  }
});

afterAll(async () => {
  await teardown();
  await app?.close();
  await prisma.$disconnect();
});

describe('A re-presented cheque still belongs to its receipt (e2e, live DB, writes)', () => {
  it('refuses to AMEND the receipt behind it, and settles nothing twice', async () => {
    if (!amendAllowed) {
      return;
    }
    const fixture = await postedReceiptWithARepresentedCheque('AMEND');

    // The precondition of the whole defect: the register row no longer names
    // the receipt. Anything resolving the receipt's cheques by that column sees
    // a receipt with no cheque on it.
    expect(fixture.chequeVoucherId).not.toBe(fixture.voucherId);

    const response = await api()
      .post(AMEND)
      .set('Authorization', BEARER)
      .send({
        ...draftBody(fixture.billId, 'E2E(38) — cheque swapped for cash'),
        tenders: [cashTender()],
        avhVoucherId: fixture.voucherId,
        allocations: [allocation(fixture.billId)],
        onAccount: 0,
        baseRevision: 0,
        editRemark: 'E2E(38) — must be refused',
      });

    // R20: the refusal list is identical for amend and cancel, and this is the
    // one that matters — the bank has acted on the instrument.
    expect(response.status).toBe(409);
    const body = JSON.stringify(response.body);
    expect(body).toContain(fixture.instrumentNo);
    expect(body).toContain('CLEARED');

    // The money did not move twice. 500 was handed over and 500 of debt is
    // settled — the measured failure was 1,000.
    const bill = await billRow(fixture.billId);
    expect(Number(bill.ablAllocAmount)).toBeCloseTo(AMOUNT, 2);
    expect(Number(bill.ablPendingAmount)).toBeCloseTo(BILL_AMOUNT - AMOUNT, 2);

    // And nothing at all was written: the receipt is untouched, still on its
    // first revision, and the cheque still belongs to the re-issue voucher.
    const header = await headerRow(fixture.voucherId);
    expect(header.avhVoucherStatus).toBe('POSTED');
    expect(header.avhRevisionNo).toBe(0);
    const cheque = await chequeRow(fixture.apdId);
    expect(cheque.apdIsDeleted).toBe(false);
    expect(cheque.apdStatus).toBe('CLEARED');

    // Notes (39): and the bounce voucher is exactly where the bounce left it.
    // The three DRAFT bounce vouchers on the dev box are what an amend that got
    // this far did to them.
    await expectBounceUntouched(fixture);
  });

  it('refuses to CANCEL the receipt behind it, leaving no cleared cheque orphaned', async () => {
    const fixture = await postedReceiptWithARepresentedCheque('CANCEL');
    expect(fixture.chequeVoucherId).not.toBe(fixture.voucherId);

    const response = await api().post(CANCEL).set('Authorization', BEARER).send({
      avhVoucherId: fixture.voucherId,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: ACC_YEAR,
      reason: 'E2E(38) — must be refused',
    });

    // The reported state was a CANCELLED receipt whose CLEARED cheque was still
    // settling a bill through the re-issue voucher: money in the bank against a
    // document that says it never happened.
    expect(response.status).toBe(409);
    const body = JSON.stringify(response.body);
    expect(body).toContain(fixture.instrumentNo);
    expect(body).toContain('CLEARED');

    const header = await headerRow(fixture.voucherId);
    expect(header.avhVoucherStatus).toBe('POSTED');
    const cheque = await chequeRow(fixture.apdId);
    expect(cheque.apdStatus).toBe('CLEARED');
    expect(cheque.apdIsDeleted).toBe(false);

    const bill = await billRow(fixture.billId);
    expect(Number(bill.ablAllocAmount)).toBeCloseTo(AMOUNT, 2);

    await expectBounceUntouched(fixture);
  });

  it('shows the cheque on the receipt it was taken in on, after the re-presentation', async () => {
    const fixture = await postedReceiptWithARepresentedCheque('GET');

    const response = await api()
      .get('/api/v1/receipts/get')
      .query({
        avhVoucherId: fixture.voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
      })
      .set('Authorization', BEARER);

    expect(response.status).toBe(200);
    const receipt = data<{
      cheques: Array<{ pdcId: string; instrumentNo: string; status: string; voucherId: string }>;
    }>(response);

    // The strip is read the same way the guards are, so a screen cannot show a
    // receipt as cheque-free while a guard refuses it over that very cheque.
    const strip = receipt.cheques.find((row) => row.pdcId === fixture.apdId);
    expect(strip).toBeDefined();
    expect(strip!.instrumentNo).toBe(fixture.instrumentNo);
    expect(strip!.status).toBe('CLEARED');
    // Honest about where it hangs NOW — the re-issue voucher, not the receipt.
    expect(strip!.voucherId).toBe(fixture.chequeVoucherId);
  });
});

describe('A bounce voucher belongs to the cheques module, not to the receipt (e2e)', () => {
  it('keeps the bounce POSTED with its totals stamped through a re-presentation', async () => {
    const fixture = await postedReceiptWithARepresentedCheque('POSTED-BOUNCE');

    // Notes (39) §3: a re-presentation is a fresh act forward, not an undo. The
    // re-issue voucher carries it and the bounce stands — POSTED, balanced, and
    // still the entry that re-debited the party and relieved Cheques in Hand.
    await expectBounceUntouched(fixture);
  });

  it('leaves the bounce off the receipt it was filed against', async () => {
    const fixture = await postedReceiptWithARepresentedCheque('NOT-MINE', 'BOUNCED');

    const response = await api()
      .get('/api/v1/receipts/get')
      .query({
        avhVoucherId: fixture.voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
      })
      .set('Authorization', BEARER);
    expect(response.status).toBe(200);

    const receipt = data<{
      pdcVouchers: Array<{ voucherId: string }>;
      allocations: Array<{ amount: number }>;
    }>(response);

    // This receipt has NO post-dated cheque — the instrument was dated today.
    // The bounce used to appear here because it names the receipt in
    // `avh_against_voucher_id`.
    expect(receipt.pdcVouchers).toHaveLength(0);

    // And its own settlement, not the bounce's reversal of it. The screen used
    // to paint a +500 and a −500 against a receipt that settled 500 once.
    expect(receipt.allocations).toHaveLength(1);
    expect(receipt.allocations[0].amount).toBeCloseTo(AMOUNT, 2);
  });
});

/** POSTED, balanced, legs alive, header alive — where the bounce left it. */
async function expectBounceUntouched(fixture: RepresentedFixture): Promise<void> {
  const bounce = await headerRow(fixture.bounceVoucherId);
  expect(bounce.avhVoucherStatus).toBe('POSTED');
  expect(bounce.avhIsDeleted).toBe(false);
  // The totals are stamped by `tr_av_refresh_totals` off the legs. 0.00/0.00 on
  // a voucher whose rows are still in `acc_vouchers` is the tell that something
  // soft-deleted the legs underneath it.
  expect(Number(bounce.avhTotalDebit)).toBeCloseTo(AMOUNT, 2);
  expect(Number(bounce.avhTotalCredit)).toBeCloseTo(AMOUNT, 2);

  const legs = await prisma.accVoucher.count({
    where: { avVoucherId: fixture.bounceVoucherId, avIsDeleted: false },
  });
  expect(legs).toBeGreaterThan(0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Fixtures
// ═══════════════════════════════════════════════════════════════════════════

interface RepresentedFixture {
  voucherId: string;
  billId: string;
  apdId: string;
  instrumentNo: string;
  bounceVoucherId: string;
  /** `apd_voucher_id` after the loop — the re-issue voucher, or the receipt. */
  chequeVoucherId: string;
}

const draftBody = (billId: string, remark: string) => ({
  avhCompanyId: COMPANY,
  avhBranchId: BRANCH,
  avhAccYear: ACC_YEAR,
  avhVoucherDate: today(),
  avhPartyId: PARTY,
  avhRemarks: remark,
  avhUserId: ACTOR,
  tenders: [chequeTender(instrumentNoFor(billId))],
});

const allocation = (billId: string) => ({
  billId,
  billAccYear: ACC_YEAR,
  amount: AMOUNT,
});

const instrumentNos = new Map<string, string>();
function instrumentNoFor(billId: string): string {
  return instrumentNos.get(billId)!;
}

const chequeTender = (instrumentNo: string) => ({
  tdRowNo: 1,
  tdTenderId: masters.chequeTenderId,
  tdTenderTypeId: CHEQUE_TENDER_TYPE,
  tdAmount: AMOUNT,
  tdRefNo: instrumentNo,
  // Dated today, so it is NOT post-dated and its register row hangs off the
  // receipt's own voucher — which is what makes the old resolution look right
  // until the re-presentation moves it.
  tdInstrumentDate: today(),
  tdBankName: 'Karur Vysya Bank',
  cheque: { bankLedgerId: masters.bankLedgerId },
});

const cashTender = () => ({
  tdRowNo: 1,
  tdTenderId: masters.cashTenderId,
  tdTenderTypeId: masters.cashTenderTypeId,
  ...(masters.cashTenderLedgerId ? { tdTenderLedgerId: masters.cashTenderLedgerId } : {}),
  tdAmount: AMOUNT,
  // ck_td_cash_change: received − change must equal tdAmount.
  tdReceivedAmt: AMOUNT,
  tdChangeAmt: 0,
});

/**
 * One bill, one receipt, one cheque — banked, bounced, re-presented and
 * cleared. The state the user's `rct00819` was in when the amend was allowed.
 */
async function postedReceiptWithARepresentedCheque(
  tag: string,
  /** BOUNCED stops at the bounce; REPRESENTED goes on to re-present and clear. */
  upTo: 'BOUNCED' | 'REPRESENTED' = 'REPRESENTED',
): Promise<RepresentedFixture> {
  const stamp = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const billId = await createOpeningBill(`E2E38-${tag}-${stamp}`);
  const instrumentNo = `E38${stamp}`;
  instrumentNos.set(billId, instrumentNo);

  // ── The receipt, posted the ordinary way ────────────────────────────────
  const draft = await api()
    .post(CREATE)
    .set('Authorization', BEARER)
    .send(draftBody(billId, `E2E(38) ${tag}`));
  expect(draft.status).toBe(201);
  const voucherId = data<{ header: { avhVoucherId: string } }>(draft).header.avhVoucherId;
  created.vouchers.push(voucherId);

  const posted = await api()
    .post(POST)
    .set('Authorization', BEARER)
    .send({
      avhVoucherId: voucherId,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: ACC_YEAR,
      allocations: [allocation(billId)],
      onAccount: 0,
    });
  expect(posted.status).toBe(201);

  const register = await prisma.accPdcRegister.findFirstOrThrow({
    where: { apdVoucherId: voucherId, apdIsDeleted: false },
    select: { apdId: true, apdAccYear: true },
  });
  created.cheques.push(register.apdId);
  const keys = {
    apdId: register.apdId,
    apdAccYear: register.apdAccYear,
    apdCompanyId: COMPANY,
    apdBranchId: BRANCH,
  };

  // ── Round the loop: bank it, have it returned, bank it again, clear it ──
  const deposit = await api()
    .post('/api/v1/cheques/deposit')
    .set('Authorization', BEARER)
    .send({
      cheques: [{ apdId: register.apdId, apdAccYear: register.apdAccYear }],
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      bankLedgerId: masters.bankLedgerId,
      depositDate: today(),
      slipNo: `E38-D-${stamp}`,
    });
  expect(deposit.status).toBe(201);

  const bounce = await api()
    .post('/api/v1/cheques/bounce')
    .set('Authorization', BEARER)
    .send({
      ...keys,
      bounceDate: today(),
      reason: 'Funds insufficient',
      bankCharge: 0,
      partyCharge: 0,
    });
  expect(bounce.status).toBe(201);
  const bounceVoucherId = data<{ voucher: { voucherId: string } }>(bounce).voucher.voucherId;
  created.vouchers.push(bounceVoucherId);

  if (upTo === 'BOUNCED') {
    return {
      voucherId,
      billId,
      apdId: register.apdId,
      instrumentNo,
      bounceVoucherId,
      chequeVoucherId: (await chequeRow(register.apdId)).apdVoucherId!,
    };
  }

  const represent = await api()
    .post('/api/v1/cheques/re-present')
    .set('Authorization', BEARER)
    .send({
      ...keys,
      bankLedgerId: masters.bankLedgerId,
      depositDate: today(),
      slipNo: `E38-R-${stamp}`,
    });
  expect(represent.status).toBe(201);
  created.vouchers.push(
    data<{ reissueVoucher: { voucherId: string } }>(represent).reissueVoucher.voucherId,
  );

  const clear = await api()
    .post('/api/v1/cheques/clear')
    .set('Authorization', BEARER)
    .send({ ...keys, clearDate: today() });
  expect(clear.status).toBe(201);
  const clearVoucher = data<{ voucher: { voucherId: string } | null }>(clear).voucher;
  if (clearVoucher) {
    created.vouchers.push(clearVoucher.voucherId);
  }

  const after = await chequeRow(register.apdId);
  expect(after.apdStatus).toBe('CLEARED');

  return {
    voucherId,
    billId,
    apdId: register.apdId,
    instrumentNo,
    bounceVoucherId,
    chequeVoucherId: after.apdVoucherId!,
  };
}

/**
 * An OPENING receivable of exactly the cheque's amount.
 *
 * OPENING because `ck_abl_voucher` exempts it from naming a voucher, which is
 * the one bill type this suite can raise before it has a document to hang it
 * off — and it is an ordinary receivable to everything downstream.
 */
async function createOpeningBill(refno: string): Promise<string> {
  const bill = await prisma.accBillBalance.create({
    data: {
      ablCompanyId: COMPANY,
      ablBranchId: BRANCH,
      ablAccYear: ACC_YEAR,
      ablPartyId: PARTY,
      ablBillType: 'OPENING',
      ablDocRefno: refno,
      ablDocDate: new Date(`${today()}T00:00:00Z`),
      ablDueDate: new Date(`${today()}T00:00:00Z`),
      ablDrCr: 'DR',
      ablBillAmount: BILL_AMOUNT,
      ablCreatedBy: ACTOR,
    },
    select: { ablId: true },
  });
  created.bills.push(bill.ablId);
  return bill.ablId;
}

const billRow = (billId: string) =>
  prisma.accBillBalance.findUniqueOrThrow({
    where: { ablId_ablAccYear: { ablId: billId, ablAccYear: ACC_YEAR } },
  });

const headerRow = (voucherId: string) =>
  prisma.accVoucherHeader.findUniqueOrThrow({
    where: { avhVoucherId_avhAccYear: { avhVoucherId: voucherId, avhAccYear: ACC_YEAR } },
  });

const chequeRow = (apdId: string) => prisma.accPdcRegister.findFirstOrThrow({ where: { apdId } });

/**
 * Newest table first, so no foreign key is left dangling. Neither `/amend` nor
 * `/cancel` can be used for this — refusing them is the behaviour under test.
 */
async function teardown(): Promise<void> {
  const { vouchers, bills, cheques } = created;

  await prisma.txnStatusLog.deleteMany({
    where: { tslSrcDocId: { in: [...cheques, ...vouchers] } },
  });
  await prisma.accBillAdjustment.deleteMany({
    where: {
      OR: [
        { abjChequeId: { in: cheques } },
        { abjVoucherId: { in: vouchers } },
        { abjBillId: { in: bills } },
      ],
    },
  });
  await prisma.accPdcRegister.deleteMany({ where: { apdId: { in: cheques } } });
  await prisma.accBillBalance.deleteMany({
    where: { OR: [{ ablId: { in: bills } }, { ablVoucherId: { in: vouchers } }] },
  });
  await prisma.accTenderDetail.deleteMany({ where: { tdSrcDocId: { in: vouchers } } });
  await prisma.accVoucher.deleteMany({ where: { avVoucherId: { in: vouchers } } });
  await prisma.accVoucherHeader.deleteMany({ where: { avhVoucherId: { in: vouchers } } });
}
