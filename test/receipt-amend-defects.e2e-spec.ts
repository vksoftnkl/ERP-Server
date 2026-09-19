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
 * The three `/receipts/amend` defects of 2026-09-18, each driven end to end
 * through the real HTTP surface against the live dev database:
 *
 *   (a) a body with no `avhVoucherId` answered 500 instead of 400;
 *   (b) an amend could move a POSTED receipt to a DIFFERENT customer, keeping
 *       the receipt number the first customer is holding a slip for;
 *   (c) a receipt that had been amended could never be cancelled — a 500 with
 *       an empty errors array, which made amend a one-way door.
 *
 * **This suite WRITES.** It posts its own receipt, amends it, cancels it and
 * leaves it CANCELLED — a clean terminal state — so it is repeatable, and it
 * never touches a receipt it did not create. Money is put back exactly: the
 * bills it settles are asserted to return to the pending amounts they started
 * with.
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

/** Small enough to fit on any open bill, large enough to be visible. */
const AMOUNT = 100;

const prisma = new PrismaClient();

interface Bill {
  billId: string;
  billAccYear: string;
  partyId: string;
  partyName: string;
  docRefno: string;
}

interface Fixtures {
  tenderId: string;
  tenderTypeId: number;
  tenderLedgerId: string | null;
  /** Two open bills belonging to two DIFFERENT parties — (b) needs both. */
  mine: Bill;
  theirs: Bill;
}

jest.setTimeout(180_000);

