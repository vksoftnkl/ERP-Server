import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * COLUMN-LEVEL MAP of POST /api/v1/stock/opening/create.
 *
 * Sends one document in which EVERY optional field carries a distinctive value,
 * then dumps every row the request wrote, column by column, so each value can
 * be traced from the payload to the column it landed in — and the columns that
 * came from somewhere else can be told apart from the ones that came from you.
 *
 * Run twice: DRAFT, then POSTED, so the movement tables' columns are shown too.
 * Cancelled at the end; net effect on stock is zero.
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
const out: string[] = [];

/** Distinctive values, so every one can be found again in a column. */
const V = {
  usrRefno: `USRREF-${tag}`,
  remarks: `HDR-REMARK-${tag}`,
  createdBy: `CREATOR-${tag}`,
  lineRemarks: `LINE-REMARK-${tag}`,
  batchNo: `BATCH-${tag}`,
  serialNo: null as string | null,
  barcode: `BARCODE-${tag}`,
  mfgDate: '2026-02-01',
  expiryDate: '2027-11-30',
  mrp: 99.5,
  salePrice: 88.25,
  qty: 7,
  freeQty: 2,
  toBaseFactor: 6,
  baseQty: 42, // qty x factor, as the grid computed it
  freeBaseQty: 12,
  weightQty: 3.75,
  costRate: 33.33,
  landedRate: 35.1,
  taxPerc: 12,
  lineCount: 1,
  totalQty: 9,
  totalValue: 299.97,
  totalValueWot: 267.83,
};

async function dump(title: string, sql: string, params: unknown[] = []): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  out.push(`--- ${title} (${rows.length} row${rows.length === 1 ? '' : 's'})`);
  rows.forEach((row, i) => {
    if (rows.length > 1) out.push(`  [row ${i + 1}]`);
    for (const [col, val] of Object.entries(row)) {
      if (val === null || val === undefined) continue;
      const text = val instanceof Date ? val.toISOString() : String(val);
      if (text === '0' || text === '0.000000' || text === '0.00' || text === 'false') continue;
      out.push(`    ${col.padEnd(26)} ${text}`);
    }
  });
  out.push('');
}

