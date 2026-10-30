import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * POST /api/v1/stock/opening/create — THIS ROUTE ONLY.
 *
 * The question it answers is "which tables does one call fill", so every case
 * snapshots the row count of all eleven candidate tables before the request and
 * again after, and reports the delta. Tables that must stay untouched
 * (acc_voucher_header, stock_transit, stock_reservation) are watched exactly as
 * closely as the ones that fill.
 *
 * Auth is stubbed at the PROVIDER level, never at the guard, so the real
 * AccessTokenGuard, ValidationPipe, versioning and exception filters all run
 * and the statuses match the live server on :3011.
 *
 * NET EFFECT ON STOCK IS ZERO: anything this posts, it cancels.
 */

const BASE = '/api/v1/stock/opening';
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-04-01';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  godownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();
const tag = Date.now().toString(36).toUpperCase();

/**
 * Every table one /create could conceivably reach. The three at the bottom are
 * here to be asserted at zero — an opening moves quantity and cost, so it posts
 * no debit and no credit, ships nothing and reserves nothing.
 */
const WATCHED: Array<[string, string]> = [
  ['stock.stock_voucher', 'svh_id'],
  ['stock.stock_voucher_item', 'svi_id'],
  ['stock.stock_ledger', 'sml_id'],
  ['stock.stock_lot', 'slt_id'],
  ['stock.stock_balance', 'sbl_id'],
  ['stock.stock_item_cost', 'sic_id'],
  ['public.txn_status_log', 'tsl_id'],
  ['audit.audit_log', 'log_id'],
  ['accounts.acc_voucher_seq', 'vseq_id'],
  ['accounts.acc_voucher_header', 'vhd_id'],
  ['stock.stock_transit', 'stt_id'],
];

type Counts = Record<string, number>;

