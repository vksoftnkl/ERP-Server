// Preload .env exactly like src/main.ts so API_VERSION / DATABASE_URL exist
// before the AppModule graph (and the @Version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * POST /api/v1/stock/opening/create, driven at the HTTP level, for BOTH values
 * of header.status — the draft path and the save-and-post path — with a probe
 * of every table the request touched after each step.
 *
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard: the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and StockVoucherExceptionFilter all run, so
 * the status codes match the live server on :3011. See memory
 * erp-server-http-testing-without-credentials.
 *
 * NET EFFECT ON STOCK IS ZERO: whatever this posts, it cancels. The ledger is
 * append-only (tr_sml_forbid_delete), so the reversal rows stay on the books;
 * the fixtures are labelled E2E-STATUS-* so they are recognisable.
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
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1

const prisma = new PrismaClient();
const tag = Date.now().toString(36).toUpperCase();

/** Everything one step wrote, read back straight from the tables. */
interface Trace {
  voucher: Record<string, unknown> | undefined;
  lines: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
  balance: Array<Record<string, unknown>>;
  lot: Array<Record<string, unknown>>;
  itemCost: Array<Record<string, unknown>>;
  trail: Array<Record<string, unknown>>;
}

const traces: Array<{ step: string; http: unknown; db: Trace }> = [];