describe('COLUMN MAP — POST /stock/opening/create', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let itemId = '';
  let iucId = '';
  let draftId = '';
  let postedId = '';

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-colmap',
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

    const [group] = await prisma.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
    const [unit] = await prisma.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master WHERE unit_name = 'PCS' LIMIT 1`;
    const item = await prisma.itemMaster.create({
      data: {
        itemCode: `E2E-COLMAP-${tag}`,
        itemNameEn: `E2E-COLMAP-${tag} (e2e)`,
        itemGroupId: group.itg_id,
        itemCompanyId: SCOPE.companyId,
        itemBranchId: SCOPE.branchId,
        itemIsBatchBased: true,
        itemIsExpiryItem: true,
      },
      select: { itemId: true },
    });
    itemId = item.itemId;
    const iuc = await prisma.itemUnitConversion.create({
      data: {
        iucItemId: itemId,
        iucUnitId: unit.unit_id,
        iucBaseUnitId: unit.unit_id,
        iucToBaseFactor: V.toBaseFactor,
        iucUnitSlno: 1,
        iucIsBaseUnit: true,
        iucIsDefaultUnit: true,
      },
      select: { iucId: true },
    });
    iucId = iuc.iucId;
  }, 120_000);

  afterAll(async () => {
    require('fs').writeFileSync(process.env.MAP_OUT ?? '/dev/null', out.join('\n') + '\n');
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  function body(status?: 'POSTED') {
    return {
      header: {
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: DOC_DATE,
        docDatetime: '2026-04-01T09:15:00.000Z',
        toGodownId: SCOPE.godownId,
        usrRefno: V.usrRefno,
        lineCount: V.lineCount,
        totalQty: V.totalQty,
        totalValue: V.totalValue,
        totalValueWot: V.totalValueWot,
        rateSource: 'MANUAL',
        remarks: V.remarks,
        userId: ACTOR,
        createdBy: V.createdBy,
        voucherType: 'OPENING',
        ...(status ? { status } : {}),
      },
      lines: [
        {
          lineNo: 1,
          splitNo: 1,
          itemId,
          uomId: iucId,
          baseUomId: iucId,
          toBaseFactor: V.toBaseFactor,
          godownId: SCOPE.godownId,
          bucket: 'SALEABLE',
          barcode: V.barcode,
          batchNo: V.batchNo,
          mfgDate: V.mfgDate,
          expiryDate: V.expiryDate,
          mrp: V.mrp,
          salePrice: V.salePrice,
          qty: V.qty,
          baseQty: V.baseQty,
          freeQty: V.freeQty,
          freeBaseQty: V.freeBaseQty,
          weightQty: V.weightQty,
          costRate: V.costRate,
          costRateWot: 0,
          landedRate: V.landedRate,
          taxPerc: V.taxPerc,
          remarks: V.lineRemarks,
        },
      ],
    };
  }

  it('DRAFT — dumps every column the save wrote', async () => {
    const [seqBefore] = await prisma.$queryRaw<Array<{ n: number; r: string }>>`
      SELECT seq_last_no AS n, seq_last_refno AS r FROM accounts.acc_voucher_seq
       WHERE seq_vchr_type_id = 1 AND seq_company_id = ${SCOPE.companyId}::uuid
         AND seq_branch_id = ${SCOPE.branchId}::uuid AND seq_acc_year = ${ACC_YEAR}`;

    const res = await http.post(`${BASE}/create`).set('Authorization', BEARER).send(body());
    expect(res.status).toBe(201);
    draftId = res.body.data.header.svhId;

    const [seqAfter] = await prisma.$queryRaw<Array<{ n: number; r: string }>>`
      SELECT seq_last_no AS n, seq_last_refno AS r FROM accounts.acc_voucher_seq
       WHERE seq_vchr_type_id = 1 AND seq_company_id = ${SCOPE.companyId}::uuid
         AND seq_branch_id = ${SCOPE.branchId}::uuid AND seq_acc_year = ${ACC_YEAR}`;

    out.push('================ A. status DRAFT ================\n');
    out.push(`--- accounts.acc_voucher_seq (UPDATE, not insert)`);
    out.push(`    seq_last_no                ${seqBefore.n} → ${seqAfter.n}`);
    out.push(`    seq_last_refno             ${seqBefore.r} → ${seqAfter.r}\n`);
    await dump('stock.stock_voucher', 'SELECT * FROM stock.stock_voucher WHERE svh_id = $1::uuid', [
      draftId,
    ]);
    await dump(
      'stock.stock_voucher_item',
      'SELECT * FROM stock.stock_voucher_item WHERE svi_voucher_id = $1::uuid',
      [draftId],
    );
    await dump(
      'public.txn_status_log',
      'SELECT * FROM public.txn_status_log WHERE tsl_src_doc_id = $1::uuid ORDER BY tsl_seq_no',
      [draftId],
    );
    await dump(
      'audit.audit_log',
      'SELECT log_action, log_table_name, log_pk, log_display_name, log_notes, log_user_id FROM audit.audit_log WHERE log_pk = $1 ORDER BY log_date',
      [draftId],
    );
    await dump(
      'stock.stock_ledger / stock_lot / stock_balance / stock_item_cost',
      `SELECT 'ledger' AS t, count(*)::text AS rows FROM stock.stock_ledger WHERE sml_src_doc_id = $1::uuid
       UNION ALL SELECT 'lot',      count(*)::text FROM stock.stock_lot      WHERE slt_item_id = $2::uuid
       UNION ALL SELECT 'balance',  count(*)::text FROM stock.stock_balance  WHERE sbl_item_id = $2::uuid
       UNION ALL SELECT 'itemcost', count(*)::text FROM stock.stock_item_cost WHERE sic_item_id = $2::uuid`,
      [draftId, itemId],
    );
  }, 90_000);

  it('POSTED — dumps every column the post added', async () => {
    const res = await http.post(`${BASE}/create`).set('Authorization', BEARER).send(body('POSTED'));
    expect(res.status).toBe(201);
    postedId = res.body.data.header.svhId;

    out.push('================ B. status POSTED ================\n');
    await dump('stock.stock_voucher', 'SELECT * FROM stock.stock_voucher WHERE svh_id = $1::uuid', [
      postedId,
    ]);
    await dump(
      'stock.stock_voucher_item',
      'SELECT * FROM stock.stock_voucher_item WHERE svi_voucher_id = $1::uuid',
      [postedId],
    );
    await dump(
      'stock.stock_ledger',
      'SELECT * FROM stock.stock_ledger WHERE sml_src_doc_id = $1::uuid',
      [postedId],
    );
    await dump('stock.stock_lot', 'SELECT * FROM stock.stock_lot WHERE slt_item_id = $1::uuid', [
      itemId,
    ]);
    await dump(
      'stock.stock_balance',
      'SELECT * FROM stock.stock_balance WHERE sbl_item_id = $1::uuid',
      [itemId],
    );
    await dump(
      'stock.stock_item_cost',
      'SELECT * FROM stock.stock_item_cost WHERE sic_item_id = $1::uuid',
      [itemId],
    );
    await dump(
      'public.txn_status_log',
      'SELECT tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status, tsl_src_doc_refno, tsl_remarks, tsl_changed_by FROM public.txn_status_log WHERE tsl_src_doc_id = $1::uuid ORDER BY tsl_seq_no',
      [postedId],
    );
  }, 90_000);

  it('puts the stock back', async () => {
    const res = await http.post(`${BASE}/cancel`).set('Authorization', BEARER).send({
      svhId: postedId,
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
      reason: 'E2E column map — reversing so the branch nets to zero',
    });
    expect(res.status).toBe(201);
    const [bal] = await prisma.$queryRaw<Array<{ q: string }>>`
      SELECT sbl_on_hand_qty::text AS q FROM stock.stock_balance WHERE sbl_item_id = ${itemId}::uuid`;
    expect(Number(bal.q)).toBe(0);
  }, 90_000);
});
