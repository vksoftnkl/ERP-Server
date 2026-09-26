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
 * HTTP-level test for POST /api/v1/receipts/delete — the route that makes an
 * abandoned draft recoverable.
 *
 * `/cancel` refuses a DRAFT, correctly: there is nothing to reverse. But until
 * this route existed nothing took its place, so an abandoned draft was
 * PERMANENT — it sat in the list for ever and the only way past it was to post
 * a receipt nobody wanted. Seven of them had accumulated on Acme Foods against
 * 28 posted receipts before this was built.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard: the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and the exception filters all run, so the
 * results match the live server.
 *
 * This drives the SAME database the live server uses. Unlike every other write
 * suite here, it cleans up after itself completely — which is the point: the
 * route under test is the cleanup. Every fixture it creates is labelled
 * E2E-DELETE in avh_usr_refno and is deleted by the route itself.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const CREATE = '/api/v1/receipts/create';
const DELETE = '/api/v1/receipts/delete';
const GET = '/api/v1/receipts/get';
const BEARER = 'Bearer dummy-test-token';

// Real master rows on the dev database.
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
const ACC_YEAR = '2026-2027';
// tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();

interface Fixtures {
  partyId: string;
  tenderId: string;
  tenderTypeId: number;
  tenderLedgerId: string | null;
  /** A POSTED receipt, for the refusal case. Null if the dev data has none. */
  postedVoucherId: string | null;
  postedRefno: string | null;
}