async function probe(svhId: string, itemId: string): Promise<Trace> {
  const [voucher] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT svh_id, svh_slno, svh_refno, svh_status, svh_voucher_type, svh_rate_source,
           svh_to_godown_id, svh_line_count, svh_total_qty, svh_total_value,
           svh_total_value_wot, svh_version_no, svh_created_by, svh_modified_by
      FROM stock.stock_voucher WHERE svh_id = ${svhId}::uuid`;
  const lines = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT svi_line_no, svi_split_no, svi_item_id, svi_uom_id, svi_base_uom_id,
           svi_to_base_factor, svi_qty, svi_base_qty, svi_free_qty, svi_cost_rate,
           svi_cost_rate_wot, svi_tax_perc, svi_value, svi_value_wot, svi_lot_id,
           svi_batch_no, svi_bucket
      FROM stock.stock_voucher_item WHERE svi_voucher_id = ${svhId}::uuid
     ORDER BY svi_line_no, svi_split_no`;
  const ledger = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT sml_line_no, sml_txn_type, sml_direction, sml_bucket, sml_qty, sml_base_qty,
           sml_signed_base_qty, sml_cost_rate, sml_cost_value, sml_cost_rate_wot,
           sml_is_reversal, sml_lot_id
      FROM stock.stock_ledger WHERE sml_src_doc_id = ${svhId}::uuid
     ORDER BY sml_posted_on, sml_line_no`;
  const balance = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT sbl_bucket, sbl_in_qty, sbl_out_qty, sbl_on_hand_qty, sbl_available_qty,
           sbl_avg_cost_rate, sbl_avg_cost_rate_wot, sbl_stock_value
      FROM stock.stock_balance WHERE sbl_item_id = ${itemId}::uuid`;
  const lot = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT slt_id, slt_batch_no, slt_serial_no, slt_expiry_date, slt_total_on_hand
      FROM stock.stock_lot WHERE slt_item_id = ${itemId}::uuid`;
  const itemCost = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT sic_avg_cost_rate, sic_avg_cost_rate_wot, sic_total_qty, sic_total_value
      FROM stock.stock_item_cost WHERE sic_item_id = ${itemId}::uuid`;
  const trail = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status, tsl_src_doc_type,
           tsl_src_doc_refno, tsl_remarks
      FROM public.txn_status_log WHERE tsl_src_doc_id = ${svhId}::uuid
     ORDER BY tsl_seq_no`;
  return { voucher, lines, ledger, balance, lot, itemCost, trail };
}

function record(step: string, http: unknown, db: Trace): void {
  traces.push({ step, http, db });
}

describe('POST /stock/opening/create — status DRAFT vs POSTED (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const createdItems: string[] = [];

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-opening-status-session',
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
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix('api');
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n===== WORKFLOW TRACE =====\n' + JSON.stringify(traces, jsonSafe, 2));
    // BEST EFFORT ONLY. A posted document leaves a stock_lot and an append-only
    // ledger row pointing at the item, and fk_slt_base_uom is RESTRICT — so the
    // fixtures for anything that posted deliberately stay on the database,
    // labelled E2E-STATUS-*.
    for (const itemId of createdItems) {
      try {
        await prisma.$executeRaw`DELETE FROM inventory.item_unit_conversion WHERE iuc_item_id = ${itemId}::uuid`;
        await prisma.$executeRaw`DELETE FROM inventory.item_master WHERE item_id = ${itemId}::uuid`;
      } catch {
        // left in place on purpose — see above
      }
    }
    await app?.close();
    await prisma.$disconnect();
  }, 60_000);

  /** Prisma Decimals and BigInts do not survive JSON.stringify on their own. */
  function jsonSafe(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && 'toFixed' in value) return String(value);
    return value;
  }

  /** A brand-new item, so the "already opened in this branch" rule cannot fire. */
  async function makeItem(code: string): Promise<{ itemId: string; iucId: string }> {
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
      },
      select: { iucId: true },
    });
    return { itemId: item.itemId, iucId: iuc.iucId };
  }

  function payload(
    item: { itemId: string; iucId: string },
    status: 'DRAFT' | 'POSTED' | undefined,
  ): Record<string, unknown> {
    return {
      header: {
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: DOC_DATE,
        toGodownId: SCOPE.godownId,
        lineCount: 1,
        totalQty: 10,
        totalValue: 200,
        totalValueWot: 190.48,
        rateSource: 'MANUAL',
        remarks: `E2E-STATUS ${status ?? 'omitted'}`,
        userId: ACTOR,
        voucherType: 'OPENING',
        ...(status ? { status } : {}),
      },
      lines: [
        {
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
        },
      ],
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 0. The payload exactly as Swagger renders it
  // ────────────────────────────────────────────────────────────────────────
  it('refuses the Swagger sample payload verbatim, naming every field', async () => {
    const swaggerSample = {
      header: {
        svhId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        accYear: '2026-2027',
        companyId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        branchId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        tenantId: {},
        deviceId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        sessionId: {},
        slno: 'string',
        refno: 'string',
        usrRefno: {},
        docDate: '2026-04-01',
        docDatetime: '2026-09-10T07:42:28.646Z',
        toGodownId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        lineCount: 0,
        totalQty: 0,
        totalValue: 0,
        totalValueWot: 0,
        rateSource: 'AVG_COST',
        remarks: {},
        userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        voucherType: 'OPENING',
        status: 'DRAFT',
        createdBy: {},
        modifiedBy: {},
      },
      lines: [
        {
          lineNo: 1,
          splitNo: 1,
          itemId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          uomId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          baseUomId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          toBaseFactor: 12,
          godownId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          bucket: 'SALEABLE',
          barcode: {},
          batchNo: {},
          mfgDate: '2026-09-10',
          expiryDate: '2026-09-10',
          mrp: {},
          salePrice: {},
          serialNo: {},
          supplierId: {},
          qty: {},
          baseQty: 120,
          freeQty: 0,
          freeBaseQty: 0,
          weightQty: 0,
          costRate: {},
          costRateWot: 0,
          landedRate: 0,
          taxPerc: 0,
          remarks: {},
          createdBy: {},
          modifiedBy: {},
        },
      ],
    };

    const res = await http.post(`${BASE}/create`).set('Authorization', BEARER).send(swaggerSample);
    record(
      '0. swagger sample verbatim',
      { status: res.status, body: res.body },
      {
        voucher: undefined,
        lines: [],
        ledger: [],
        balance: [],
        lot: [],
        itemCost: [],
        trail: [],
      },
    );
    expect(res.status).toBe(400);
  }, 60_000);

  // ────────────────────────────────────────────────────────────────────────
  // 1. status: 'DRAFT'
  // ────────────────────────────────────────────────────────────────────────
  let draftSvhId = '';
  let draftItem: { itemId: string; iucId: string };

  it('status DRAFT — saves the document and moves no stock', async () => {
    draftItem = await makeItem(`E2E-STATUS-DRAFT-${tag}`);
    const res = await http
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send(payload(draftItem, 'DRAFT'));

    expect(res.status).toBe(201);
    expect(res.body.data.header.status).toBe('DRAFT');
    expect(res.body.data.rowsPosted).toBeNull();
    draftSvhId = res.body.data.header.svhId;

    const db = await probe(draftSvhId, draftItem.itemId);
    record('1. create status=DRAFT', { status: res.status, body: res.body }, db);

    expect(db.voucher!.svh_status).toBe('DRAFT');
    expect(db.lines).toHaveLength(1);
    expect(db.lines[0].svi_lot_id).toBeNull(); // no lot before the post
    expect(db.ledger).toHaveLength(0); // NOTHING moved
    expect(db.balance).toHaveLength(0);
    expect(db.lot).toHaveLength(0);
    expect(db.itemCost).toHaveLength(0);
    expect(db.trail).toHaveLength(1);
    expect(db.trail[0].tsl_from_status).toBeNull();
    expect(db.trail[0].tsl_to_status).toBe('DRAFT');
  }, 60_000);

  // ────────────────────────────────────────────────────────────────────────
  // 2. status: 'POSTED' — save and post in one transaction
  // ────────────────────────────────────────────────────────────────────────
  let postedSvhId = '';
  let postedItem: { itemId: string; iucId: string };

  it('status POSTED — saves, posts and moves stock in one request', async () => {
    postedItem = await makeItem(`E2E-STATUS-POSTED-${tag}`);
    const res = await http
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send(payload(postedItem, 'POSTED'));

    expect(res.status).toBe(201);
    expect(res.body.data.header.status).toBe('POSTED');
    expect(res.body.data.rowsPosted).toBe(1);
    postedSvhId = res.body.data.header.svhId;

    const db = await probe(postedSvhId, postedItem.itemId);
    record('2. create status=POSTED', { status: res.status, body: res.body }, db);

    expect(db.voucher!.svh_status).toBe('POSTED');
    expect(db.lines[0].svi_lot_id).not.toBeNull(); // the post stamped the lot
    expect(db.ledger).toHaveLength(1);
    expect(db.ledger[0].sml_txn_type).toBe('OPENING');
    expect(Number(db.ledger[0].sml_direction)).toBe(1); // smallint +1 = inward
    expect(db.lot).toHaveLength(1);
    expect(db.balance).toHaveLength(1);
    expect(Number(db.balance[0].sbl_on_hand_qty)).toBe(10);
    expect(db.itemCost).toHaveLength(1);
    expect(db.trail).toHaveLength(2);
    expect(db.trail[1].tsl_from_status).toBe('DRAFT');
    expect(db.trail[1].tsl_to_status).toBe('POSTED');
  }, 60_000);

  // ────────────────────────────────────────────────────────────────────────
  // 3. The other road to the same place: DRAFT then /post
  // ────────────────────────────────────────────────────────────────────────
  it('the draft posted afterwards through /post ends in the same state', async () => {
    const res = await http.post(`${BASE}/post`).set('Authorization', BEARER).send({
      svhId: draftSvhId,
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
    });

    const db = await probe(draftSvhId, draftItem.itemId);
    record('3. /post the draft from step 1', { status: res.status, body: res.body }, db);

    expect(res.status).toBe(201); // @Post with no @HttpCode — Swagger says 200
    expect(db.voucher!.svh_status).toBe('POSTED');
    expect(db.ledger).toHaveLength(1);
    expect(db.trail.map((r) => r.tsl_to_status)).toEqual(['DRAFT', 'POSTED']);
  }, 60_000);

  // ────────────────────────────────────────────────────────────────────────
  // 4. Re-posting, and the second opening of the same holding
  // ────────────────────────────────────────────────────────────────────────
  it('a POSTED document refuses a second post', async () => {
    const res = await http.post(`${BASE}/post`).set('Authorization', BEARER).send({
      svhId: postedSvhId,
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
    });
    record(
      '4. double post',
      { status: res.status, body: res.body },
      {
        voucher: undefined,
        lines: [],
        ledger: [],
        balance: [],
        lot: [],
        itemCost: [],
        trail: [],
      },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  it('a second opening of an already-opened holding is refused at post', async () => {
    const res = await http
      .post(`${BASE}/create`)
      .set('Authorization', BEARER)
      .send(payload(postedItem, 'POSTED'));
    record(
      '5. re-open the same holding',
      { status: res.status, body: res.body },
      {
        voucher: undefined,
        lines: [],
        ledger: [],
        balance: [],
        lot: [],
        itemCost: [],
        trail: [],
      },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  // ────────────────────────────────────────────────────────────────────────
  // 6. Put the stock back — net zero
  // ────────────────────────────────────────────────────────────────────────
  it('cancels both postings so the branch is left as it was found', async () => {
    for (const [label, svhId, itemId] of [
      ['6a. cancel the save-and-post document', postedSvhId, postedItem.itemId],
      ['6b. cancel the draft-then-post document', draftSvhId, draftItem.itemId],
    ] as const) {
      const res = await http.post(`${BASE}/cancel`).set('Authorization', BEARER).send({
        svhId,
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        userId: ACTOR,
        reason: 'E2E status test — reversing so the branch nets to zero',
      });
      const db = await probe(svhId, itemId);
      record(label, { status: res.status, body: res.body }, db);
      expect(res.status).toBe(201);
      expect(db.voucher!.svh_status).toBe('CANCELLED');
      expect(db.ledger).toHaveLength(2); // the original row and its reversal
      expect(Number(db.balance[0].sbl_on_hand_qty)).toBe(0);
    }
  }, 90_000);
});
