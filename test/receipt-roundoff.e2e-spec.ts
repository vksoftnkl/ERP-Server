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
 * "received 10, disc 1, r.off 1 but i cant post" — 2026-09-18.
 *
 * The round-off had nowhere to go: `PostReceiptAllocationDto` carried only
 * `amount`, `discount` and `writeoff`, so a client folded the round-off into
 * `amount` — which the server reads as MONEY — and §5.2 step 4 refused the
 * receipt as "Out by -1.00". The figure was right; there was no box for it.
 *
 * The acceptance, in the words it was asked in: post a receipt of 10 against a
 * bill with discount 1 and roundoff 1; expect 201, the bill down by 12, and
 * legs DR Cash 10 / DR Discount Allowed 1 / DR Round Off 1 / CR party 12.
 *
 * **This suite WRITES.** It posts its own receipts and cancels each one, so
 * every bill it touches ends where it started. It never touches a receipt it
 * did not create.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const CREATE = '/api/v1/receipts/create';
const POST = '/api/v1/receipts/post';
const CANCEL = '/api/v1/receipts/cancel';
const BEARER = 'Bearer dummy-test-token';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
const ACC_YEAR = '2026-2027';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1 (SUPER ADMIN)

const prisma = new PrismaClient();

interface Fixtures {
  partyId: string;
  partyName: string;
  tenderId: string;
  tenderTypeId: number;
  tenderLedgerId: string | null;
  billId: string;
  billAccYear: string;
  roundOffLedgerId: string;
  discountLedgerId: string;
}

jest.setTimeout(180_000);

