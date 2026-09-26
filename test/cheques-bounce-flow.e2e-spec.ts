// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import type {
  ChequeBouncePayload,
  ChequeDepositPayload,
  ChequeClearPayload,
  ChequeDetailPayload,
  ChequeHistoryPayload,
  ChequeReplacePayload,
  ChequeReturnPayload,
  ChequeListPayload,
  ChequeRepresentPayload,
  DepositSlipPayload,
} from '../src/modules/accountsModule/cheques/types/cheque-api.types';

/**
 * §7 of the Received Cheques plan, run end to end against the live dev
 * database.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE WORKED EXAMPLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §7: "Bounce on 221870: five legs 19,050 / 19,050; bil00022 and bil00025 back
 * to 12,500 / 6,000; a JOURNAL bill of 300 open for Anand Stores;
 * apd_bounce_voucher_id = apd_charge_voucher_id; status BOUNCED with reason."
 *
 * A cheque of 18,500 settling two bills, bounced with a bank charge of 250 and
 * a party charge of 300:
 *
 *     DR  the party                     18,800
 *     CR  Cheques in Hand               18,500
 *     CR  BOUNCE_CHARGES_RECOVERED         300
 *     DR  BANK_CHARGES                              250
 *     CR  the bank                                  250
 *                                       ─────────────
 *                            19,050  /  19,050
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THIS SUITE MUTATES, AND CLEANS UP AFTER ITSELF
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Unlike the receipt open-items suite, a bounce cannot be verified by reading:
 * the whole claim is about what gets WRITTEN. So the suite builds its own
 * fixtures — a receipt-shaped voucher, a tender row, a register row and the
 * adjustment rows the receipt would have written — drives the endpoints over
 * HTTP, and deletes every row it created in afterAll, newest table first.
 *
 * Nothing pre-existing is touched: the party, the company and the cheques-in-
 * hand ledger are read, and the two bills the cheque settles are CREATED by
 * this suite so the assertions do not depend on dev data that moves on.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';

// A company with an OPEN 2026-2027 year, a CHEQUE tender, and party ledgers.
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const PARTY = '01a0aa0b-31c3-7602-9209-8cf164d4b6c8';
// tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const CHEQUE_AMOUNT = 18500;
const BILL_A_AMOUNT = 12500;
const BILL_B_AMOUNT = 6000;
const BANK_CHARGE = 250;
const PARTY_CHARGE = 300;

// Every date is in the PAST relative to the day this runs: the services refuse
// a deposit, a clearing or a bounce dated in the future, because each is a
// claim about something a bank has already done.
const RECEIVED_ON = '2026-08-04';
const INSTRUMENT_DATE = '2026-09-05';
const DEPOSIT_DATE = '2026-09-08';
const BOUNCE_DATE = '2026-09-10';
const REPRESENT_DATE = '2026-09-14';
const BILL_DOC_DATE = '2026-07-14';
const BILL_DUE_DATE = '2026-08-13';
const CLEAR_DATE = '2026-09-11';
const BANK_DATE = '2026-09-12';
const REPLACEMENT_DATE = '2026-09-15';

const prisma = new PrismaClient();

// Everything this suite created, for the teardown.
const created = {
  vouchers: [] as string[],
  bills: [] as string[],
  cheques: [] as string[],
  tenders: [] as string[],
};

interface Fixture {
  apdId: string;
  instrumentNo: string;
  voucherId: string;
  tenderId: string;
  billA: string;
  billB: string;
  bankLedgerId: string;
  inHandLedgerId: string;
}

let app: INestApplication;
let fixture: Fixture;

const api = () => request(app.getHttpServer());

/**
 * The `data` block, typed as the module's own payload interface.
 *
 * supertest types `res.body` as `any`, so every assertion against it is an
 * unchecked member access. Unwrapping once per call through the REAL response
 * type makes the suite a compile-time check on the contract too: rename a field
 * on `ChequeBouncePayload` and this file stops building, which is the same
 * guarantee `dto/cheque-response.dto.ts` gets from `implements`.
 */
const payload = <T>(res: request.Response): T => (res.body as { data: T }).data;

// One app and one teardown for BOTH describes below: booting the Nest graph
// twice in one file costs about five seconds and buys nothing, and the fixtures
// are per-describe anyway.
beforeAll(async () => {
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
}, 120_000);

afterAll(async () => {
  await teardown();
  await app?.close();
  await prisma.$disconnect();
}, 60_000);

