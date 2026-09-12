import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * ALL SEVEN ROUTES OF /api/v1/stock/physical, each asked the same question as
 * the opening-stock suite: which tables does this call write?
 *
 * Every case counts all eleven candidate tables before the request and again
 * after. acc_voucher_seq is additionally read BY VALUE, because an UPDATE has
 * no row delta.
 *
 * A COUNT IS NOT AN OPENING. It moves stock BOTH ways in one document —
 * PHYSICAL_PLUS on an overage line, PHYSICAL_MINUS on a shortage — and its
 * quantity is svi_diff_qty (counted − book), which is GENERATED. So the
 * fixtures here are real holdings read off the count sheet, not new items.
 *
 * NET EFFECT ON STOCK IS ZERO: every count posted is cancelled, and the
 * reversal puts the variance back. The freeze case is cancelled in a finally
 * block, because a DRAFT count's freeze blocks every other movement in that
 * godown until it is.
 */

const BASE = '/api/v1/stock/physical';
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-09-10';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  godownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();

const WATCHED: Array<[string]> = [
  ['stock.stock_voucher'],
  ['stock.stock_voucher_item'],
  ['stock.stock_ledger'],
  ['stock.stock_lot'],
  ['stock.stock_balance'],
  ['stock.stock_item_cost'],
  ['public.txn_status_log'],
  ['audit.audit_log'],
  ['accounts.acc_voucher_seq'],
  ['accounts.acc_voucher_header'],
  ['stock.stock_transit'],
];