describe('POST /receipts/amend — the three defects (e2e, live DB, writes)', () => {
  let app: INestApplication;
  let fx: Fixtures;
  let amendAllowed = false;

  const pendingOf = async (bill: Bill): Promise<number> => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ pending: string }>>(
      `SELECT abl_pending_amount::text AS pending
         FROM accounts.acc_bill_balance
        WHERE abl_id = $1::uuid AND abl_acc_year = $2::bpchar`,
      bill.billId,
      bill.billAccYear,
    );
    return Number(row.pending);
  };

  beforeAll(async () => {
    // CASH deliberately: every other tender type needs a reference, and a
    // cheque additionally needs an instrument date and a bank. None of that is
    // what this suite is about.
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

    // One open receivable per party, for two different parties. Taken from the
    // database rather than hard-coded so the suite survives the dev data
    // moving on.
    const bills = await prisma.$queryRawUnsafe<
      Array<{
        abl_id: string;
        abl_acc_year: string;
        abl_party_id: string;
        led_name: string;
        abl_doc_refno: string;
      }>
    >(
      `SELECT DISTINCT ON (b.abl_party_id)
              b.abl_id, b.abl_acc_year, b.abl_party_id, l.led_name, b.abl_doc_refno
         FROM accounts.acc_bill_balance b
         JOIN accounts.acc_ledger_master l ON l.led_id = b.abl_party_id
        WHERE b.abl_company_id = $1::uuid
          AND b.abl_dr_cr = 'DR'
          AND b.abl_is_deleted = false AND b.abl_is_active = true
          AND b.abl_pending_amount >= $2
          AND b.abl_bill_type IN ('SALES','OPENING','INTEREST','JOURNAL','PURCHASE_RETURN')
          AND l.led_is_active = true AND l.led_is_deleted = false
        ORDER BY b.abl_party_id, b.abl_pending_amount DESC`,
      COMPANY,
      AMOUNT,
    );

    const toBill = (row: (typeof bills)[number]): Bill => ({
      billId: row.abl_id,
      billAccYear: row.abl_acc_year,
      partyId: row.abl_party_id,
      partyName: row.led_name,
      docRefno: row.abl_doc_refno,
    });

    fx = {
      tenderId: tender.tnd_id,
      tenderTypeId: tender.tnd_type_id,
      tenderLedgerId: tender.tnd_ledger_id,
      mine: toBill(bills[0]),
      theirs: toBill(bills[1]),
    };

    // `/amend` is the one route here gated by a company setting. With it off
    // every call is a 409 naming the key, and none of these defects is
    // reachable — so the suite says so rather than reporting false passes.
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
        '[amend e2e] accounts.allow_posted_amend is OFF for this company — amend is a 409 and ' +
          'the (b) and (c) cases cannot be reached.',
      );
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  // ── Building one posted receipt, the ordinary way ───────────────────────

  const today = (): string => new Date().toISOString().slice(0, 10);

  const draftBody = (bill: Bill, remark: string) => ({
    avhCompanyId: COMPANY,
    avhBranchId: BRANCH,
    avhAccYear: ACC_YEAR,
    avhVoucherDate: today(),
    avhPartyId: bill.partyId,
    avhRemarks: remark,
    avhUserId: ACTOR,
    tenders: [
      {
        tdRowNo: 1,
        tdTenderId: fx.tenderId,
        tdTenderTypeId: fx.tenderTypeId,
        ...(fx.tenderLedgerId ? { tdTenderLedgerId: fx.tenderLedgerId } : {}),
        tdAmount: AMOUNT,
        // ck_td_cash_change: received − change must equal tdAmount.
        tdReceivedAmt: AMOUNT,
        tdChangeAmt: 0,
      },
    ],
  });

  const allocationFor = (bill: Bill) => ({
    billId: bill.billId,
    billAccYear: bill.billAccYear,
    amount: AMOUNT,
  });

  /** Post a receipt for `mine`, settling AMOUNT against its bill. */
  const postReceipt = async (remark: string): Promise<string> => {
    const draft = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(draftBody(fx.mine, remark));
    expect(draft.status).toBe(201);

    const voucherId = draft.body.data.header.avhVoucherId as string;

    const posted = await request(app.getHttpServer())
      .post(POST)
      .set('Authorization', BEARER)
      .send({
        avhVoucherId: voucherId,
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        allocations: [allocationFor(fx.mine)],
        onAccount: 0,
      });
    expect(posted.status).toBe(201);
    return voucherId;
  };

  const cancelReceipt = async (voucherId: string, reason: string) =>
    request(app.getHttpServer()).post(CANCEL).set('Authorization', BEARER).send({
      avhVoucherId: voucherId,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: ACC_YEAR,
      reason,
    });

  // ── (a) ─────────────────────────────────────────────────────────────────

  it('(a) refuses an amend with no avhVoucherId as a 400, not a 500', async () => {
    const response = await request(app.getHttpServer())
      .post(AMEND)
      .set('Authorization', BEARER)
      .send({
        // avhVoucherId deliberately absent.
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: ACC_YEAR,
        avhVoucherDate: today(),
        avhPartyId: fx.mine.partyId,
        tenders: [],
        allocations: [],
        onAccount: 0,
        baseRevision: 0,
        editRemark: 'E2E — missing id must be a 400',
      });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
    expect(JSON.stringify(response.body)).toContain('avhVoucherId');
  });

  // ── (b) ─────────────────────────────────────────────────────────────────

  it('(b) refuses an amend that moves the receipt to a different customer', async () => {
    if (!amendAllowed) {
      return;
    }
    expect(fx.theirs.partyId).not.toBe(fx.mine.partyId);

    const minePendingBefore = await pendingOf(fx.mine);
    const theirsPendingBefore = await pendingOf(fx.theirs);

    const voucherId = await postReceipt('E2E-AMEND(b) — must not change party');
    const minePendingPosted = await pendingOf(fx.mine);
    expect(minePendingPosted).toBeCloseTo(minePendingBefore - AMOUNT, 2);

    // The exact shape that used to succeed: the NEW party AND that party's own
    // bill, so the payload is internally consistent and nothing downstream has
    // grounds to object.
    const response = await request(app.getHttpServer())
      .post(AMEND)
      .set('Authorization', BEARER)
      .send({
        ...draftBody(fx.theirs, 'E2E-AMEND(b) — moved to another customer'),
        avhVoucherId: voucherId,
        allocations: [allocationFor(fx.theirs)],
        onAccount: 0,
        baseRevision: 0,
        editRemark: 'E2E — party change must be refused',
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    // It has to name the party, and say which two are involved.
    const body = JSON.stringify(response.body);
    expect(body).toContain('avhPartyId');
    expect(body).toContain(fx.mine.partyName);
    expect(body).toContain(fx.theirs.partyName);

    // Nothing moved. The original party's bill is still settled by this
    // receipt and the other party's bill was never touched.
    expect(await pendingOf(fx.mine)).toBeCloseTo(minePendingPosted, 2);
    expect(await pendingOf(fx.theirs)).toBeCloseTo(theirsPendingBefore, 2);

    // And the receipt is still the first party's, still POSTED, still rev 0.
    const [header] = await prisma.$queryRawUnsafe<
      Array<{ avh_party_id: string; avh_voucher_status: string; avh_revision_no: number }>
    >(
      `SELECT avh_party_id, avh_voucher_status, avh_revision_no
         FROM accounts.acc_voucher_header
        WHERE avh_voucher_id = $1::uuid AND avh_acc_year = $2::bpchar`,
      voucherId,
      ACC_YEAR,
    );
    expect(header.avh_party_id).toBe(fx.mine.partyId);
    expect(header.avh_voucher_status).toBe('POSTED');
    expect(header.avh_revision_no).toBe(0);

    // Put the money back.
    const cancelled = await cancelReceipt(voucherId, 'E2E-AMEND(b) — tidy up');
    expect(cancelled.status).toBe(201);
    expect(await pendingOf(fx.mine)).toBeCloseTo(minePendingBefore, 2);
  });

  // ── (c) ─────────────────────────────────────────────────────────────────

  it('(c) cancels a receipt that has been amended', async () => {
    if (!amendAllowed) {
      return;
    }
    const pendingBefore = await pendingOf(fx.mine);

    const voucherId = await postReceipt('E2E-AMEND(c) — will be amended then cancelled');
    expect(await pendingOf(fx.mine)).toBeCloseTo(pendingBefore - AMOUNT, 2);

    // A legitimate amend: same party, same bill, corrected narration. This is
    // the ordinary use of the route.
    const amended = await request(app.getHttpServer())
      .post(AMEND)
      .set('Authorization', BEARER)
      .send({
        ...draftBody(fx.mine, 'E2E-AMEND(c) — narration corrected'),
        avhVoucherId: voucherId,
        allocations: [allocationFor(fx.mine)],
        onAccount: 0,
        baseRevision: 0,
        editRemark: 'E2E — correcting the narration',
      });
    expect(amended.status).toBe(201);
    expect(amended.body.data.toRevision).toBe(1);

    // The bill is settled once, not twice: an amend replaces the post, it does
    // not add to it.
    expect(await pendingOf(fx.mine)).toBeCloseTo(pendingBefore - AMOUNT, 2);

    // THE DEFECT: this used to be
    // {"success":false,"message":"Internal server error","errors":[]}
    const cancelled = await cancelReceipt(voucherId, 'E2E-AMEND(c) — cancel after amend');
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.data.toStatus).toBe('CANCELLED');

    // And the money is back — exactly once. Reversing the superseded rows as
    // well as the live ones would have put back twice what was taken.
    expect(await pendingOf(fx.mine)).toBeCloseTo(pendingBefore, 2);
  });

  it('(c) cancels a receipt that has been amended TWICE', async () => {
    if (!amendAllowed) {
      return;
    }
    const pendingBefore = await pendingOf(fx.mine);
    const voucherId = await postReceipt('E2E-AMEND(c2) — two amends then cancel');

    for (const revision of [0, 1]) {
      const amended = await request(app.getHttpServer())
        .post(AMEND)
        .set('Authorization', BEARER)
        .send({
          ...draftBody(fx.mine, `E2E-AMEND(c2) — amend ${revision + 1}`),
          avhVoucherId: voucherId,
          allocations: [allocationFor(fx.mine)],
          onAccount: 0,
          baseRevision: revision,
          editRemark: `E2E — amend number ${revision + 1}`,
        });
      expect(amended.status).toBe(201);
      expect(amended.body.data.toRevision).toBe(revision + 1);
    }

    // Three forward rows and two negatives now sit on one voucher id. This is
    // the shape that produced the 23505 on ux_abj_reversal.
    const cancelled = await cancelReceipt(voucherId, 'E2E-AMEND(c2) — cancel after two amends');
    expect(cancelled.status).toBe(201);

    expect(await pendingOf(fx.mine)).toBeCloseTo(pendingBefore, 2);
  });
});