describe('Received cheques — deposit, bounce, re-present (e2e, live DB, mutating)', () => {
  beforeAll(async () => {
    fixture = await seedChequeAsReceiptWouldHave();
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — deposit
  // ═══════════════════════════════════════════════════════════════════════

  it('deposits a HELD cheque, writes no voucher, and files a status step', async () => {
    const vouchersBefore = await prisma.accVoucherHeader.count({
      where: { avhCompanyId: COMPANY, avhAccYear: ACC_YEAR },
    });

    const res = await api()
      .post('/api/v1/cheques/deposit')
      .set('Authorization', BEARER)
      .send({
        cheques: [{ apdId: fixture.apdId, apdAccYear: ACC_YEAR }],
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: fixture.bankLedgerId,
        depositDate: DEPOSIT_DATE,
        slipNo: `E2E-${fixture.instrumentNo}`,
      });

    expect(res.status).toBe(201);
    const data = payload<ChequeDepositPayload>(res);
    expect(data.rows[0].apdStatus).toBe('DEPOSITED');
    expect(data.rows[0].apdPresentCount).toBe(1);
    expect(data.slip.totalAmount).toBeCloseTo(CHEQUE_AMOUNT, 2);

    // §4.2 — a deposit posts NOTHING. The bank has taken custody, not paid.
    const vouchersAfter = await prisma.accVoucherHeader.count({
      where: { avhCompanyId: COMPANY, avhAccYear: ACC_YEAR },
    });
    expect(vouchersAfter).toBe(vouchersBefore);
  }, 60_000);

  it('refuses a deposit dated before the cheque, naming the date', async () => {
    const other = await seedChequeAsReceiptWouldHave({ instrumentDate: '2026-12-20' });

    const res = await api()
      .post('/api/v1/cheques/deposit')
      .set('Authorization', BEARER)
      .send({
        cheques: [{ apdId: other.apdId, apdAccYear: ACC_YEAR }],
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: other.bankLedgerId,
        depositDate: DEPOSIT_DATE,
        slipNo: 'E2E-EARLY',
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/on or after 20-12/);

    // Nothing was written: the row is still HELD.
    const row = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: other.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(row.apdStatus).toBe('HELD');
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — the bounce, which is the worked example
  // ═══════════════════════════════════════════════════════════════════════

  it('bounces with five legs of 19,050 / 19,050, reopens both bills, and raises the charge bill', async () => {
    const res = await api().post('/api/v1/cheques/bounce').set('Authorization', BEARER).send({
      apdId: fixture.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      bounceDate: BOUNCE_DATE,
      reason: 'Funds insufficient',
      bankCharge: BANK_CHARGE,
      partyCharge: PARTY_CHARGE,
    });

    expect(res.status).toBe(201);
    const data = payload<ChequeBouncePayload>(res);
    created.vouchers.push(data.voucher.voucherId);
    if (data.chargeBill) {
      created.bills.push(data.chargeBill.billId);
    }

    // ── FIVE legs, and they balance at 19,050 ──────────────────────────
    expect(data.legs).toHaveLength(5);
    expect(data.voucher.totalDebit).toBeCloseTo(19050, 2);
    expect(data.voucher.totalCredit).toBeCloseTo(19050, 2);

    const leg = (drCr: string, ledgerId: string) =>
      data.legs.find((row) => row.drCr === drCr && row.ledgerId === ledgerId)!;

    // DR party 18,800 — the credit taken back AND the charge, on one leg.
    expect(leg('DR', PARTY).amount).toBeCloseTo(CHEQUE_AMOUNT + PARTY_CHARGE, 2);
    // CR Cheques in Hand 18,500 — from the cheque's OWN tender row (§5).
    expect(leg('CR', fixture.inHandLedgerId).amount).toBeCloseTo(CHEQUE_AMOUNT, 2);
    // CR the bank 250 — the return fee the bank took.
    expect(leg('CR', fixture.bankLedgerId).amount).toBeCloseTo(BANK_CHARGE, 2);

    // The two role legs, carrying their roles so a report survives a remap.
    const roles = data.legs
      .map((row) => row.role)
      .filter(Boolean)
      .sort();
    expect(roles).toEqual(['BANK_CHARGES', 'BOUNCE_CHARGES_RECOVERED']);

    // ── Both bills back to their full amounts ──────────────────────────
    const pending = new Map<string, number>(
      data.billsReopened.map((bill) => [bill.billId, bill.pendingAmount]),
    );
    expect(pending.get(fixture.billA)).toBeCloseTo(BILL_A_AMOUNT, 2);
    expect(pending.get(fixture.billB)).toBeCloseTo(BILL_B_AMOUNT, 2);

    // ── A JOURNAL bill of 300, open, for the party ─────────────────────
    expect(data.chargeBill).not.toBeNull();
    expect(data.chargeBill!.billType).toBe('JOURNAL');
    expect(data.chargeBill!.billAmount).toBeCloseTo(PARTY_CHARGE, 2);
    expect(data.chargeBill!.pendingAmount).toBeCloseTo(PARTY_CHARGE, 2);

    // ── The register ───────────────────────────────────────────────────
    const row = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: fixture.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(row.apdStatus).toBe('BOUNCED');
    expect(row.apdBounceReason).toBe('Funds insufficient');
    expect(Number(row.apdBounceCharges)).toBeCloseTo(BANK_CHARGE + PARTY_CHARGE, 2);
    // §7: apd_bounce_voucher_id = apd_charge_voucher_id — one event, one voucher.
    expect(row.apdBounceVoucherId).toBe(data.voucher.voucherId);
    expect(row.apdChargeVoucherId).toBe(data.voucher.voucherId);

    // ── The reversal rows mirror the originals, and net to zero ────────
    const adjustments = await prisma.accBillAdjustment.findMany({
      where: { abjChequeId: fixture.apdId, abjIsDeleted: false },
    });
    expect(adjustments).toHaveLength(4); // two settlements, two reversals
    const net = adjustments.reduce((acc, adj) => acc.plus(adj.abjAmount), new Prisma.Decimal(0));
    expect(Number(net)).toBeCloseTo(0, 2);
    for (const reversal of adjustments.filter((adj) => adj.abjReversalOfId !== null)) {
      const original = adjustments.find((adj) => adj.abjId === reversal.abjReversalOfId)!;
      // The post-dated mirror: the reversal COPIES the original's date and
      // flag, or abl_alloc_amount would go negative on an un-matured cheque.
      expect(reversal.abjIsPostDated).toBe(original.abjIsPostDated);
      expect(reversal.abjAdjDate.toISOString()).toBe(original.abjAdjDate.toISOString());
      expect(reversal.abjDrCr).not.toBe(original.abjDrCr);
    }
  }, 120_000);

  it('records the bounce in history, with who and when', async () => {
    const res = await api()
      .get('/api/v1/cheques/history')
      .query({
        apdId: fixture.apdId,
        apdAccYear: ACC_YEAR,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
      })
      .set('Authorization', BEARER);

    expect(res.status).toBe(200);
    const history = payload<ChequeHistoryPayload>(res);
    const statuses = history.entries.map((entry) => entry.toStatus);
    // Newest first: BOUNCED, then DEPOSITED.
    expect(statuses).toEqual(['BOUNCED', 'DEPOSITED']);
    for (const entry of history.entries) {
      expect(entry.changedBy).toBeTruthy();
      expect(entry.changedOn).toBeTruthy();
    }
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — the refusals
  // ═══════════════════════════════════════════════════════════════════════

  it('refuses to clear a BOUNCED cheque, naming the state and what can be done', async () => {
    const res = await api().post('/api/v1/cheques/clear').set('Authorization', BEARER).send({
      apdId: fixture.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      clearDate: BOUNCE_DATE,
    });

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toMatch(/is BOUNCED — re-present it or replace it/);
  }, 60_000);

  it('refuses to return a cheque that has gone to the bank', async () => {
    const res = await api().post('/api/v1/cheques/return').set('Authorization', BEARER).send({
      apdId: fixture.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      action: 'RETURNED',
      reason: 'Party asked for it back',
    });

    expect(res.status).toBe(409);
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — re-present
  // ═══════════════════════════════════════════════════════════════════════

  it('re-presents with a re-issue voucher, present count 2, and the bounce untouched', async () => {
    const before = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: fixture.apdId, apdAccYear: ACC_YEAR } },
    });

    const res = await api()
      .post('/api/v1/cheques/re-present')
      .set('Authorization', BEARER)
      .send({
        apdId: fixture.apdId,
        apdAccYear: ACC_YEAR,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: fixture.bankLedgerId,
        depositDate: REPRESENT_DATE,
        slipNo: `E2E-RP-${fixture.instrumentNo}`,
      });

    expect(res.status).toBe(201);
    const data = payload<ChequeRepresentPayload>(res);
    created.vouchers.push(data.reissueVoucher!.voucherId);

    // The re-issue: DR Cheques in Hand / CR the party, for the cheque's amount.
    expect(data.reissueVoucher).not.toBeNull();
    expect(data.reissueVoucher!.totalDebit).toBeCloseTo(CHEQUE_AMOUNT, 2);
    const drLeg = data.legs.find((leg) => leg.drCr === 'DR')!;
    const crLeg = data.legs.find((leg) => leg.drCr === 'CR')!;
    expect(drLeg.ledgerId).toBe(fixture.inHandLedgerId);
    expect(crLeg.ledgerId).toBe(PARTY);

    expect(data.cheque.apdStatus).toBe('DEPOSITED');
    // §7: apd_present_count 2.
    expect(data.cheque.apdPresentCount).toBe(2);

    // §7: "the bounce voucher untouched." The links, the reason and the
    // charges all survive; only apd_bounce_date clears, because ck_apd_seq
    // will not have it standing beside a LATER deposit date.
    const after = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: fixture.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(after.apdBounceVoucherId).toBe(before.apdBounceVoucherId);
    expect(after.apdChargeVoucherId).toBe(before.apdChargeVoucherId);
    expect(after.apdBounceReason).toBe(before.apdBounceReason);
    expect(Number(after.apdBounceCharges)).toBeCloseTo(Number(before.apdBounceCharges), 2);
    expect(after.apdBounceDate).toBeNull();

    // The ChqBnc voucher itself is untouched — still POSTED, still five legs.
    const bounceVoucher = await prisma.accVoucherHeader.findUniqueOrThrow({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: before.apdBounceVoucherId!,
          avhAccYear: before.apdBounceAccYear!,
        },
      },
    });
    expect(bounceVoucher.avhVoucherStatus).toBe('POSTED');
    const bounceLegs = await prisma.accVoucher.count({
      where: { avVoucherId: before.apdBounceVoucherId!, avIsDeleted: false },
    });
    expect(bounceLegs).toBe(5);

    // §4.5 — the money goes back on the bills the BOUNCE took it off, with the
    // amounts it took. Not auto-FIFO: a re-presentation is the same money for
    // the same debt, and the bounce-charge bill — an ordinary open receivable
    // that FIFO would happily dip into — is left alone.
    const restored = new Map(
      data.billsAllocated.map((bill) => [bill.billId, bill.settledByThisCheque]),
    );
    expect(restored.size).toBe(2);
    expect(restored.get(fixture.billA)).toBeCloseTo(BILL_A_AMOUNT, 2);
    expect(restored.get(fixture.billB)).toBeCloseTo(BILL_B_AMOUNT, 2);
    const allocated = data.billsAllocated.reduce((acc, bill) => acc + bill.settledByThisCheque, 0);
    expect(allocated).toBeCloseTo(CHEQUE_AMOUNT, 2);
  }, 120_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  The reads
  // ═══════════════════════════════════════════════════════════════════════

  it('get returns the vouchers, the bills and the ledger the cheque sits in', async () => {
    const res = await api()
      .get('/api/v1/cheques/get')
      .query({
        apdId: fixture.apdId,
        apdAccYear: ACC_YEAR,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
      })
      .set('Authorization', BEARER);

    expect(res.status).toBe(200);
    const data = payload<ChequeDetailPayload>(res);
    // §5 — from the cheque's own tender row, not today's master.
    expect(data.chequesInHandLedgerId).toBe(fixture.inHandLedgerId);
    expect(data.bounceVoucher).not.toBeNull();
    expect(data.chargeBill).not.toBeNull();
    expect(data.bills.length).toBeGreaterThan(0);
  }, 60_000);

  it('list reports the summary strip over the whole register', async () => {
    const res = await api()
      .get('/api/v1/cheques/list')
      .query({ apdCompanyId: COMPANY, apdBranchId: BRANCH, apdAccYear: ACC_YEAR })
      .set('Authorization', BEARER);

    expect(res.status).toBe(200);
    const summary = payload<ChequeListPayload>(res).summary;
    // Our fixture is DEPOSITED (re-presented) and the second one is HELD.
    expect(summary.withBankCount).toBeGreaterThanOrEqual(1);
    expect(summary.inHandCount).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('the deposit slip carries the bank and one line per cheque', async () => {
    const res = await api()
      .get('/api/v1/cheques/deposit-slip')
      .query({
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: fixture.bankLedgerId,
        depositDate: REPRESENT_DATE,
        slipNo: `E2E-RP-${fixture.instrumentNo}`,
      })
      .set('Authorization', BEARER);

    expect(res.status).toBe(200);
    const slip = payload<DepositSlipPayload>(res);
    expect(slip.chequeCount).toBe(1);
    expect(slip.totalAmount).toBeCloseTo(CHEQUE_AMOUNT, 2);
    expect(slip.bankAccount.ledgerId).toBe(fixture.bankLedgerId);
    expect(slip.lines[0].instrumentNo).toBe(fixture.instrumentNo);
  }, 60_000);
});

describe('Received cheques — clear, return, replace (e2e, live DB, mutating)', () => {
  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — clear (ON_RECEIPT): the contra
  // ═══════════════════════════════════════════════════════════════════════

  it('clears with a ChqClr contra of two legs, sets av_recon_date, and settles the row', async () => {
    const cheque = await seedChequeAsReceiptWouldHave();
    await deposit(cheque);

    const res = await api().post('/api/v1/cheques/clear').set('Authorization', BEARER).send({
      apdId: cheque.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      clearDate: CLEAR_DATE,
      bankDate: BANK_DATE,
    });

    expect(res.status).toBe(201);
    const data = payload<ChequeClearPayload>(res);
    created.vouchers.push(data.voucher.voucherId);

    // Two legs, no party, no bills: the receipt settled those weeks ago.
    expect(data.legs).toHaveLength(2);
    expect(data.billsSettled).toHaveLength(0);
    expect(data.voucher.totalDebit).toBeCloseTo(CHEQUE_AMOUNT, 2);
    expect(data.voucher.totalCredit).toBeCloseTo(CHEQUE_AMOUNT, 2);

    const drLeg = data.legs.find((leg) => leg.drCr === 'DR')!;
    const crLeg = data.legs.find((leg) => leg.drCr === 'CR')!;
    expect(drLeg.ledgerId).toBe(cheque.bankLedgerId);
    // §5 — from the cheque's OWN tender row.
    expect(crLeg.ledgerId).toBe(cheque.inHandLedgerId);

    // A CONTRA, not a receipt: a clearing filed as RECEIPT would double-count
    // collections in every "money received this month" report.
    const header = await prisma.accVoucherHeader.findUniqueOrThrow({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: data.voucher.voucherId,
          avhAccYear: data.voucher.accYear,
        },
      },
      include: { voucherType: true },
    });
    expect(header.voucherType.vchrTypeCode).toBe('ChqClr');
    expect(header.voucherType.vchrNature).toBe('CONTRA');
    // The idempotency key that makes a second clearing impossible.
    expect(header.avhSrcDocType).toBe('PDC');
    expect(header.avhSrcDocId).toBe(cheque.apdId);

    // av_recon_date on the BANK leg and nowhere else — the hook bank
    // reconciliation hangs off.
    const legs = await prisma.accVoucher.findMany({
      where: { avVoucherId: data.voucher.voucherId, avIsDeleted: false },
      orderBy: { avRowNo: 'asc' },
    });
    const bankLeg = legs.find((leg) => leg.avLedgerId === cheque.bankLedgerId)!;
    const inHandLeg = legs.find((leg) => leg.avLedgerId === cheque.inHandLedgerId)!;
    expect(bankLeg.avReconDate?.toISOString().slice(0, 10)).toBe(BANK_DATE);
    expect(inHandLeg.avReconDate).toBeNull();

    const row = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(row.apdStatus).toBe('CLEARED');
    // ck_apd_cleared: a CLEARED row carries BOTH the date and the voucher.
    expect(row.apdClearVoucherId).toBe(data.voucher.voucherId);
    expect(row.apdClearDate?.toISOString().slice(0, 10)).toBe(CLEAR_DATE);
  }, 120_000);

  it('refuses a second clearing of the same cheque, by the unique index', async () => {
    const cheque = await seedChequeAsReceiptWouldHave();
    await deposit(cheque);

    const send = () =>
      api().post('/api/v1/cheques/clear').set('Authorization', BEARER).send({
        apdId: cheque.apdId,
        apdAccYear: ACC_YEAR,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        clearDate: CLEAR_DATE,
      });

    const first = await send();
    expect(first.status).toBe(201);
    created.vouchers.push(payload<ChequeClearPayload>(first).voucher.voucherId);

    // The row is CLEARED now, so the STATUS refusal fires before ux_avh_src
    // ever gets the chance — which is the better error of the two, because it
    // names the date the cheque cleared on.
    const second = await send();
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toMatch(/is CLEARED/);
  }, 120_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — return from HELD
  // ═══════════════════════════════════════════════════════════════════════

  it('returns a HELD cheque, reverses the receipt and reopens the bills', async () => {
    const cheque = await seedChequeAsReceiptWouldHave();

    const res = await api().post('/api/v1/cheques/return').set('Authorization', BEARER).send({
      apdId: cheque.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      action: 'RETURNED',
      reason: 'Party asked for the paper back',
    });

    expect(res.status).toBe(201);
    const data = payload<ChequeReturnPayload>(res);
    created.vouchers.push(data.reversalVoucher!.voucherId);

    // DR party / CR Cheques in Hand — the exact mirror of what the receipt
    // posted, and the bounce's two legs without the charges.
    expect(data.legs).toHaveLength(2);
    const drLeg = data.legs.find((leg) => leg.drCr === 'DR')!;
    const crLeg = data.legs.find((leg) => leg.drCr === 'CR')!;
    expect(drLeg.ledgerId).toBe(PARTY);
    expect(crLeg.ledgerId).toBe(cheque.inHandLedgerId);
    expect(data.reversalVoucher!.totalDebit).toBeCloseTo(CHEQUE_AMOUNT, 2);

    const pending = new Map<string, number>(
      data.billsReopened.map((bill) => [bill.billId, bill.pendingAmount]),
    );
    expect(pending.get(cheque.billA)).toBeCloseTo(BILL_A_AMOUNT, 2);
    expect(pending.get(cheque.billB)).toBeCloseTo(BILL_B_AMOUNT, 2);

    const row = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(row.apdStatus).toBe('RETURNED');
    // ck_apd_cancelled covers RETURNED too: it must say why.
    expect(row.apdCancelReason).toBe('Party asked for the paper back');
  }, 120_000);

  it('CANCELLED frees the cheque number, RETURNED does not', async () => {
    const cheque = await seedChequeAsReceiptWouldHave();

    const res = await api().post('/api/v1/cheques/return').set('Authorization', BEARER).send({
      apdId: cheque.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      action: 'CANCELLED',
      reason: 'Keyed against the wrong party',
    });

    expect(res.status).toBe(201);
    created.vouchers.push(payload<ChequeReturnPayload>(res).reversalVoucher!.voucherId);

    // ux_apd_instrument excludes CANCELLED, so the same number may be keyed
    // again for the same party in the same year — which is exactly what a
    // mis-keyed cheque needs.
    const again = await seedChequeAsReceiptWouldHave({ instrumentNo: cheque.instrumentNo });
    expect(again.apdId).not.toBe(cheque.apdId);
  }, 120_000);

  // ═══════════════════════════════════════════════════════════════════════
  //  §7 — replace
  // ═══════════════════════════════════════════════════════════════════════

  it('replaces a HELD cheque: the old row REPLACED, a new HELD row re-issued for the new amount', async () => {
    const old = await seedChequeAsReceiptWouldHave();
    const NEW_AMOUNT = 12300;

    const res = await api()
      .post('/api/v1/cheques/replace')
      .set('Authorization', BEARER)
      .send({
        apdId: old.apdId,
        apdAccYear: ACC_YEAR,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        newCheque: {
          instrumentNo: `${old.instrumentNo}R`,
          instrumentDate: REPLACEMENT_DATE,
          amount: NEW_AMOUNT,
          bankName: 'Karur Vysya Bank',
        },
        reason: 'Party swapped the paper',
      });

    expect(res.status).toBe(201);
    const data = payload<ChequeReplacePayload>(res);
    created.cheques.push(data.newCheque.apdId);
    if (data.reversalVoucher) {
      created.vouchers.push(data.reversalVoucher.voucherId);
    }
    if (data.reissueVoucher) {
      created.vouchers.push(data.reissueVoucher.voucherId);
    }

    // From HELD the old cheque is RETURNED first — no charges, because nothing
    // was dishonoured.
    expect(data.reversalVoucher).not.toBeNull();
    expect(data.oldCheque.apdStatus).toBe('REPLACED');
    expect(data.newCheque.apdStatus).toBe('HELD');
    expect(data.newCheque.apdAmount).toBeCloseTo(NEW_AMOUNT, 2);
    expect(data.newCheque.apdPresentCount).toBe(0);

    // ck_apd_replaced / ck_apd_replaced_pair: the id and the year move together.
    const oldRow = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: old.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(oldRow.apdReplacedById).toBe(data.newCheque.apdId);
    expect(oldRow.apdReplacedByAccYear).toBe(data.newCheque.apdAccYear);

    // The re-issue is for the NEW amount, which need not equal the old one.
    expect(data.reissueVoucher).not.toBeNull();
    expect(data.reissueVoucher!.totalDebit).toBeCloseTo(NEW_AMOUNT, 2);

    // Both ends of the chain are reachable from /get.
    const chain = await api()
      .get('/api/v1/cheques/get')
      .query({
        apdId: data.newCheque.apdId,
        apdAccYear: data.newCheque.apdAccYear,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
      })
      .set('Authorization', BEARER);
    expect(chain.status).toBe(200);
    expect(payload<ChequeDetailPayload>(chain).replaces?.apdId).toBe(old.apdId);

    // §4.6 — a step on BOTH rows.
    const history = await api()
      .get('/api/v1/cheques/history')
      .query({
        apdId: data.newCheque.apdId,
        apdAccYear: data.newCheque.apdAccYear,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
      })
      .set('Authorization', BEARER);
    expect(payload<ChequeHistoryPayload>(history).entries.length).toBeGreaterThan(0);
  }, 120_000);

  /** The deposit every clearing needs first, as its own step. */
  async function deposit(cheque: Fixture): Promise<void> {
    const res = await api()
      .post('/api/v1/cheques/deposit')
      .set('Authorization', BEARER)
      .send({
        cheques: [{ apdId: cheque.apdId, apdAccYear: ACC_YEAR }],
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: cheque.bankLedgerId,
        depositDate: DEPOSIT_DATE,
        slipNo: `E2E-${cheque.instrumentNo}`,
      });
    expect(res.status).toBe(201);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  The fixture — a cheque exactly as the receipt module would have left it
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds what `/receipts/post` writes for one post-dated cheque under
 * ON_RECEIPT: a voucher (DR Cheques in Hand / CR the party), the tender row
 * that records WHICH ledger it went to, two bills and the adjustment rows
 * settling them, and the register row.
 *
 * Written directly rather than by calling `/receipts/post`, because this suite
 * is about the CHEQUE endpoints: going through the receipt would make a
 * failure here ambiguous between the two modules, and the receipt has its own
 * suites.
 */
// ═══════════════════════════════════════════════════════════════════════════
//  §4.5 — a re-presented cheque settles THE BILLS IT CAME OFF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The defect these four cover, in one line: `POST /cheques/re-present` with no
 * `allocations` used to auto-allocate FIFO, which moved a customer's money onto
 * whichever of their debts sorted first — a bill the cheque was never against —
 * and `/cheques/get` then reported that as fact.
 *
 * Every test here seeds a DECOY: an older, larger, wide-open invoice for the
 * same party. Auto-FIFO would swallow the whole cheque into it. Nothing may.
 */
describe('Received cheques — re-presentation restores the bounced allocation (e2e, live DB, mutating)', () => {
  const SECOND_BOUNCE_DATE = '2026-09-16';
  const DECOY_DATES = { docDate: '2026-05-02', dueDate: '2026-06-01' };
  const DECOY_AMOUNT = 30000;

  /** A cheque taken in, banked and returned — the state re-present starts from. */
  async function seedBouncedCheque(): Promise<Fixture> {
    const cheque = await seedChequeAsReceiptWouldHave();

    const deposit = await api()
      .post('/api/v1/cheques/deposit')
      .set('Authorization', BEARER)
      .send({
        cheques: [{ apdId: cheque.apdId, apdAccYear: ACC_YEAR }],
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: cheque.bankLedgerId,
        depositDate: DEPOSIT_DATE,
        slipNo: `E2E-D-${cheque.instrumentNo}`,
      });
    expect(deposit.status).toBe(201);

    const bounce = await api().post('/api/v1/cheques/bounce').set('Authorization', BEARER).send({
      apdId: cheque.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      bounceDate: BOUNCE_DATE,
      reason: 'Funds insufficient',
      // No charges: this suite is about where the money lands, and the five
      // legs are the bounce suite's business.
      bankCharge: 0,
      partyCharge: 0,
    });
    expect(bounce.status).toBe(201);
    created.vouchers.push(payload<ChequeBouncePayload>(bounce).voucher.voucherId);

    return cheque;
  }

  /**
   * The bill auto-FIFO would reach for first: due three months before the two
   * the cheque actually settled, and big enough to swallow it whole.
   */
  async function seedDecoyBill(cheque: Fixture, refno: string): Promise<string> {
    const type = await prisma.accVoucherType.findFirstOrThrow({
      where: { vchrTypeCode: 'Rct' },
      select: { vchrTypeId: true },
    });
    const bill = await createBill(
      prisma,
      `${refno}-${Date.now().toString().slice(-6)}`,
      DECOY_AMOUNT,
      cheque.voucherId,
      type.vchrTypeId,
      DECOY_DATES,
    );
    return bill.id;
  }

  const represent = (cheque: Fixture, body: Record<string, unknown> = {}) =>
    api()
      .post('/api/v1/cheques/re-present')
      .set('Authorization', BEARER)
      .send({
        apdId: cheque.apdId,
        apdAccYear: ACC_YEAR,
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        bankLedgerId: cheque.bankLedgerId,
        depositDate: REPRESENT_DATE,
        slipNo: `E2E-RP2-${cheque.instrumentNo}`,
        ...body,
      });

  it('puts the money back on the bills it came off, and not on the older open one', async () => {
    const cheque = await seedBouncedCheque();
    const decoy = await seedDecoyBill(cheque, 'E2E-DECOY');

    const res = await represent(cheque);
    expect(res.status).toBe(201);
    const data = payload<ChequeRepresentPayload>(res);
    created.vouchers.push(data.reissueVoucher!.voucherId);

    // The response says the two bills the cheque was always against.
    const byBill = new Map(
      data.billsAllocated.map((bill) => [bill.billId, bill.settledByThisCheque]),
    );
    expect(byBill.get(cheque.billA)).toBeCloseTo(BILL_A_AMOUNT, 2);
    expect(byBill.get(cheque.billB)).toBeCloseTo(BILL_B_AMOUNT, 2);
    expect(byBill.has(decoy)).toBe(false);

    // And so do the rows, which is the half the old behaviour got wrong: the
    // +2,000-shaped row used to be real, live and against a bill the cheque had
    // never touched.
    const written = await prisma.accBillAdjustment.findMany({
      where: {
        abjChequeId: cheque.apdId,
        abjVoucherId: data.reissueVoucher!.voucherId,
        abjIsDeleted: false,
      },
      select: { abjBillId: true, abjAmount: true },
    });
    expect(written.map((row) => row.abjBillId).sort()).toEqual([cheque.billA, cheque.billB].sort());

    // The decoy never moved a paisa.
    const decoyRow = await prisma.accBillBalance.findUniqueOrThrow({
      where: { ablId_ablAccYear: { ablId: decoy, ablAccYear: ACC_YEAR } },
    });
    expect(Number(decoyRow.ablAllocAmount)).toBeCloseTo(0, 2);

    // Each bill is settled again, to the paisa, by the sum of its LIVE rows —
    // §7's reconciliation, on the bills this cheque is responsible for.
    for (const [billId, amount] of [
      [cheque.billA, BILL_A_AMOUNT],
      [cheque.billB, BILL_B_AMOUNT],
    ] as const) {
      const rows = await prisma.accBillAdjustment.findMany({
        where: { abjBillId: billId, abjBillAccYear: ACC_YEAR, abjIsDeleted: false },
        select: { abjAmount: true },
      });
      const live = rows.reduce((acc, row) => acc + Number(row.abjAmount), 0);
      expect(live).toBeCloseTo(amount, 2);

      const bill = await prisma.accBillBalance.findUniqueOrThrow({
        where: { ablId_ablAccYear: { ablId: billId, ablAccYear: ACC_YEAR } },
      });
      expect(Number(bill.ablAllocAmount)).toBeCloseTo(amount, 2);
    }
  }, 180_000);

  it('still sends it wherever explicit allocations say, which is the override', async () => {
    const cheque = await seedBouncedCheque();
    const decoy = await seedDecoyBill(cheque, 'E2E-OVERRIDE');

    const res = await represent(cheque, {
      allocations: [{ billId: decoy, billAccYear: ACC_YEAR, amount: CHEQUE_AMOUNT }],
    });
    expect(res.status).toBe(201);
    const data = payload<ChequeRepresentPayload>(res);
    created.vouchers.push(data.reissueVoucher!.voucherId);

    // The operator re-pointed it on purpose, and that is honoured in full.
    expect(data.billsAllocated).toHaveLength(1);
    expect(data.billsAllocated[0].billId).toBe(decoy);
    expect(data.billsAllocated[0].settledByThisCheque).toBeCloseTo(CHEQUE_AMOUNT, 2);

    // The bills the cheque came off stay open, because nobody asked for them.
    const billA = await prisma.accBillBalance.findUniqueOrThrow({
      where: { ablId_ablAccYear: { ablId: cheque.billA, ablAccYear: ACC_YEAR } },
    });
    expect(Number(billA.ablAllocAmount)).toBeCloseTo(0, 2);
  }, 180_000);

  it('refuses, naming the bill, when one cannot take its share back', async () => {
    const cheque = await seedBouncedCheque();
    await seedDecoyBill(cheque, 'E2E-REFUSE');

    const gone = await prisma.accBillBalance.update({
      where: { ablId_ablAccYear: { ablId: cheque.billB, ablAccYear: ACC_YEAR } },
      data: { ablIsDeleted: true, ablIsActive: false },
      select: { ablDocRefno: true },
    });

    const res = await represent(cheque);

    // A 409 naming the bill, NOT a silent re-pointing at the decoy. The world
    // moved after the settlement was made, and choosing a different bill is
    // exactly the behaviour this endpoint is not allowed to have.
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain(gone.ablDocRefno);

    // Nothing was written: one transaction, and it rolled back.
    const row = await prisma.accPdcRegister.findUniqueOrThrow({
      where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: ACC_YEAR } },
    });
    expect(row.apdStatus).toBe('BOUNCED');
    expect(row.apdPresentCount).toBe(1);

    const billA = await prisma.accBillBalance.findUniqueOrThrow({
      where: { ablId_ablAccYear: { ablId: cheque.billA, ablAccYear: ACC_YEAR } },
    });
    expect(Number(billA.ablAllocAmount)).toBeCloseTo(0, 2);
  }, 180_000);

  it('bounces a re-presented cheque without reversing the first settlement twice', async () => {
    const cheque = await seedBouncedCheque();

    const first = await represent(cheque);
    expect(first.status).toBe(201);
    created.vouchers.push(payload<ChequeRepresentPayload>(first).reissueVoucher!.voucherId);

    // §7 — a second bounce is a real separate event, not a duplicate.
    const second = await api().post('/api/v1/cheques/bounce').set('Authorization', BEARER).send({
      apdId: cheque.apdId,
      apdAccYear: ACC_YEAR,
      apdCompanyId: COMPANY,
      apdBranchId: BRANCH,
      bounceDate: SECOND_BOUNCE_DATE,
      reason: 'Funds insufficient',
      bankCharge: 0,
      partyCharge: 0,
    });
    expect(second.status).toBe(201);
    created.vouchers.push(payload<ChequeBouncePayload>(second).voucher.voucherId);

    // The bills are open again — ONCE. `abj_reversal_of_id IS NULL` means "not
    // itself a reversal", not "still stands": sweeping up the first cycle's
    // already-reversed rows would take the allocation down to -12,500 and leave
    // the bill reading as 25,000 outstanding on a 12,500 invoice.
    for (const [billId, amount] of [
      [cheque.billA, BILL_A_AMOUNT],
      [cheque.billB, BILL_B_AMOUNT],
    ] as const) {
      const bill = await prisma.accBillBalance.findUniqueOrThrow({
        where: { ablId_ablAccYear: { ablId: billId, ablAccYear: ACC_YEAR } },
      });
      expect(Number(bill.ablAllocAmount)).toBeCloseTo(0, 2);
      expect(Number(bill.ablBillAmount) - Number(bill.ablAllocAmount)).toBeCloseTo(amount, 2);

      const rows = await prisma.accBillAdjustment.findMany({
        where: { abjBillId: billId, abjBillAccYear: ACC_YEAR, abjIsDeleted: false },
        select: { abjAmount: true },
      });
      expect(rows.reduce((acc, row) => acc + Number(row.abjAmount), 0)).toBeCloseTo(0, 2);
      // Two cycles: settle, reverse, settle, reverse.
      expect(rows).toHaveLength(4);
    }
  }, 180_000);
});

async function seedChequeAsReceiptWouldHave(
  options: { instrumentDate?: string; instrumentNo?: string } = {},
): Promise<Fixture> {
  const instrumentDate = new Date(`${options.instrumentDate ?? INSTRUMENT_DATE}T00:00:00Z`);
  const receivedOn = new Date(`${RECEIVED_ON}T00:00:00Z`);
  const stamp = Date.now().toString().slice(-6);
  const instrumentNo = options.instrumentNo ?? `E2E${stamp}${Math.floor(Math.random() * 90 + 10)}`;

  const tender = await prisma.accTenderMaster.findFirstOrThrow({
    where: { tndTypeId: 5, tndCompanyId: COMPANY, tndIsDeleted: false },
    select: { tndId: true, tndLedgerId: true },
  });
  const bank = await prisma.accLedgerMaster.findFirstOrThrow({
    where: { ledLedgerType: 'BANK', ledIsDeleted: false, ledIsActive: true },
    select: { ledId: true },
  });
  const inHandLedgerId = tender.tndLedgerId;

  return prisma.$transaction(async (tx) => {
    // ── The voucher, POSTED, with the two legs the receipt wrote ────────
    const voucherNo = BigInt(Date.now() % 1_000_000);
    const header = await tx.accVoucherHeader.create({
      data: {
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherTypeId: (
          await tx.accVoucherType.findFirstOrThrow({ where: { vchrTypeCode: 'Rct' } })
        ).vchrTypeId,
        avhVoucherNo: voucherNo,
        avhVoucherSlno: voucherNo,
        avhVoucherRefno: `e2e${stamp}`,
        avhVoucherDate: instrumentDate,
        avhPartyId: PARTY,
        avhEmployeeId: [],
        avhDocAmount: CHEQUE_AMOUNT,
        avhUserId: ACTOR,
        avhVoucherStatus: 'DRAFT',
        avhCreatedBy: ACTOR,
      },
      select: { avhVoucherId: true, avhVoucherTypeId: true },
    });
    created.vouchers.push(header.avhVoucherId);

    await tx.accVoucher.createMany({
      data: [
        {
          avVoucherId: header.avhVoucherId,
          avCompanyId: COMPANY,
          avBranchId: BRANCH,
          avAccYear: ACC_YEAR,
          avVoucherTypeId: header.avhVoucherTypeId,
          avVoucherNo: voucherNo,
          avRowNo: 1,
          avVoucherDate: instrumentDate,
          avDrCr: 'DR',
          avLedgerId: inHandLedgerId,
          avAmount: CHEQUE_AMOUNT,
          avUserId: ACTOR,
          avCreatedBy: ACTOR,
        },
        {
          avVoucherId: header.avhVoucherId,
          avCompanyId: COMPANY,
          avBranchId: BRANCH,
          avAccYear: ACC_YEAR,
          avVoucherTypeId: header.avhVoucherTypeId,
          avVoucherNo: voucherNo,
          avRowNo: 2,
          avVoucherDate: instrumentDate,
          avDrCr: 'CR',
          avLedgerId: PARTY,
          avAmount: CHEQUE_AMOUNT,
          avUserId: ACTOR,
          avCreatedBy: ACTOR,
        },
      ],
    });

    await tx.accVoucherHeader.update({
      where: {
        avhVoucherId_avhAccYear: { avhVoucherId: header.avhVoucherId, avhAccYear: ACC_YEAR },
      },
      // ck_avh_posted_on and ck_avh_status_on: a POSTED header must carry
      // its posting timestamp AND who posted it.
      data: {
        avhVoucherStatus: 'POSTED',
        avhPostedOn: new Date(),
        avhStatusOn: new Date(),
        avhStatusBy: ACTOR,
      },
    });

    // ── The tender row — WHICH ledger the cheque went to (§5) ───────────
    const tenderRow = await tx.accTenderDetail.create({
      data: {
        tdCompanyId: COMPANY,
        tdBranchId: BRANCH,
        tdAccYear: ACC_YEAR,
        tdSrcModule: 'ACCOUNTS',
        tdSrcDocType: 'RECEIPT',
        tdSrcDocId: header.avhVoucherId,
        tdRowNo: 1,
        tdDocDate: instrumentDate,
        tdPartyLedgerId: PARTY,
        tdTenderId: tender.tndId,
        tdTenderTypeId: 5,
        tdTenderLedgerId: inHandLedgerId,
        tdDrCr: 'DR',
        tdAmount: CHEQUE_AMOUNT,
        // ck_td_total_amt: td_total_amt = round(td_amount + td_surcharge_amt, 2).
        tdTotalAmt: CHEQUE_AMOUNT,
        tdRefNo: instrumentNo,
        tdInstrumentDate: instrumentDate,
        tdUserId: ACTOR,
        tdCreatedBy: ACTOR,
      },
      select: { tdId: true },
    });
    created.tenders.push(tenderRow.tdId);

    // ── The register row ───────────────────────────────────────────────
    const register = await tx.accPdcRegister.create({
      data: {
        apdCompanyId: COMPANY,
        apdBranchId: BRANCH,
        apdAccYear: ACC_YEAR,
        apdTraType: 'R',
        apdPartyId: PARTY,
        apdInstrumentType: 'CHEQUE',
        apdInstrumentNo: instrumentNo,
        apdInstrumentDate: instrumentDate,
        apdAmount: CHEQUE_AMOUNT,
        apdBankName: 'Karur Vysya Bank',
        apdReceivedOn: receivedOn,
        apdBankLedgerId: bank.ledId,
        apdPostingMode: 'ON_RECEIPT',
        apdVoucherId: header.avhVoucherId,
        apdVoucherAccYear: ACC_YEAR,
        apdTenderId: tenderRow.tdId,
        apdStatus: 'HELD',
        apdCreatedBy: ACTOR,
      },
      select: { apdId: true },
    });
    created.cheques.push(register.apdId);

    // ── Two bills, and the rows settling them ──────────────────────────
    const billA = await createBill(
      tx,
      `E2E-A-${stamp}`,
      BILL_A_AMOUNT,
      header.avhVoucherId,
      header.avhVoucherTypeId,
    );
    const billB = await createBill(
      tx,
      `E2E-B-${stamp}`,
      BILL_B_AMOUNT,
      header.avhVoucherId,
      header.avhVoucherTypeId,
    );

    await tx.accBillAdjustment.createMany({
      data: [billA, billB].map((bill, index) => ({
        abjCompanyId: COMPANY,
        abjBranchId: BRANCH,
        abjAccYear: ACC_YEAR,
        abjBillId: bill.id,
        abjBillAccYear: ACC_YEAR,
        abjPartyId: PARTY,
        abjRowNo: index + 1,
        abjVoucherId: header.avhVoucherId,
        abjVoucherAccYear: ACC_YEAR,
        abjAdjType: 'ALLOCATION',
        abjAdjDate: instrumentDate,
        abjDrCr: 'CR',
        abjAmount: bill.amount,
        abjSettlementMode: 'CHEQUE',
        abjTenderId: tenderRow.tdId,
        abjTenderAccYear: ACC_YEAR,
        abjChequeId: register.apdId,
        abjChequeAccYear: ACC_YEAR,
        // Matured: the cheque is dated 20-09 and we are past it, so these
        // count and the bills read as settled.
        abjIsPostDated: false,
        abjUserId: ACTOR,
        abjCreatedBy: ACTOR,
      })),
    });

    // The cached columns the recompute owns, set to what the rows imply.
    for (const bill of [billA, billB]) {
      await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: bill.id, ablAccYear: ACC_YEAR } },
        data: { ablAllocAmount: bill.amount },
      });
    }

    return {
      apdId: register.apdId,
      instrumentNo,
      voucherId: header.avhVoucherId,
      tenderId: tenderRow.tdId,
      billA: billA.id,
      billB: billB.id,
      bankLedgerId: bank.ledId,
      inHandLedgerId,
    };
  });
}

async function createBill(
  tx: Prisma.TransactionClient,
  refno: string,
  amount: number,
  voucherId: string,
  voucherTypeId: number,
  // An EARLIER due date is what makes a bill the one auto-FIFO would reach for
  // first, which is how the re-presentation suite below proves it does not. The
  // document date moves with it: ck_abl_due_date will not have a bill falling
  // due before it was raised.
  dates: { docDate: string; dueDate: string } = { docDate: BILL_DOC_DATE, dueDate: BILL_DUE_DATE },
): Promise<{ id: string; amount: number }> {
  const bill = await tx.accBillBalance.create({
    data: {
      ablCompanyId: COMPANY,
      ablBranchId: BRANCH,
      ablAccYear: ACC_YEAR,
      ablPartyId: PARTY,
      ablBillType: 'SALES',
      ablSrcModule: 'SALES',
      // ck_abl_src_doc: the type and the id move together, or neither.
      ablSrcDocType: 'SALE_BILL',
      ablSrcDocId: voucherId,
      ablSrcAccYear: ACC_YEAR,
      // ck_abl_voucher: a non-OPENING bill names its voucher AND its type.
      ablVoucherId: voucherId,
      ablVoucherTypeId: voucherTypeId,
      ablVoucherDate: new Date(`${dates.docDate}T00:00:00Z`),
      ablDocRefno: refno,
      ablDocDate: new Date(`${dates.docDate}T00:00:00Z`),
      ablDueDate: new Date(`${dates.dueDate}T00:00:00Z`),
      ablDrCr: 'DR',
      ablBillAmount: amount,
      ablCreatedBy: ACTOR,
    },
    select: { ablId: true },
  });
  created.bills.push(bill.ablId);
  return { id: bill.ablId, amount };
}

/**
 * Newest table first, so no foreign key is left dangling: the adjustment rows
 * point at the bills and the vouchers, the register points at the vouchers and
 * the tender, and the bills point at the vouchers.
 */
async function teardown(): Promise<void> {
  const chequeIds = created.cheques;
  const voucherIds = created.vouchers;
  const billIds = created.bills;

  await prisma.txnStatusLog.deleteMany({
    where: { tslSrcDocId: { in: chequeIds }, tslAccYear: ACC_YEAR },
  });
  await prisma.accBillAdjustment.deleteMany({
    where: {
      OR: [
        { abjChequeId: { in: chequeIds } },
        { abjVoucherId: { in: voucherIds } },
        { abjBillId: { in: billIds } },
      ],
    },
  });
  await prisma.accPdcRegister.deleteMany({ where: { apdId: { in: chequeIds } } });
  await prisma.accBillBalance.deleteMany({
    where: { OR: [{ ablId: { in: billIds } }, { ablVoucherId: { in: voucherIds } }] },
  });
  await prisma.accTenderDetail.deleteMany({ where: { tdId: { in: created.tenders } } });
  await prisma.accVoucher.deleteMany({ where: { avVoucherId: { in: voucherIds } } });
  await prisma.accVoucherHeader.deleteMany({ where: { avhVoucherId: { in: voucherIds } } });
}
