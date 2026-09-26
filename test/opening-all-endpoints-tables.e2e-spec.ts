import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * ALL EIGHT ROUTES OF /api/v1/stock/opening, each one asked the same question:
 * which tables does this call write?
 *
 * Every case counts all eleven candidate tables before the request and again
 * after, and reports the delta. The three at the bottom of WATCHED are there to
 * be asserted at zero — an opening posts no debit and no credit, ships nothing
 * and reserves nothing, and a route that started doing so would show up here.
 *
 * A row-count delta cannot see an UPDATE, so acc_voucher_seq is read by VALUE
 * as well: it is written on every create and inserted on none.
 *
 * Auth is stubbed at the PROVIDER level, never at the guard, so the real
 * AccessTokenGuard, ValidationPipe, versioning and exception filters all run.
 * NET EFFECT ON STOCK IS ZERO: anything this posts, it cancels.
 */

const BASE = '/api/v1/stock/opening';
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-04-01';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  godownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();
const tag = Date.now().toString(36).toUpperCase();

const WATCHED: Array<[string, string]> = [
  ['stock.stock_voucher', 'svh_id'],
  ['stock.stock_voucher_item', 'svi_id'],
  ['stock.stock_ledger', 'sml_id'],
  ['stock.stock_lot', 'slt_id'],
  ['stock.stock_balance', 'sbl_id'],
  ['stock.stock_item_cost', 'sic_id'],
  ['public.txn_status_log', 'tsl_id'],
  ['audit.audit_log', 'log_id'],
  ['accounts.acc_voucher_seq', 'seq_id'],
  ['accounts.acc_voucher_header', 'vhd_id'],
  ['stock.stock_transit', 'stt_id'],
];

type Counts = Record<string, number>;