describe('POST /receipts/delete — throw a draft away (e2e, live DB)', () => {
  let app: INestApplication;
  let fx: Fixtures;

  beforeAll(async () => {
    // Everything is taken FROM the database rather than hard-coded, so the
    // suite still means something after the dev data moves on.
    // CASH deliberately (ttm_is_cash). Every other tender type has
    // ttm_needs_ref, and a CHEQUE additionally needs tdInstrumentDate and
    // tdBankName — none of which this suite is about. The point is to get a
    // valid draft on disk as cheaply as possible and then delete it.
    const [tender] = await prisma.$queryRawUnsafe<
      Array<{ tnd_id: string; tnd_type_id: number; tnd_ledger_id: string | null }>
    >(
      `SELECT t.tnd_id, t.tnd_type_id, t.tnd_ledger_id
         FROM accounts.acc_tender_master t
         JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
        WHERE t.tnd_is_deleted = false
          AND t.tnd_is_active = true
          AND y.ttm_is_cash = true
          AND (t.tnd_company_id IS NULL OR t.tnd_company_id = $1::uuid)
        ORDER BY t.tnd_is_default DESC
        LIMIT 1`,
      COMPANY,
    );

    // A party with a live ledger in this company — loadParty is what refuses
    // anything else, and this suite is not testing that.
    const [party] = await prisma.$queryRawUnsafe<Array<{ led_id: string }>>(
      `SELECT l.led_id
         FROM accounts.acc_ledger_master l
        WHERE l.led_is_deleted = false
          AND (l.led_company_id IS NULL OR l.led_company_id = $1::uuid)
          AND EXISTS (SELECT 1 FROM sales.customers c WHERE c.cus_id = l.led_id)
        ORDER BY l.led_created_on DESC
        LIMIT 1`,
      COMPANY,
    );

    const [posted] = await prisma.$queryRawUnsafe<
      Array<{ avh_voucher_id: string; avh_voucher_refno: string | null }>
    >(
      `SELECT avh_voucher_id, avh_voucher_refno
         FROM accounts.acc_voucher_header
        WHERE avh_is_deleted = false
          AND avh_voucher_status = 'POSTED'
          AND avh_against_voucher_id IS NULL
          AND avh_company_id = $1::uuid
          AND avh_acc_year = $2::bpchar
          AND avh_voucher_type_id =
              (SELECT vchr_type_id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Rct')
        ORDER BY avh_created_on DESC
        LIMIT 1`,
      COMPANY,
      ACC_YEAR,
    );

    fx = {
      partyId: party.led_id,
      tenderId: tender.tnd_id,
      tenderTypeId: tender.tnd_type_id,
      tenderLedgerId: tender.tnd_ledger_id,
      postedVoucherId: posted?.avh_voucher_id ?? null,
      postedRefno: posted?.avh_voucher_refno ?? null,
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

  /** A two-tender draft, so the tender count in the payload is not trivially 1. */
  const createDraft = async (): Promise<string> => {
    const body = {
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: ACC_YEAR,
      avhVoucherDate: new Date().toISOString().slice(0, 10),
      avhPartyId: fx.partyId,
      avhUsrRefno: 'E2E-DELETE',
      avhRemarks: 'E2E-DELETE — created to be deleted',
      avhUserId: ACTOR,
      tenders: [1, 2].map((rowNo) => ({
        tdRowNo: rowNo,
        tdTenderId: fx.tenderId,
        tdTenderTypeId: fx.tenderTypeId,
        ...(fx.tenderLedgerId ? { tdTenderLedgerId: fx.tenderLedgerId } : {}),
        tdAmount: 500,
        // ck_td_cash_change: received − change must equal tdAmount.
        tdReceivedAmt: 500,
        tdChangeAmt: 0,
      })),
    };

    const res = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send(body);

    expect(res.status).toBe(201);
    // The draft payload is { header, tenders, otherLines, expectedRoles } —
    // the id is on the header, not at the top level.
    return res.body.data.header.avhVoucherId as string;
  };

  const keys = (voucherId: string) => ({
    avhVoucherId: voucherId,
    avhCompanyId: COMPANY,
    avhBranchId: BRANCH,
    avhAccYear: ACC_YEAR,
  });

  it('deletes a DRAFT, and reports what went with it', async () => {
    const voucherId = await createDraft();

    const res = await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.avhVoucherId).toBe(voucherId);
    expect(res.body.data.tendersDeleted).toBe(2);
    // R10 — a draft never took a number, so there is no gap in the series.
    expect(res.body.data.avhVoucherRefno).toBeNull();
    // A delete is NOT a status move: the row leaves play through avh_is_deleted
    // and the status column is left alone.
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('soft-deletes the header and its tenders, and leaves the status at DRAFT', async () => {
    const voucherId = await createDraft();
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(201);

    const [header] = await prisma.$queryRawUnsafe<
      Array<{
        avh_is_deleted: boolean;
        avh_is_active: boolean;
        avh_voucher_status: string;
        avh_modified_by: string | null;
        avh_draft_lines: unknown;
      }>
    >(
      `SELECT avh_is_deleted, avh_is_active, avh_voucher_status, avh_modified_by, avh_draft_lines
         FROM accounts.acc_voucher_header
        WHERE avh_voucher_id = $1::uuid AND avh_acc_year = $2::bpchar`,
      voucherId,
      ACC_YEAR,
    );

    expect(header.avh_is_deleted).toBe(true);
    expect(header.avh_is_active).toBe(false);
    // Left alone on purpose. DELETED is an event, not a status this column has
    // a value for, and stamping CANCELLED would put a receipt that was never
    // posted into the cancelled list beside receipts that were.
    expect(header.avh_voucher_status).toBe('DRAFT');
    expect(header.avh_modified_by).toBe(ACTOR);

    const tenders = await prisma.$queryRawUnsafe<Array<{ td_is_deleted: boolean }>>(
      `SELECT td_is_deleted FROM accounts.acc_tender_detail WHERE td_src_doc_id = $1::uuid`,
      voucherId,
    );
    expect(tenders).toHaveLength(2);
    expect(tenders.every((row) => row.td_is_deleted)).toBe(true);
  });

  it('files a DELETED event in txn_status_log, not a CANCELLED one', async () => {
    const voucherId = await createDraft();
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(201);

    const rows = await prisma.$queryRawUnsafe<Array<{ tsl_event: string; tsl_changed_by: string }>>(
      `SELECT tsl_event, tsl_changed_by
         FROM public.txn_status_log
        WHERE tsl_src_doc_id = $1::uuid
        ORDER BY tsl_changed_on DESC`,
      voucherId,
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].tsl_event).toBe('DELETED');
    expect(rows[0].tsl_changed_by).toBe(ACTOR);
    expect(rows.some((row) => row.tsl_event === 'CANCELLED')).toBe(false);
  });

  it('wrote no accounting on the way out — no legs, no adjustment rows', async () => {
    const voucherId = await createDraft();
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(201);

    const [counts] = await prisma.$queryRawUnsafe<Array<{ legs: bigint; adjustments: bigint }>>(
      `SELECT (SELECT count(*) FROM accounts.acc_vouchers
                WHERE av_voucher_id = $1::uuid) AS legs,
              (SELECT count(*) FROM accounts.acc_bill_adjustment
                WHERE abj_voucher_id = $1::uuid) AS adjustments`,
      voucherId,
    );

    expect(Number(counts.legs)).toBe(0);
    expect(Number(counts.adjustments)).toBe(0);
  });

  it('is gone from /get afterwards, and a second delete is a 404', async () => {
    const voucherId = await createDraft();
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(201);

    await request(app.getHttpServer())
      .get(GET)
      .query(keys(voucherId))
      .set('Authorization', BEARER)
      .expect(404);

    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(404);
  });

  it('refuses a POSTED receipt with a 409 naming /cancel', async () => {
    if (!fx.postedVoucherId) {
      // eslint-disable-next-line no-console
      console.warn('[receipt-delete e2e] no POSTED receipt on this database — case skipped');
      return;
    }

    const res = await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(fx.postedVoucherId));

    expect(res.status).toBe(409);
    const message = JSON.stringify(res.body);
    expect(message).toContain('cancel');
    expect(message).toContain(fx.postedRefno ?? fx.postedVoucherId);

    // And it is still there, untouched.
    const [header] = await prisma.$queryRawUnsafe<
      Array<{ avh_is_deleted: boolean; avh_voucher_status: string }>
    >(
      `SELECT avh_is_deleted, avh_voucher_status
         FROM accounts.acc_voucher_header
        WHERE avh_voucher_id = $1::uuid AND avh_acc_year = $2::bpchar`,
      fx.postedVoucherId,
      ACC_YEAR,
    );
    expect(header.avh_is_deleted).toBe(false);
    expect(header.avh_voucher_status).toBe('POSTED');
  });

  it('refuses the four keys pointing at another company — 404, never 403', async () => {
    const voucherId = await createDraft();

    // A caller scoped elsewhere must not learn that this receipt exists.
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), avhCompanyId: '019c8ea6-19e9-78a8-b15f-749e1cde7000' })
      .expect(404);

    // Still a live draft, so the real delete still works — and cleans up.
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(201);
  });

  it('takes the four keys and nothing else — a reason is a 400', async () => {
    const voucherId = await createDraft();

    // forbidNonWhitelisted. /cancel needs a reason because a posted receipt
    // has to be answered for; abandoning a half-keyed draft does not.
    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send({ ...keys(voucherId), reason: 'changed my mind' })
      .expect(400);

    await request(app.getHttpServer())
      .post(DELETE)
      .set('Authorization', BEARER)
      .send(keys(voucherId))
      .expect(201);
  });
});