describe('a receipt may round a bill off (e2e, live DB, writes)', () => {
  let app: INestApplication;
  let fx: Fixtures;

  const pending = async (): Promise<number> => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ pending: string }>>(
      `SELECT abl_pending_amount::text AS pending
         FROM accounts.acc_bill_balance
        WHERE abl_id = $1::uuid AND abl_acc_year = $2::bpchar`,
      fx.billId,
      fx.billAccYear,
    );
    return Number(row.pending);
  };

  const legsOf = async (
    voucherId: string,
  ): Promise<Array<{ drCr: string; ledgerId: string; amount: number; role: string | null }>> => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ av_dr_cr: string; av_ledger_id: string; amount: string; av_role: string | null }>
    >(
      `SELECT av_dr_cr, av_ledger_id, av_amount::text AS amount, av_role
         FROM accounts.acc_vouchers
        WHERE av_voucher_id = $1::uuid AND av_is_deleted = false
        ORDER BY av_row_no`,
      voucherId,
    );
    return rows.map((row) => ({
      drCr: row.av_dr_cr,
      ledgerId: row.av_ledger_id,
      amount: Number(row.amount),
      role: row.av_role,
    }));
  };

  const adjustmentsOf = async (
    voucherId: string,
  ): Promise<Array<{ adjType: string; amount: number; mode: string | null }>> => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ abj_adj_type: string; amount: string; abj_settlement_mode: string | null }>
    >(
      `SELECT abj_adj_type, abj_amount::text AS amount, abj_settlement_mode
         FROM accounts.acc_bill_adjustment
        WHERE abj_voucher_id = $1::uuid AND abj_is_deleted = false
        ORDER BY abj_row_no`,
      voucherId,
    );
    return rows.map((row) => ({
      adjType: row.abj_adj_type,
      amount: Number(row.amount),
      mode: row.abj_settlement_mode,
    }));
  };

  beforeAll(async () => {
    const [tender] = await prisma.$queryRawUnsafe<
      Array<{ tnd_id: string; tnd_type_id: number; tnd_ledger_id: string | null }>
    >(
      `SELECT t.tnd_id, t.tnd_type_id, t.tnd_ledger_id
         FROM accounts.acc_tender_master t
         JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
        WHERE t.tnd_is_deleted = false AND t.tnd_is_active = true
          AND y.ttm_is_cash = true
          AND (t.tnd_company_id IS NULL OR t.tnd_company_id = $1::uuid)
        ORDER BY t.tnd_is_default DESC
        LIMIT 1`,
      COMPANY,
    );

    // A bill with real headroom, so a sibling suite settling 100 against the
    // same party cannot make a 12 allocation overshoot.
    const [bill] = await prisma.$queryRawUnsafe<
      Array<{ abl_id: string; abl_acc_year: string; abl_party_id: string; led_name: string }>
    >(
      `SELECT b.abl_id, b.abl_acc_year, b.abl_party_id, l.led_name
         FROM accounts.acc_bill_balance b
         JOIN accounts.acc_ledger_master l ON l.led_id = b.abl_party_id
        WHERE b.abl_company_id = $1::uuid AND b.abl_dr_cr = 'DR'
          AND b.abl_is_deleted = false AND b.abl_is_active = true
          AND b.abl_pending_amount >= 1000
          AND b.abl_bill_type IN ('SALES','OPENING','INTEREST','JOURNAL','PURCHASE_RETURN')
          AND l.led_is_active = true AND l.led_is_deleted = false
        ORDER BY b.abl_pending_amount DESC
        LIMIT 1`,
      COMPANY,
    );

    const roles = await prisma.$queryRawUnsafe<Array<{ alm_role: string; alm_ledger_id: string }>>(
      `SELECT alm_role, alm_ledger_id FROM accounts.acc_ledger_map
        WHERE alm_role IN ('ROUND_OFF','DISCOUNT_ALLOWED')`,
    );
    const ledgerFor = (role: string): string =>
      roles.find((row) => row.alm_role === role)!.alm_ledger_id;

    fx = {
      partyId: bill.abl_party_id,
      partyName: bill.led_name,
      tenderId: tender.tnd_id,
      tenderTypeId: tender.tnd_type_id,
      tenderLedgerId: tender.tnd_ledger_id,
      billId: bill.abl_id,
      billAccYear: bill.abl_acc_year,
      roundOffLedgerId: ledgerFor('ROUND_OFF'),
      discountLedgerId: ledgerFor('DISCOUNT_ALLOWED'),
    };

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
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  const today = (): string => new Date().toISOString().slice(0, 10);

  const draft = async (received: number, remark: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send({
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherDate: today(),
        avhPartyId: fx.partyId,
        avhRemarks: remark,
        avhUserId: ACTOR,
        tenders: [
          {
            tdRowNo: 1,
            tdTenderId: fx.tenderId,
            tdTenderTypeId: fx.tenderTypeId,
            ...(fx.tenderLedgerId ? { tdTenderLedgerId: fx.tenderLedgerId } : {}),
            tdAmount: received,
            // ck_td_cash_change: received − change must equal tdAmount.
            tdReceivedAmt: received,
            tdChangeAmt: 0,
          },
        ],
      });
    expect(response.status).toBe(201);
    return response.body.data.header.avhVoucherId as string;
  };

  const cancel = async (voucherId: string) => {
    const response = await request(app.getHttpServer())
      .post(CANCEL)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        reason: 'E2E — round-off suite tidy up',
      });
    expect(response.status).toBe(201);
  };

  // ── The acceptance, as written ──────────────────────────────────────────

  it('posts 10 received with discount 1 and roundoff 1, settling the bill by 12', async () => {
    const before = await pending();
    const voucherId = await draft(10, 'E2E round-off — received 10, disc 1, r.off 1');

    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [
          {
            billId: fx.billId,
            billAccYear: fx.billAccYear,
            amount: 10,
            discount: 1,
            roundoff: 1,
          },
        ],
        onAccount: 0,
      });

    // This is the call that used to come back "Out by -1.00".
    expect(posted.status).toBe(201);

    // The bill is down by 12: ten of money and two of reductions.
    expect(await pending()).toBeCloseTo(before - 12, 2);

    // DR Cash 10 / DR Discount Allowed 1 / DR Round Off 1 / CR party 12.
    const legs = await legsOf(voucherId);
    const dr = legs.filter((leg) => leg.drCr === 'DR');
    const cr = legs.filter((leg) => leg.drCr === 'CR');

    expect(dr).toHaveLength(3);
    expect(cr).toHaveLength(1);
    expect(cr[0]).toMatchObject({ ledgerId: fx.partyId, amount: 12 });

    const money = dr.find((leg) => leg.role === null);
    expect(money?.amount).toBe(10);
    expect(dr.find((leg) => leg.role === 'DISCOUNT_ALLOWED')).toMatchObject({
      ledgerId: fx.discountLedgerId,
      amount: 1,
    });
    expect(dr.find((leg) => leg.role === 'ROUND_OFF')).toMatchObject({
      ledgerId: fx.roundOffLedgerId,
      amount: 1,
    });

    // The voucher balances, which is what ck_avh_balanced now actually checks.
    const totalDr = dr.reduce((sum, leg) => sum + leg.amount, 0);
    expect(totalDr).toBeCloseTo(12, 2);

    // The adjustment rows say the same thing the legs do — ROUND_OFF is its
    // own type, not a DISCOUNT wearing a different ledger.
    const adjustments = await adjustmentsOf(voucherId);
    expect(adjustments.map((row) => [row.adjType, row.amount])).toEqual(
      expect.arrayContaining([
        ['ALLOCATION', 10],
        ['DISCOUNT', 1],
        ['ROUND_OFF', 1],
      ]),
    );
    expect(adjustments.find((row) => row.adjType === 'ROUND_OFF')?.mode).toBe('ROUND_OFF');

    await cancel(voucherId);
    expect(await pending()).toBeCloseTo(before, 2);
  });

  it('still refuses a round-off folded into amount, naming the imbalance', async () => {
    const voucherId = await draft(10, 'E2E round-off — folded into amount, must be refused');

    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        // The old workaround: 11 of "money" against 10 received.
        allocations: [{ billId: fx.billId, billAccYear: fx.billAccYear, amount: 11 }],
        onAccount: 0,
      });

    expect(posted.status).toBe(400);
    expect(JSON.stringify(posted.body)).toContain('Out by');

    await request(app.getHttpServer())
      .post('/api/v1/receipts/delete')
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
      });
  });

  it('refuses a negative round-off rather than writing a negative adjustment row', async () => {
    const voucherId = await draft(10, 'E2E round-off — negative, must be refused');

    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [{ billId: fx.billId, billAccYear: fx.billAccYear, amount: 10, roundoff: -1 }],
        onAccount: 0,
      });

    // ck_abj_reversal_sign refuses a negative non-reversal row, so this has to
    // be a 400 from the DTO and never reach the constraint as a 500.
    expect(posted.status).toBe(400);
    expect(posted.status).not.toBe(500);

    await request(app.getHttpServer())
      .post('/api/v1/receipts/delete')
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
      });
  });

  it('a round-off alone settles a bill, with no money at all', async () => {
    // The degenerate case the reported one shades into: a bill left with 40
    // paise on it, cleared by rounding and nothing else. It must not need a
    // token tender row to be expressible.
    const before = await pending();
    const voucherId = await draft(10, 'E2E round-off — money plus a pure rounding');

    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [
          { billId: fx.billId, billAccYear: fx.billAccYear, amount: 10, roundoff: 0.4 },
        ],
        onAccount: 0,
      });

    expect(posted.status).toBe(201);
    expect(await pending()).toBeCloseTo(before - 10.4, 2);

    const roundOffLeg = (await legsOf(voucherId)).find((leg) => leg.role === 'ROUND_OFF');
    expect(roundOffLeg?.amount).toBeCloseTo(0.4, 2);

    await cancel(voucherId);
    expect(await pending()).toBeCloseTo(before, 2);
  });
});