/** Row counts, plus the sequence counter READ BY VALUE — an UPDATE has no delta. */
async function snapshot(): Promise<{ counts: Counts; seqLastNo: number | null }> {
  const counts: Counts = {};
  for (const [table] of WATCHED) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM ${table}`,
    );
    counts[table] = Number(row.n);
  }
  const [seq] = await prisma.$queryRaw<Array<{ seq_last_no: number }>>`
    SELECT seq_last_no FROM accounts.acc_voucher_seq
     WHERE seq_vchr_type_id = 1
       AND seq_company_id = ${SCOPE.companyId}::uuid
       AND seq_branch_id  = ${SCOPE.branchId}::uuid
       AND seq_acc_year   = ${ACC_YEAR}`;
  return { counts, seqLastNo: seq ? Number(seq.seq_last_no) : null };
}

const report: Array<Record<string, unknown>> = [];

describe('/stock/opening — all 8 routes, which tables each one writes', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const createdItems: string[] = [];

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-opening-all',
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
    for (const itemId of createdItems) {
      try {
        await prisma.$executeRaw`DELETE FROM inventory.item_unit_conversion WHERE iuc_item_id = ${itemId}::uuid`;
        await prisma.$executeRaw`DELETE FROM inventory.item_master WHERE item_id = ${itemId}::uuid`;
      } catch {
        // a posted document still points at it — left, labelled E2E-ALL-*
      }
    }
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  /**
   * Runs one request with the whole database counted either side of it and
   * files the delta under the route's name.
   */
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

  async function makeItem(code: string): Promise<{ itemId: string; iucId: string; code: string }> {
    const [group] = await prisma.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
    const [unit] = await prisma.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master WHERE unit_name = 'PCS' LIMIT 1`;
    const item = await prisma.itemMaster.create({
      data: {
        itemCode: code,
        itemNameEn: `${code} (e2e)`,
        itemGroupId: group.itg_id,
        itemCompanyId: SCOPE.companyId,
        itemBranchId: SCOPE.branchId,
      },
      select: { itemId: true },
    });
    createdItems.push(item.itemId);
    const iuc = await prisma.itemUnitConversion.create({
      data: {
        iucItemId: item.itemId,
        iucUnitId: unit.unit_id,
        iucBaseUnitId: unit.unit_id,
        iucToBaseFactor: 1,
        iucUnitSlno: 1,
        iucIsBaseUnit: true,
        // The lookup needs a default unit, or an explicit uomId on the query.
        iucIsDefaultUnit: true,
      },
      select: { iucId: true },
    });
    return { itemId: item.itemId, iucId: iuc.iucId, code };
  }

  function createBody(items: Array<{ itemId: string; iucId: string }>) {
    return {
      header: {
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: DOC_DATE,
        toGodownId: SCOPE.godownId,
        lineCount: items.length,
        totalQty: 10 * items.length,
        totalValue: 200 * items.length,
        totalValueWot: 190.48 * items.length,
        rateSource: 'MANUAL',
        userId: ACTOR,
        voucherType: 'OPENING',
      },
      lines: items.map((item, i) => ({
        lineNo: i + 1,
        splitNo: 1,
        itemId: item.itemId,
        uomId: item.iucId,
        baseUomId: item.iucId,
        toBaseFactor: 1,
        godownId: SCOPE.godownId,
        bucket: 'SALEABLE',
        qty: 10,
        baseQty: 10,
        freeQty: 0,
        freeBaseQty: 0,
        costRate: 20,
        costRateWot: 0,
        landedRate: 0,
        taxPerc: 5,
      })),
    };
  }

  const scopeQuery = {
    accYear: ACC_YEAR,
    companyId: SCOPE.companyId,
    branchId: SCOPE.branchId,
  };

  let itemA: { itemId: string; iucId: string; code: string };
  let itemB: { itemId: string; iucId: string; code: string };
  let svhId = '';
  let draftOnlyId = '';

  // ── 1. GET /item-lookup ─────────────────────────────────────────────────
  it('GET /item-lookup — reads, writes nothing', async () => {
    itemA = await makeItem(`E2E-ALL-A-${tag}`);
    itemB = await makeItem(`E2E-ALL-B-${tag}`);

    const ok = await probe('GET /item-lookup', 'a pickable item', () =>
      http.get(`${BASE}/item-lookup`).set('Authorization', BEARER).query({
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        itemId: itemA.itemId,
        onDate: DOC_DATE,
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.alreadyOpened).toBe(false);

    const missing = await probe('GET /item-lookup', 'an item that does not exist', () =>
      http.get(`${BASE}/item-lookup`).set('Authorization', BEARER).query({
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        itemId: MISSING_UUID,
        onDate: DOC_DATE,
      }),
    );
    expect(missing.status).toBe(404);
  }, 60_000);

  // ── 2. POST /create ─────────────────────────────────────────────────────
  it('POST /create — the document tables, and the number series', async () => {
    const res = await probe('POST /create', 'create a DRAFT', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send(createBody([itemA])),
    );
    expect(res.status).toBe(201);
    svhId = res.body.data.header.svhId;

    const second = await probe('POST /create', 'create a second DRAFT (cancelled later)', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send(createBody([itemB])),
    );
    expect(second.status).toBe(201);
    draftOnlyId = second.body.data.header.svhId;
  }, 60_000);

  // ── 3. GET /get ─────────────────────────────────────────────────────────
  it('GET /get — reads one document, writes nothing', async () => {
    const res = await probe('GET /get', 'load the draft by svhId', () =>
      http
        .get(`${BASE}/get`)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, svhId }),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.header.svhId).toBe(svhId);

    const missing = await probe('GET /get', 'an svhId that does not exist', () =>
      http
        .get(`${BASE}/get`)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, svhId: MISSING_UUID }),
    );
    expect(missing.status).toBe(404);
  }, 60_000);

  // ── 4. GET /validate ────────────────────────────────────────────────────
  it('GET /validate — the preflight is advisory and writes nothing', async () => {
    const res = await probe(
      'GET /validate',
      'preflight a clean draft',
      () =>
        http
          .get(`${BASE}/validate`)
          .set('Authorization', BEARER)
          .query({ ...scopeQuery, svhId }),
      'resolves the lot the way the engine would, WITHOUT creating it',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.every((row: any) => row.problem === null)).toBe(true);
  }, 60_000);

  // ── 5. POST /import ─────────────────────────────────────────────────────
  it('POST /import — replaces the draft lines from a CSV', async () => {
    const csv = ['item_code,unit,qty,cost_rate', `${itemA.code},PCS,15,22`].join('\n');
    const res = await probe(
      'POST /import',
      "replace a DRAFT's lines from CSV",
      () =>
        http
          .post(`${BASE}/import`)
          .set('Authorization', BEARER)
          .field('svhId', svhId)
          .field('accYear', ACC_YEAR)
          .field('companyId', SCOPE.companyId)
          .field('branchId', SCOPE.branchId)
          .field('userId', ACTOR)
          .attach('file', Buffer.from(csv, 'utf8'), 'opening.csv'),
      'BROKEN — see the assertion below. Cannot reach the save path at all.',
    );
    // THIS ROUTE CANNOT SUCCEED, and the cause is not the request.
    //
    // ImportOpeningStockVoucherDto declares `file?: unknown` to make Swagger
    // render a file picker. tsconfig targets ES2022, so useDefineForClassFields
    // is on and that declaration emits a REAL own property on every instance
    // class-transformer builds — value undefined, but present. It carries no
    // class-validator decorator, so it is not whitelisted, and
    // forbidNonWhitelisted refuses the request before the handler runs.
    //
    // Multer is working correctly: req.file is populated and req.body holds
    // only the four text fields. The rejected `file` is the DTO's own field.
    //
    // Fix: drop the property and keep @ApiBody's schema, or decorate it with
    // @IsOptional(). Then flip this expectation back to 200 and the table
    // deltas below become measurable.
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: 'request', message: 'property file should not exist' },
    ]);

    const noFile = await probe('POST /import', 'no file attached', () =>
      http
        .post(`${BASE}/import`)
        .set('Authorization', BEARER)
        .field('svhId', svhId)
        .field('accYear', ACC_YEAR)
        .field('companyId', SCOPE.companyId)
        .field('branchId', SCOPE.branchId),
    );
    // Also 400, but never reaches readCsv()'s "No file uploaded" message.
    expect(noFile.status).toBe(400);
  }, 60_000);

  // ── 6. POST /post ───────────────────────────────────────────────────────
  it('POST /post — the movement tables', async () => {
    const res = await probe('POST /post', 'post the DRAFT', () =>
      http
        .post(`${BASE}/post`)
        .set('Authorization', BEARER)
        .send({ svhId, ...scopeQuery, userId: ACTOR }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.rowsPosted).toBe(1);

    const again = await probe('POST /post', 'post it a second time', () =>
      http
        .post(`${BASE}/post`)
        .set('Authorization', BEARER)
        .send({ svhId, ...scopeQuery, userId: ACTOR }),
    );
    expect(again.status).toBe(409);
  }, 60_000);

  // ── 7. GET /reconcile ───────────────────────────────────────────────────
  it('GET /reconcile — a report, writes nothing', async () => {
    const res = await probe(
      'GET /reconcile',
      'opened vs held vs difference',
      () =>
        http
          .get(`${BASE}/reconcile`)
          .set('Authorization', BEARER)
          .query({ ...scopeQuery, limit: 5, offset: 0 }),
      'the opening figure comes from the ledger, not the document',
    );
    expect(res.status).toBe(200);
  }, 60_000);

  // ── 8. POST /cancel ─────────────────────────────────────────────────────
  it('POST /cancel — reverses a POSTED document, and moves a DRAFT', async () => {
    const posted = await probe('POST /cancel', 'cancel the POSTED document', () =>
      http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({
          svhId,
          ...scopeQuery,
          userId: ACTOR,
          reason: 'E2E all-endpoints test — reversing so the branch nets to zero',
        }),
    );
    expect(posted.status).toBe(201);
    expect(posted.body.data.rowsReversed).toBe(1);

    const draft = await probe(
      'POST /cancel',
      'cancel a DRAFT (nothing had moved)',
      () =>
        http
          .post(`${BASE}/cancel`)
          .set('Authorization', BEARER)
          .send({
            svhId: draftOnlyId,
            ...scopeQuery,
            userId: ACTOR,
            reason: 'E2E all-endpoints test — abandoning the draft',
          }),
      'no ledger row existed, so rowsReversed is 0',
    );
    expect(draft.status).toBe(201);
    expect(draft.body.data.rowsReversed).toBe(0);

    const twice = await probe('POST /cancel', 'cancel it again', () =>
      http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({
          svhId: draftOnlyId,
          ...scopeQuery,
          userId: ACTOR,
          reason: 'E2E all-endpoints test — second cancel',
        }),
    );
    expect(twice.status).toBeGreaterThanOrEqual(400);
  }, 90_000);

  // ── The holding is free again ───────────────────────────────────────────
  it('GET /item-lookup — a cancelled opening leaves the holding free to open', async () => {
    const res = await probe(
      'GET /item-lookup',
      'the item whose opening was cancelled',
      () =>
        http.get(`${BASE}/item-lookup`).set('Authorization', BEARER).query({
          companyId: SCOPE.companyId,
          branchId: SCOPE.branchId,
          itemId: itemA.itemId,
          onDate: DOC_DATE,
        }),
      'alreadyOpened reads the LEDGER, so a reversed opening frees the holding',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.alreadyOpened).toBe(false);
  }, 60_000);
});