async function snapshot(): Promise<Counts> {
  const out: Counts = {};
  for (const [table] of WATCHED) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM ${table}`,
    );
    out[table] = Number(row.n);
  }
  return out;
}

function delta(before: Counts, after: Counts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [table] of WATCHED) {
    const d = after[table] - before[table];
    if (d !== 0) out[table] = d;
  }
  return out;
}

const report: Array<{
  case: string;
  status: number;
  message: unknown;
  inserted: Record<string, number>;
  note?: string;
}> = [];

describe('POST /stock/opening/create — which tables does it fill', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const createdItems: string[] = [];
  const toCancel: string[] = [];

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-opening-tables',
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
    // Put back every movement this file made.
    for (const svhId of toCancel) {
      await http
        .post(`${BASE}/cancel`)
        .set('Authorization', BEARER)
        .send({
          svhId,
          accYear: ACC_YEAR,
          companyId: SCOPE.companyId,
          branchId: SCOPE.branchId,
          userId: ACTOR,
          reason: 'E2E table-fill test — reversing so the branch nets to zero',
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line no-console
    console.log('\n===== TABLES FILLED BY POST /create =====\n' + JSON.stringify(report, null, 2));
    for (const itemId of createdItems) {
      try {
        await prisma.$executeRaw`DELETE FROM inventory.item_unit_conversion WHERE iuc_item_id = ${itemId}::uuid`;
        await prisma.$executeRaw`DELETE FROM inventory.item_master WHERE item_id = ${itemId}::uuid`;
      } catch {
        // a posted document still points at it — left in place, labelled E2E-TBL-*
      }
    }
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  async function makeItem(
    code: string,
    batchBased = false,
  ): Promise<{ itemId: string; iucId: string }> {
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
        itemIsBatchBased: batchBased,
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
      },
      select: { iucId: true },
    });
    return { itemId: item.itemId, iucId: iuc.iucId };
  }

  function line(item: { itemId: string; iucId: string }, over: Record<string, unknown> = {}) {
    return {
      lineNo: 1,
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
      ...over,
    };
  }

  function body(
    lines: Array<Record<string, unknown>>,
    header: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      header: {
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: DOC_DATE,
        toGodownId: SCOPE.godownId,
        lineCount: lines.length,
        totalQty: 10 * lines.length,
        totalValue: 200 * lines.length,
        totalValueWot: 190.48 * lines.length,
        rateSource: 'MANUAL',
        userId: ACTOR,
        voucherType: 'OPENING',
        ...header,
      },
      lines,
    };
  }

  /** One /create call, with the whole database counted either side of it. */
  async function create(
    label: string,
    payload: object,
    note?: string,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const before = await snapshot();
    const res = await http.post(`${BASE}/create`).set('Authorization', BEARER).send(payload);
    const after = await snapshot();
    report.push({
      case: label,
      status: res.status,
      message: res.body?.message,
      inserted: delta(before, after),
      ...(note ? { note } : {}),
    });
    return { status: res.status, body: res.body };
  }

  // ── 1. DRAFT ────────────────────────────────────────────────────────────
  let draftId = '';
  it('status omitted — defaults to DRAFT, fills the document tables only', async () => {
    const item = await makeItem(`E2E-TBL-NOSTATUS-${tag}`);
    const res = await create('status omitted (defaults to DRAFT)', body([line(item)]));
    expect(res.status).toBe(201);
    expect((res.body.data as any).header.status).toBe('DRAFT');
    expect((res.body.data as any).rowsPosted).toBeNull();
    draftId = (res.body.data as any).header.svhId;
  }, 60_000);

  it('status DRAFT — same tables, no movement tables', async () => {
    const item = await makeItem(`E2E-TBL-DRAFT-${tag}`);
    const res = await create('status: "DRAFT"', body([line(item)], { status: 'DRAFT' }));
    expect(res.status).toBe(201);
    expect((res.body.data as any).header.status).toBe('DRAFT');
  }, 60_000);

  // ── 2. POSTED ───────────────────────────────────────────────────────────
  it('status POSTED — save and post in one transaction, fills the movement tables too', async () => {
    const item = await makeItem(`E2E-TBL-POSTED-${tag}`);
    const res = await create('status: "POSTED"', body([line(item)], { status: 'POSTED' }));
    expect(res.status).toBe(201);
    expect((res.body.data as any).header.status).toBe('POSTED');
    expect((res.body.data as any).rowsPosted).toBe(1);
    toCancel.push((res.body.data as any).header.svhId);
  }, 60_000);

  it('status POSTED, two lines including a batch-tracked item', async () => {
    const plain = await makeItem(`E2E-TBL-M1-${tag}`);
    const batch = await makeItem(`E2E-TBL-M2-${tag}`, true);
    const res = await create(
      'status: "POSTED", 2 lines (one batch-tracked)',
      body(
        [
          line(plain),
          line(batch, {
            lineNo: 2,
            batchNo: `B-${tag}`,
            mfgDate: '2026-01-01',
            expiryDate: '2027-06-30',
            qty: 50,
            baseQty: 50,
            costRate: 28,
          }),
        ],
        { status: 'POSTED' },
      ),
    );
    expect(res.status).toBe(201);
    expect((res.body.data as any).rowsPosted).toBe(2);
    toCancel.push((res.body.data as any).header.svhId);
  }, 60_000);

  // ── 3. UPDATE through the same route ────────────────────────────────────
  it('header.svhId present — updates the DRAFT, replacing its lines', async () => {
    const item = await makeItem(`E2E-TBL-UPD-${tag}`);
    const res = await create(
      'update an existing DRAFT (header.svhId present)',
      body([line(item, { qty: 25, baseQty: 25 })], { svhId: draftId }),
      'lines are a full replace, not a merge',
    );
    expect(res.status).toBe(201);
    expect((res.body.data as any).header.svhId).toBe(draftId);
    expect((res.body.data as any).lines).toHaveLength(1);
  }, 60_000);

  // ── 4. Atomicity ────────────────────────────────────────────────────────
  it('status POSTED with a line the preflight refuses — writes nothing at all', async () => {
    const opened = await makeItem(`E2E-TBL-ATOMIC-${tag}`);
    const first = await create(
      'setup: open the holding once',
      body([line(opened)], { status: 'POSTED' }),
    );
    expect(first.status).toBe(201);
    toCancel.push((first.body.data as any).header.svhId);

    const again = await create(
      'status: "POSTED" on an already-opened holding (rollback)',
      body([line(opened)], { status: 'POSTED' }),
      'the whole save is rolled back — not even the draft survives',
    );
    expect(again.status).toBe(422);
  }, 90_000);

  // ── 5. Rejections ───────────────────────────────────────────────────────
  it('400 — a field of the wrong type touches no table', async () => {
    const item = await makeItem(`E2E-TBL-400-${tag}`);
    const res = await create(
      '400 — line qty is an object ({}), as Swagger renders it',
      body([line(item, { qty: {} })]),
    );
    expect(res.status).toBe(400);
  }, 60_000);

  it('400 — a property this route does not carry is named, not ignored', async () => {
    const item = await makeItem(`E2E-TBL-EXTRA-${tag}`);
    const res = await create(
      '400 — header.fromGodownId / reasonId, line.lotId (not on this route)',
      body([line(item, { lotId: SCOPE.godownId })], {
        fromGodownId: SCOPE.godownId,
        reasonId: SCOPE.godownId,
      }),
    );
    expect(res.status).toBe(400);
  }, 60_000);

  it('422 — a document rule refused before anything is written', async () => {
    const item = await makeItem(`E2E-TBL-422-${tag}`);
    const res = await create(
      '422 — costRate 0 under rateSource MANUAL, which derives nothing',
      body([line(item, { costRate: 0 })]),
    );
    expect(res.status).toBe(422);
  }, 60_000);
});