async function snapshot(): Promise<{ counts: Record<string, number>; seqLastNo: number | null }> {
  const counts: Record<string, number> = {};
  for (const [table] of WATCHED) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM ${table}`,
    );
    counts[table] = Number(row.n);
  }
  // Row 6 is Physical Stock — prefix PHY, width 4.
  const [seq] = await prisma.$queryRaw<Array<{ seq_last_no: number }>>`
    SELECT seq_last_no FROM accounts.acc_voucher_seq
     WHERE seq_vchr_type_id = 6
       AND seq_company_id = ${SCOPE.companyId}::uuid
       AND seq_branch_id  = ${SCOPE.branchId}::uuid
       AND seq_acc_year   = ${ACC_YEAR}`;
  return { counts, seqLastNo: seq ? Number(seq.seq_last_no) : null };
}

const report: Array<Record<string, unknown>> = [];

interface CountRow {
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemName?: string;
  godownId: string;
  bucket: string;
  lotId: string;
  bookQty: number;
}

describe('/stock/physical — all 7 routes, which tables each one writes', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-physical-all',
      user_type: 'SUPER ADMIN',
      company_id: SCOPE.companyId,
      branch_id: SCOPE.branchId,
      device_id: SCOPE.deviceId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (): AccessTokenPayload => claims })
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
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix('api');
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n===== TABLES WRITTEN, BY ROUTE =====\n' + JSON.stringify(report, null, 2));
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  async function probe(
    route: string,
    label: string,
    send: () => request.Test,
    note?: string,
  ): Promise<{ status: number; body: any }> {
    const before = await snapshot();
    const res = await send();
    const after = await snapshot();
    const wrote: Record<string, unknown> = {};
    for (const [table] of WATCHED) {
      const d = after.counts[table] - before.counts[table];
      if (d !== 0) wrote[table] = d;
    }
    if (before.seqLastNo !== after.seqLastNo) {
      wrote['accounts.acc_voucher_seq'] =
        `UPDATE seq_last_no ${before.seqLastNo} → ${after.seqLastNo}`;
    }
    report.push({
      route,
      case: label,
      status: res.status,
      message: res.body?.message,
      ...(res.body?.errors ? { errors: res.body.errors } : {}),
      wrote,
      ...(note ? { note } : {}),
    });
    return { status: res.status, body: res.body };
  }

  const scopeQuery = { accYear: ACC_YEAR, companyId: SCOPE.companyId, branchId: SCOPE.branchId };

  function header(over: Record<string, unknown> = {}) {
    return {
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      deviceId: SCOPE.deviceId,
      docDate: DOC_DATE,
      toGodownId: SCOPE.godownId,
      userId: ACTOR,
      remarks: 'E2E-PHY table-fill probe',
      ...over,
    };
  }

  /** A count line is a holding from the sheet plus ONE number: what was found. */
  function countLine(row: CountRow, lineNo: number, countedQty: number) {
    return {
      lineNo,
      splitNo: row.splitNo,
      itemId: row.itemId,
      godownId: row.godownId,
      bucket: row.bucket,
      lotId: row.lotId,
      countedQty,
    };
  }

  let sheet: CountRow[] = [];
  // THREE DISTINCT HOLDINGS. Two documents counting the SAME lot is not a test
  // of anything except the drift check — the first post changes the book figure
  // the second was written against, and the second is then correctly refused.
  // That guard gets its own case at the bottom of the file.
  let overage: CountRow;
  let shortage: CountRow | undefined;
  let savePostLot: CountRow;
  let draftId = '';
  let savePostId = '';
  const VARIANCE = 5;

  // ── 1. GET /count-sheet ─────────────────────────────────────────────────
  it('GET /count-sheet — a read, creates nothing', async () => {
    const res = await probe(
      'GET /count-sheet',
      'generate the sheet for one godown',
      () =>
        http
          .get(`${BASE}/count-sheet`)
          .set('Authorization', BEARER)
          .query({ ...scopeQuery, godownId: SCOPE.godownId }),
      'one line per godown × lot × bucket, straight from stock_balance',
    );
    expect(res.status).toBe(200);
    sheet = res.body.data.items as CountRow[];
    expect(sheet.length).toBeGreaterThan(0);
    // Only holdings with stock on them: a lot at book 0 cannot be counted short.
    const usable = sheet.filter((r) => Number(r.bookQty) >= 1);
    expect(usable.length).toBeGreaterThanOrEqual(3);
    overage = usable[0];
    shortage = usable[1];
    savePostLot = usable[2];

    const bad = await probe('GET /count-sheet', 'godownId missing', () =>
      http.get(`${BASE}/count-sheet`).set('Authorization', BEARER).query(scopeQuery),
    );
    expect(bad.status).toBe(400);

    const noAuth = await probe('GET /count-sheet', 'no Authorization header', () =>
      http.get(`${BASE}/count-sheet`).query({ ...scopeQuery, godownId: SCOPE.godownId }),
    );
    expect(noAuth.status).toBe(401);
  }, 60_000);

  // ── 2. POST /create ─────────────────────────────────────────────────────
  it('POST /create — a DRAFT count, one line over and one short', async () => {
    const lines = [countLine(overage, 1, Number(overage.bookQty) + VARIANCE)];
    if (shortage) lines.push(countLine(shortage, 2, Number(shortage.bookQty) - 1));

    const res = await probe(
      'POST /create',
      `DRAFT count (${lines.length} line${lines.length > 1 ? 's' : ''}: +${VARIANCE}${shortage ? ', −1' : ''})`,
      () => http.post(`${BASE}/create`).set('Authorization', BEARER).send({ header: header(), lines }),
      'svi_book_qty is READ from stock_balance, never taken from the payload',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.header.status).toBe('DRAFT');
    expect(res.body.data.header.refno).toMatch(/^PHY\d{4}$/);
    draftId = res.body.data.header.svhId;
  }, 60_000);

  it('POST /create — status POSTED saves and posts in one call', async () => {
    const res = await probe(
      'POST /create',
      'status: "POSTED" (save-and-post)',
      () =>
        http
          .post(`${BASE}/create`)
          .set('Authorization', BEARER)
          .send({
            header: header({ status: 'POSTED' }),
            lines: [countLine(savePostLot, 1, Number(savePostLot.bookQty) + VARIANCE)],
          }),
      'the controller @ApiOperation says "the saved status is always DRAFT" — it is not',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.header.status).toBe('POSTED');
    savePostId = res.body.data.header.svhId;
  }, 60_000);

  it('POST /create — a lotId with no live balance row is refused', async () => {
    const res = await probe('POST /create', 'lotId that is not a live holding', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send({
          header: header(),
          lines: [countLine({ ...overage, lotId: MISSING_UUID }, 1, 1)],
        }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  // ── 3. GET /get ─────────────────────────────────────────────────────────
  it('GET /get — lists without svhId, loads one with it', async () => {
    const list = await probe(
      'GET /get',
      'list counts for the scope (no svhId)',
      () => http.get(`${BASE}/get`).set('Authorization', BEARER).query({ ...scopeQuery, limit: 5 }),
      'this route lists as well as loads — the opening route does not',
    );
    expect(list.status).toBe(200);

    const one = await probe('GET /get', 'load one count by svhId', () =>
      http.get(`${BASE}/get`).set('Authorization', BEARER).query({ ...scopeQuery, svhId: draftId }),
    );
    expect(one.status).toBe(200);
    expect(one.body.data.header.svhId).toBe(draftId);
  }, 60_000);

  // ── 4. GET /validate ────────────────────────────────────────────────────
  it('GET /validate — advisory preflight, writes nothing', async () => {
    const res = await probe(
      'GET /validate',
      'preflight the draft count',
      () =>
        http
          .get(`${BASE}/validate`)
          .set('Authorization', BEARER)
          .query({ ...scopeQuery, svhId: draftId }),
      'returns EVERY line, including the ones that agree',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.filter((r: any) => r.problem !== null)).toHaveLength(0);
  }, 60_000);

  // ── 5. POST /post ───────────────────────────────────────────────────────
  it('POST /post — the movement tables, both directions at once', async () => {
    const res = await probe(
      'POST /post',
      'post the draft count',
      () =>
        http
          .post(`${BASE}/post`)
          .set('Authorization', BEARER)
          .send({ svhId: draftId, ...scopeQuery, userId: ACTOR }),
      'PHYSICAL_PLUS on the overage line, PHYSICAL_MINUS on the shortage',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.rowsPosted).toBeGreaterThanOrEqual(1);

    const again = await probe('POST /post', 'post it a second time', () =>
      http
        .post(`${BASE}/post`)
        .set('Authorization', BEARER)
        .send({ svhId: draftId, ...scopeQuery, userId: ACTOR }),
    );
    expect(again.status).toBe(409);

    const missing = await probe('POST /post', 'an svhId that does not exist', () =>
      http
        .post(`${BASE}/post`)
        .set('Authorization', BEARER)
        .send({ svhId: MISSING_UUID, ...scopeQuery, userId: ACTOR }),
    );
    expect(missing.status).toBe(404);
  }, 90_000);

  // ── 6. GET /variance ────────────────────────────────────────────────────
  it('GET /variance — the report, writes nothing', async () => {
    const res = await probe(
      'GET /variance',
      'variance for the posted count',
      () =>
        http
          .get(`${BASE}/variance`)
          .set('Authorization', BEARER)
          .query({ ...scopeQuery, svhId: draftId, limit: 10, offset: 0 }),
      'book vs counted vs difference, per line',
    );
    expect(res.status).toBe(200);
  }, 60_000);

  // ── 7. POST /cancel ─────────────────────────────────────────────────────
  it('POST /cancel — reverses both posted counts, netting the branch to zero', async () => {
    const a = await probe('POST /cancel', 'cancel the posted count', () =>
      http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({
          svhId: draftId,
          ...scopeQuery,
          userId: ACTOR,
          reason: 'E2E-PHY table-fill probe — reversing so the branch nets to zero',
        }),
    );
    expect(a.status).toBe(201);
    expect(a.body.data.rowsReversed).toBeGreaterThanOrEqual(1);

    const b = await probe('POST /cancel', 'cancel the save-and-post count', () =>
      http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({
          svhId: savePostId,
          ...scopeQuery,
          userId: ACTOR,
          reason: 'E2E-PHY table-fill probe — reversing so the branch nets to zero',
        }),
    );
    expect(b.status).toBe(201);

    const twice = await probe('POST /cancel', 'cancel it again', () =>
      http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({
          svhId: savePostId,
          ...scopeQuery,
          userId: ACTOR,
          reason: 'E2E-PHY second cancel',
        }),
    );
    expect(twice.status).toBeGreaterThanOrEqual(400);
  }, 90_000);

  // ── The drift check, on purpose ─────────────────────────────────────────
  it('POST /post — refuses a sheet whose book figure moved under it', async () => {
    // Draft D counts lot X at its current book figure...
    const drifted = await probe('POST /create', 'DRAFT counting a lot at book (for the drift case)', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send({ header: header(), lines: [countLine(shortage!, 1, Number(shortage!.bookQty))] }),
    );
    expect(drifted.status).toBe(201);
    const driftedId = drifted.body.data.header.svhId;

    // ...then a second count moves the same holding and posts.
    const mover = await probe('POST /create', 'a second count posts a variance on that same lot', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send({
          header: header({ status: 'POSTED' }),
          lines: [countLine(shortage!, 1, Number(shortage!.bookQty) + 1)],
        }),
    );
    expect(mover.status).toBe(201);
    const moverId = mover.body.data.header.svhId;

    // D's book figure is now stale, and the preflight says so rather than
    // posting a variance measured against a quantity that no longer exists.
    const refused = await probe(
      'POST /post',
      'post the draft whose book figure moved',
      () =>
        http
          .post(`${BASE}/post`)
          .set('Authorization', BEARER)
          .send({ svhId: driftedId, ...scopeQuery, userId: ACTOR }),
      'THE drift check — "the book quantity has changed since this sheet was generated"',
    );
    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.body.errors)).toContain('book quantity has changed');

    for (const id of [moverId, driftedId]) {
      await http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({ svhId: id, ...scopeQuery, userId: ACTOR, reason: 'E2E-PHY drift probe — reversing' });
    }
  }, 120_000);

  // ── The freeze, cancelled in a finally block ────────────────────────────
  it('POST /create with freezeStock — the one voucher type that may freeze a godown', async () => {
    let frozenId = '';
    try {
      const res = await probe(
        'POST /create',
        'DRAFT count with freezeStock: true',
        () =>
          http
            .post(`${BASE}/create`)
            .set('Authorization', BEARER)
            .send({
              header: header({
                freezeStock: true,
                freezeFrom: `${DOC_DATE}T00:00:00.000Z`,
                freezeTo: `${DOC_DATE}T23:59:59.000Z`,
              }),
              lines: [countLine(savePostLot, 1, Number(savePostLot.bookQty))],
            }),
        'while this DRAFT stands, tr_sml_freeze_guard refuses every other movement in the godown (409)',
      );
      expect(res.status).toBe(201);
      frozenId = res.body.data.header.svhId;
      expect(res.body.data.header.freezeStock).toBe(true);
    } finally {
      if (frozenId) {
        await http
          .post(`${BASE}/cancel`)
          .set('Authorization', BEARER)
          .send({
            svhId: frozenId,
            ...scopeQuery,
            userId: ACTOR,
            reason: 'E2E-PHY freeze probe — lifting the freeze',
          });
      }
    }
  }, 90_000);
});
