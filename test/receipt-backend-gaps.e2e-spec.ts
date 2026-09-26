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
 * The receipt backend gaps of 2026-09-18, each asserted against the live dev
 * database: R-B1 (scope + honest count), R-B3 (party-context 404), R-B4
 * (adjacent), R-B6 (duplicate-check), R-B7 / R-B8 (bill profit and the
 * customer's own reference) and R-B9 (party totals).
 *
 * Almost entirely READ-ONLY. The one exception is /regularise-pdc, which is a
 * write and is called deliberately: the whole of R-B1 is about what that route
 * reports, and it can only be shown by running it twice. It writes nothing but
 * derived cache columns, and only when they are wrong.
 *
 * Expectations are derived FROM the database rather than hard-coded, so the
 * suite still means something after the dev data moves on.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const BEARER = 'Bearer dummy-test-token';
const prisma = new PrismaClient();

interface RegisterRow {
  voucherId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  refno: string | null;
}

describe('receipt backend gaps (e2e, live DB)', () => {
  let app: INestApplication;
  // tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
  const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

  /** The receipt register, in the walk's own ascending key order. */
  let register: RegisterRow[] = [];
  let anyCompanyId = '';

  /**
   * The register, in the walk's own ascending key order — the same order
   * `/receipts/adjacent` steps through, written out here independently so the
   * route is checked against SQL rather than against itself.
   */
  const snapshotRegister = async (status?: string): Promise<RegisterRow[]> => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        avh_voucher_id: string;
        avh_acc_year: string;
        avh_company_id: string;
        avh_branch_id: string;
        avh_voucher_refno: string | null;
      }>
    >(
      `SELECT h.avh_voucher_id, h.avh_acc_year, h.avh_company_id,
              h.avh_branch_id, h.avh_voucher_refno
         FROM accounts.acc_voucher_header h
         JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        WHERE vt.vchr_type_code = 'Rct'
          AND h.avh_is_deleted = false
          AND h.avh_against_voucher_id IS NULL
          AND ($1::varchar IS NULL OR h.avh_voucher_status = $1::varchar)
        ORDER BY h.avh_voucher_date ASC,
                 COALESCE(h.avh_voucher_slno, 9223372036854775807) ASC,
                 h.avh_created_on ASC,
                 h.avh_voucher_id ASC`,
      status ?? null,
    );
    return rows.map((row) => ({
      voucherId: row.avh_voucher_id,
      accYear: row.avh_acc_year,
      companyId: row.avh_company_id,
      branchId: row.avh_branch_id,
      refno: row.avh_voucher_refno,
    }));
  };

  beforeAll(async () => {
    register = await snapshotRegister();
    anyCompanyId = register[0]?.companyId ?? '';

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
      user_type: 'SUPER ADMIN',
      company_id: anyCompanyId || null,
      branch_id: null,
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

  // ── R-B4 ────────────────────────────────────────────────────────────────

  /**
   * ── Why every walk here pins status=POSTED ─────────────────────────────
   * This suite reads a LIVE register that the other e2e suites in the same run
   * key drafts into and delete again. Walking the unfiltered register means
   * asserting that nobody else is using the database, which is not a property
   * of this route and cannot be made true.
   *
   * POSTED is the stable set: nothing else in the suite posts or cancels. And
   * pinning it is not a way around the problem — it is the route's own
   * `status` filter, which is the thing R-B4 asked for ("honouring the same
   * status filter the register uses"), so the walk is exercised exactly as the
   * client will use it against a filtered register.
   */
  describe('R-B4  GET /receipts/adjacent', () => {
    const STATUS = 'POSTED';

    /** The POSTED register for one (company, branch, year) — the walk's scope. */
    let posted: RegisterRow[] = [];

    beforeAll(async () => {
      const all = await snapshotRegister(STATUS);
      const first = all[0];
      posted = first
        ? all.filter(
            (row) =>
              row.companyId === first.companyId &&
              row.branchId === first.branchId &&
              row.accYear === first.accYear,
          )
        : [];
      if (posted.length === 0) {
        // eslint-disable-next-line no-console
        console.warn('[adjacent] no posted receipts in this database — nothing to walk');
      }
    });

    const walk = async (
      row: RegisterRow,
      direction: 'prev' | 'next',
      status: string | null = STATUS,
    ) =>
      request(app.getHttpServer())
        .get('/api/v1/receipts/adjacent')
        .set('Authorization', BEARER)
        .query({
          voucherId: row.voucherId,
          companyId: row.companyId,
          branchId: row.branchId,
          accYear: row.accYear,
          direction,
          ...(status ? { status } : {}),
        });

    it('walks the whole register forwards, one receipt at a time', async () => {
      if (posted.length === 0) {
        return;
      }

      const visited: string[] = [posted[0].voucherId];
      let cursor = posted[0];
      // Bounded well past the register's own length, so a walk that loops or
      // stalls fails here rather than hanging the suite.
      for (let step = 0; step < posted.length + 50; step += 1) {
        const response = await walk(cursor, 'next');
        expect(response.status).toBe(200);
        if (response.body.data.voucher === null) {
          break;
        }
        visited.push(response.body.data.voucher.voucherId);
        cursor = {
          ...cursor,
          voucherId: response.body.data.voucher.voucherId,
          accYear: response.body.data.voucher.accYear,
        };
      }

      // The register is LIVE — the amend suite posts receipts into it while
      // this runs — so the walk may legitimately meet a receipt that did not
      // exist when `posted` was snapshotted. Comparing against a fixed list
      // would assert that nobody else is using the database, which is not a
      // property of this route.
      //
      // So the invariants are asserted instead, against a SECOND snapshot
      // taken after the walk: nothing repeated, nothing skipped that was there
      // throughout, and the register's own order preserved. All three are
      // checked against SQL that states the ordering independently, not
      // against the route's own answer.
      const afterWalk = await snapshotRegister(STATUS);
      const afterOrder = afterWalk
        .filter(
          (row) =>
            row.companyId === posted[0].companyId &&
            row.branchId === posted[0].branchId &&
            row.accYear === posted[0].accYear,
        )
        .map((row) => row.voucherId);

      // 1. No receipt visited twice — a walk that looped would end here.
      expect(new Set(visited).size).toBe(visited.length);

      // 2. Nothing skipped: every receipt present both before and after.
      const throughout = posted.map((row) => row.voucherId).filter((id) => afterOrder.includes(id));
      expect(visited).toEqual(expect.arrayContaining(throughout));

      // 3. The order is the register's own, with nothing reordered.
      expect(visited).toEqual(afterOrder.filter((id) => visited.includes(id)));
    });

    it('prev is the exact inverse of next', async () => {
      if (posted.length < 2) {
        return;
      }
      // Stepped rather than indexed: whatever `next` returns from here, `prev`
      // from there must return this row again. That holds however many
      // receipts another suite posts in between, which indexing into a
      // snapshot does not.
      const forward = await walk(posted[0], 'next');
      expect(forward.status).toBe(200);
      expect(forward.body.data.voucher).not.toBeNull();

      const landed = forward.body.data.voucher as { voucherId: string; accYear: string };
      const back = await walk(
        { ...posted[0], voucherId: landed.voucherId, accYear: landed.accYear },
        'prev',
      );
      expect(back.status).toBe(200);
      expect(back.body.data.voucher?.voucherId).toBe(posted[0].voucherId);
    });

    it('answers null at both ends rather than wrapping around', async () => {
      if (posted.length === 0) {
        return;
      }
      // The register is a LIVE table and the amend suite posts receipts into
      // it. So the assertion is not "null" — it is "nothing beyond the end
      // that was already there". A receipt this snapshot has never seen was
      // keyed after we looked, and finding it is the route working.
      const known = new Set(posted.map((row) => row.voucherId));
      const beyondTheEnd = (body: { data: { voucher: { voucherId: string } | null } }): boolean =>
        body.data.voucher === null || !known.has(body.data.voucher.voucherId);

      const beforeFirst = await walk(posted[0], 'prev');
      expect(beforeFirst.status).toBe(200);
      expect(beyondTheEnd(beforeFirst.body)).toBe(true);

      const afterLast = await walk(posted[posted.length - 1], 'next');
      expect(afterLast.status).toBe(200);
      expect(beyondTheEnd(afterLast.body)).toBe(true);
    });

    it('every receipt it lands on satisfies the status filter it was given', async () => {
      if (posted.length < 2) {
        return;
      }
      const response = await walk(posted[0], 'next');
      expect(response.status).toBe(200);
      expect(response.body.data.voucher.status).toBe(STATUS);
    });

    it('404s on a voucher belonging to another company', async () => {
      if (posted.length === 0) {
        return;
      }
      const response = await request(app.getHttpServer())
        .get('/api/v1/receipts/adjacent')
        .set('Authorization', BEARER)
        .query({
          voucherId: posted[0].voucherId,
          companyId: '00000000-0000-4000-8000-000000000000',
          branchId: posted[0].branchId,
          accYear: posted[0].accYear,
          direction: 'next',
        });

      expect(response.status).toBe(404);
    });
  });

  // ── R-B6 ────────────────────────────────────────────────────────────────

  describe('R-B6  GET /receipts/duplicate-check', () => {
    it('finds a posted receipt by its own party, date and amount', async () => {
      const [existing] = await prisma.$queryRawUnsafe<
        Array<{
          avh_voucher_id: string;
          avh_company_id: string;
          avh_acc_year: string;
          avh_party_id: string;
          avh_voucher_date: Date;
          avh_doc_amount: string;
        }>
      >(
        `SELECT h.avh_voucher_id, h.avh_company_id, h.avh_acc_year, h.avh_party_id,
                h.avh_voucher_date, h.avh_doc_amount::text
           FROM accounts.acc_voucher_header h
           JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
          WHERE vt.vchr_type_code = 'Rct'
            AND h.avh_is_deleted = false
            AND h.avh_against_voucher_id IS NULL
            AND h.avh_voucher_status <> 'CANCELLED'
            AND h.avh_doc_amount > 0
          LIMIT 1`,
      );
      if (!existing) {
        return;
      }
      const onDate = existing.avh_voucher_date.toISOString().slice(0, 10);

      const hit = await request(app.getHttpServer())
        .get('/api/v1/receipts/duplicate-check')
        .set('Authorization', BEARER)
        .query({
          partyId: existing.avh_party_id,
          companyId: existing.avh_company_id,
          accYear: existing.avh_acc_year,
          voucherDate: onDate,
          amount: Number(existing.avh_doc_amount),
        });

      expect(hit.status).toBe(200);
      expect(hit.body.data.isDuplicate).toBe(true);
      expect(hit.body.data.matches.map((m: { voucherId: string }) => m.voucherId)).toContain(
        existing.avh_voucher_id,
      );

      // excludeVoucherId must take that very receipt back out again.
      const excluded = await request(app.getHttpServer())
        .get('/api/v1/receipts/duplicate-check')
        .set('Authorization', BEARER)
        .query({
          partyId: existing.avh_party_id,
          companyId: existing.avh_company_id,
          accYear: existing.avh_acc_year,
          voucherDate: onDate,
          amount: Number(existing.avh_doc_amount),
          excludeVoucherId: existing.avh_voucher_id,
        });

      expect(excluded.status).toBe(200);
      expect(
        excluded.body.data.matches.map((m: { voucherId: string }) => m.voucherId),
      ).not.toContain(existing.avh_voucher_id);

      // An amount nobody has ever received is not a duplicate — and is a 200,
      // never a refusal.
      const miss = await request(app.getHttpServer())
        .get('/api/v1/receipts/duplicate-check')
        .set('Authorization', BEARER)
        .query({
          partyId: existing.avh_party_id,
          companyId: existing.avh_company_id,
          accYear: existing.avh_acc_year,
          voucherDate: onDate,
          amount: 987654321.11,
        });

      expect(miss.status).toBe(200);
      expect(miss.body.data.isDuplicate).toBe(false);
      expect(miss.body.data.matches).toEqual([]);
    });
  });

  // ── R-B3 and R-B9 ───────────────────────────────────────────────────────

  describe('R-B3 / R-B9  GET /receipts/party-context', () => {
    it('404s on a party that does not exist, as open-items already does', async () => {
      if (!anyCompanyId) {
        return;
      }
      const ghost = '00000000-0000-4000-8000-0000000000ff';

      const context = await request(app.getHttpServer())
        .get('/api/v1/receipts/party-context')
        .set('Authorization', BEARER)
        .query({ partyId: ghost, companyId: anyCompanyId });

      const openItems = await request(app.getHttpServer())
        .get('/api/v1/receipts/open-items')
        .set('Authorization', BEARER)
        .query({ partyId: ghost, companyId: anyCompanyId });

      expect(context.status).toBe(404);
      // The two routes are called by the same screen; they must agree.
      expect(context.status).toBe(openItems.status);
    });

    it('reports totals that match the bills themselves', async () => {
      const [party] = await prisma.$queryRawUnsafe<
        Array<{ abl_party_id: string; abl_company_id: string; dr: string; cr: string }>
      >(
        `SELECT b.abl_party_id, b.abl_company_id,
                COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_dr_cr = 'DR'), 0)::text AS dr,
                COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_dr_cr = 'CR'), 0)::text AS cr
           FROM accounts.acc_bill_balance b
          WHERE b.abl_is_deleted = false AND b.abl_is_active = true
          GROUP BY 1, 2
         HAVING COALESCE(SUM(b.abl_pending_amount), 0) <> 0
          LIMIT 1`,
      );
      if (!party) {
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/receipts/party-context')
        .set('Authorization', BEARER)
        .query({ partyId: party.abl_party_id, companyId: party.abl_company_id });

      // Read the truth again AFTER the call. The amend suite settles and
      // reopens bills on this same company while this runs, so the endpoint's
      // answer is correct if it matches the balance at either end of the
      // window it was served in — pinning it to a snapshot taken beforehand
      // asserts that nobody else is using the database, which is not a
      // property of this route.
      const [settled] = await prisma.$queryRawUnsafe<Array<{ dr: string; cr: string }>>(
        `SELECT COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_dr_cr = 'DR'), 0)::text AS dr,
                COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_dr_cr = 'CR'), 0)::text AS cr
           FROM accounts.acc_bill_balance b
          WHERE b.abl_is_deleted = false AND b.abl_is_active = true
            AND b.abl_party_id = $1::uuid AND b.abl_company_id = $2::uuid`,
        party.abl_party_id,
        party.abl_company_id,
      );

      expect(response.status).toBe(200);
      const summary = response.body.data.summary;
      expect([Number(party.dr), Number(settled.dr)]).toContainEqual(summary.totalOutstanding);
      expect([Number(party.cr), Number(settled.cr)]).toContainEqual(summary.totalCredits);
      // Whatever the two halves were, the net must be their difference.
      expect(summary.totalBalance).toBeCloseTo(summary.totalOutstanding - summary.totalCredits, 2);
      expect(typeof response.body.data.partyName).toBe('string');
    });
  });

  // ── R-B7 and R-B8 ───────────────────────────────────────────────────────

  describe('R-B7 / R-B8  GET /receipts/open-items', () => {
    it("carries the customer's own reference and the bill's margin", async () => {
      const [bill] = await prisma.$queryRawUnsafe<
        Array<{
          abl_party_id: string;
          abl_company_id: string;
          abl_id: string;
          sb_usr_refno: string | null;
          profit: string | null;
          incomplete: boolean;
        }>
      >(
        `SELECT b.abl_party_id, b.abl_company_id, b.abl_id, sb.sb_usr_refno,
                SUM(i.sbi_item_profit * i.sbi_net_qty)::text AS profit,
                bool_or(i.sbi_item_profit IS NULL) AS incomplete
           FROM accounts.acc_bill_balance b
           JOIN sales.sale_bill sb
             ON sb.sb_id = b.abl_src_doc_id AND sb.sb_acc_year = b.abl_src_acc_year
           LEFT JOIN sales.sale_bill_item i
             ON i.sbi_bill_id = sb.sb_id AND i.sbi_acc_year = sb.sb_acc_year
            AND i.sbi_is_deleted = false
          WHERE b.abl_is_deleted = false AND b.abl_is_active = true
            AND b.abl_dr_cr = 'DR' AND b.abl_pending_amount > 0
            AND b.abl_src_module = 'SALES' AND b.abl_src_doc_type = 'BILL'
          GROUP BY 1, 2, 3, 4
          LIMIT 1`,
      );
      if (!bill) {
        // eslint-disable-next-line no-console
        console.warn('[open-items] no open bill with a sale bill behind it — nothing to check');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/receipts/open-items')
        .set('Authorization', BEARER)
        .query({ partyId: bill.abl_party_id, companyId: bill.abl_company_id });

      expect(response.status).toBe(200);
      const row = response.body.data.bills.find(
        (candidate: { billId: string }) => candidate.billId === bill.abl_id,
      );
      expect(row).toBeDefined();

      // R-B8 — the field exists and carries the INVOICE's reference, not ours.
      expect(row).toHaveProperty('usrRefno');
      expect(row.usrRefno).toBe(bill.sb_usr_refno);

      // R-B7 — per-unit profit summed against quantity, and null rather than a
      // partial sum when any line was never costed.
      expect(row).toHaveProperty('billProfit');
      if (bill.incomplete || bill.profit === null) {
        expect(row.billProfit).toBeNull();
      } else {
        expect(row.billProfit).toBeCloseTo(Number(bill.profit), 2);
      }
    });
  });

  // ── R-B2 ────────────────────────────────────────────────────────────────

  describe('R-B2  PUT /receipts/update-header', () => {
    it('refuses two collectors, exactly as /receipts/create does', async () => {
      const [posted] = await prisma.$queryRawUnsafe<
        Array<{
          avh_voucher_id: string;
          avh_company_id: string;
          avh_branch_id: string;
          avh_acc_year: string;
        }>
      >(
        `SELECT h.avh_voucher_id, h.avh_company_id, h.avh_branch_id, h.avh_acc_year
           FROM accounts.acc_voucher_header h
           JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
          WHERE vt.vchr_type_code = 'Rct'
            AND h.avh_voucher_status = 'POSTED'
            AND h.avh_is_deleted = false
            AND h.avh_against_voucher_id IS NULL
          LIMIT 1`,
      );
      if (!posted) {
        // eslint-disable-next-line no-console
        console.warn('[update-header] no posted receipt — nothing to check');
        return;
      }

      const before = await prisma.$queryRawUnsafe<Array<{ avh_employee_id: string[] }>>(
        `SELECT avh_employee_id FROM accounts.acc_voucher_header
          WHERE avh_voucher_id = $1::uuid AND avh_acc_year = $2::bpchar`,
        posted.avh_voucher_id,
        posted.avh_acc_year,
      );

      const response = await request(app.getHttpServer())
        .put('/api/v1/receipts/update-header')
        .set('Authorization', BEARER)
        .send({
          avhVoucherId: posted.avh_voucher_id,
          avhCompanyId: posted.avh_company_id,
          avhBranchId: posted.avh_branch_id,
          avhAccYear: posted.avh_acc_year,
          avhEmployeeId: [
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
          ],
          editRemark: 'E2E: two collectors must be refused',
        });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('ONE person');

      // The refusal happens before the write, so the receipt is untouched.
      const after = await prisma.$queryRawUnsafe<Array<{ avh_employee_id: string[] }>>(
        `SELECT avh_employee_id FROM accounts.acc_voucher_header
          WHERE avh_voucher_id = $1::uuid AND avh_acc_year = $2::bpchar`,
        posted.avh_voucher_id,
        posted.avh_acc_year,
      );
      expect(after[0].avh_employee_id).toEqual(before[0].avh_employee_id);
    });
  });

  // ── R-B1 ────────────────────────────────────────────────────────────────

  describe('R-B1  POST /receipts/regularise-pdc', () => {
    it('refuses a call with no company', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/receipts/regularise-pdc')
        .set('Authorization', BEARER)
        .send({});

      expect(response.status).toBe(400);
    });

    it('reports rows CHANGED, so a second run over the same data reports none', async () => {
      if (!anyCompanyId) {
        return;
      }
      const run = async () =>
        request(app.getHttpServer())
          .post('/api/v1/receipts/regularise-pdc')
          .set('Authorization', BEARER)
          .send({ companyId: anyCompanyId });

      const first = await run();
      expect(first.status).toBe(201);
      expect(first.body.data.companyId).toBe(anyCompanyId);

      const second = await run();
      expect(second.status).toBe(201);
      // The point of R-B1's second half: the sweep is idempotent, so the
      // second run moves nothing and must say so.
      expect(second.body.data.billsRegularised).toBe(0);
      // ...while still reporting that it looked.
      expect(second.body.data.billsExamined).toBe(first.body.data.billsExamined);
    });

    it('sweeps only the company it was given', async () => {
      const companies = await prisma.$queryRawUnsafe<Array<{ abj_company_id: string }>>(
        `SELECT DISTINCT abj_company_id FROM accounts.acc_bill_adjustment
          WHERE abj_is_post_dated = true AND abj_is_deleted = false`,
      );
      if (companies.length === 0) {
        return;
      }
      const response = await request(app.getHttpServer())
        .post('/api/v1/receipts/regularise-pdc')
        .set('Authorization', BEARER)
        .send({ companyId: '00000000-0000-4000-8000-000000000000' });

      expect(response.status).toBe(201);
      // A company with no rows of its own examines nothing, however many rows
      // other companies hold.
      expect(response.body.data.billsExamined).toBe(0);
    });
  });
});
