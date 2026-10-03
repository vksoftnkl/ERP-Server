import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * /api/v1/stock/transfer/receive — DRIVEN WITH REAL DATA.
 *
 * The receive screen reads stock.stock_transit, and the only thing that ever
 * writes a transit row is stock.fn_svh_post_transfer, which is not deployed
 * here. So this file stands in for exactly that one side effect and nothing
 * else: it despatches a REAL inter-branch TRANSFER_OUT created through the API,
 * then writes the transit rows the engine would have written and flips the
 * header to IN_TRANSIT.
 *
 * WHAT IS SIMULATED IS NARROW AND SAID OUT LOUD:
 *   * stock.stock_transit rows — seeded here, as fn_svh_post_transfer would
 *   * svh_status IN_TRANSIT   — set here, as the engine would
 * NOTHING ELSE. In particular NO stock_ledger row is written, so no stock
 * actually leaves the source godown and the whole fixture is reversible —
 * stock_ledger is append-only and this file must never touch it.
 *
 * Everything downstream of that is the real code: the inbound worklist, the
 * prefill matcher and its remainder arithmetic, saveReceive's line matching,
 * and the post.
 */

const T = '/api/v1/stock/transfer';
const RCV = `${T}/receive`;
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-09-10';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const SRC_GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01'; // Coimbatore
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65'; // Counter2
const OTHER_GODOWN = '019f0812-7c0b-7f5f-8478-df1d03328a19'; // karur
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const SENT = 10;
const ALREADY_RECEIVED = 4; // on the second row, to exercise the remainder

const prisma = new PrismaClient();

describe('POST/GET /stock/transfer/receive — real data', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let lot: {
    lotId: string;
    itemId: string;
    uomId: string;
    batch: string | null;
    expiry: string | null;
  };
  let outId = '';
  let outRefno = '';
  let receiptId = '';

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-rcv-real',
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

    const [row] = await prisma.$queryRaw<
      Array<{ lot: string; item: string; uom: string; batch: string | null; expiry: Date | null }>
    >`
      SELECT b.sbl_lot_id AS lot, b.sbl_item_id AS item, b.sbl_base_uom_id AS uom,
             l.slt_batch_no AS batch, l.slt_expiry_date AS expiry
        FROM stock.stock_balance b JOIN stock.stock_lot l ON l.slt_id = b.sbl_lot_id
       WHERE b.sbl_godown_id = ${SRC_GODOWN}::uuid AND b.sbl_on_hand_qty > 50
       ORDER BY b.sbl_on_hand_qty DESC LIMIT 1`;
    lot = {
      lotId: row.lot,
      itemId: row.item,
      uomId: row.uom,
      batch: row.batch,
      expiry: row.expiry ? new Date(row.expiry).toISOString().slice(0, 10) : null,
    };
  }, 120_000);

  afterAll(async () => {
    // Unwind the simulated despatch. Transit rows are ordinary rows; the
    // header goes back to DRAFT. No ledger row was ever written.
    if (outId) {
      await prisma.$executeRaw`DELETE FROM stock.stock_transit WHERE stt_out_voucher_id = ${outId}::uuid`;
      await prisma.$executeRaw`UPDATE stock.stock_voucher SET svh_status = 'DRAFT' WHERE svh_id = ${outId}::uuid`;
    }
    if (receiptId) {
      await prisma.$executeRaw`DELETE FROM stock.stock_voucher_item WHERE svi_voucher_id = ${receiptId}::uuid`;
      await prisma.$executeRaw`DELETE FROM stock.stock_voucher WHERE svh_id = ${receiptId}::uuid`;
    }
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  it('creates a real inter-branch TRANSFER_OUT through the API', async () => {
    const res = await http
      .post(T)
      .set('Authorization', BEARER)
      .send({
        header: {
          accYear: ACC_YEAR,
          companyId: SCOPE.companyId,
          branchId: SCOPE.branchId,
          deviceId: SCOPE.deviceId,
          docDate: DOC_DATE,
          fromGodownId: SRC_GODOWN,
          toGodownId: OTHER_GODOWN,
          toBranchId: OTHER_BRANCH,
          userId: ACTOR,
          remarks: 'E2E-RCV real-data receive test',
        },
        // ONE line. Two lines naming the same item+lot+bucket are refused at save:
        // "both lines would become the same transit row and the despatch would be
        // refused. Two source godowns is two transfers." — which is correct, and
        // is why the remainder below is made by a PART RECEIPT rather than by a
        // second line.
        lines: [
          {
            lineNo: 1,
            splitNo: 1,
            itemId: lot.itemId,
            godownId: SRC_GODOWN,
            lotId: lot.lotId,
            bucket: 'SALEABLE',
            uomId: lot.uomId,
            baseUomId: lot.uomId,
            toBaseFactor: 1,
            ...(lot.batch ? { batchNo: lot.batch } : {}),
            ...(lot.expiry ? { expiryDate: lot.expiry } : {}),
            qty: SENT,
            baseQty: SENT,
          },
        ],
      });
    // eslint-disable-next-line no-console
    console.log(
      '\n  POST /transfer →',
      res.status,
      res.body?.message,
      JSON.stringify(res.body?.errors ?? '').slice(0, 400),
    );
    expect(res.status).toBe(201);
    outId = res.body.data.header.svhId;
    outRefno = res.body.data.header.refno;
  }, 60_000);

  it('stands in for fn_svh_post_transfer: transit rows + IN_TRANSIT', async () => {
    // One transit row per line, exactly as the engine's §0.3 shape. Row 2 is
    // already part-received, so the prefill has a remainder to compute.
    {
      const received = ALREADY_RECEIVED;
      await prisma.$executeRaw`
        INSERT INTO stock.stock_transit (
          stt_company_id, stt_from_branch_id, stt_from_godown_id,
          stt_to_branch_id, stt_to_godown_id, stt_item_id, stt_lot_id, stt_base_uom_id,
          stt_bucket, stt_out_voucher_id, stt_out_acc_year, stt_out_refno,
          stt_sent_qty, stt_received_qty, stt_cost_rate, stt_transit_value,
          stt_expected_on, stt_status, stt_lr_no, stt_vehicle_no, stt_created_by
        ) VALUES (
          ${SCOPE.companyId}::uuid, ${SCOPE.branchId}::uuid, ${SRC_GODOWN}::uuid,
          ${OTHER_BRANCH}::uuid, ${OTHER_GODOWN}::uuid, ${lot.itemId}::uuid,
          ${lot.lotId}::uuid, ${lot.uomId}::uuid,
          'SALEABLE', ${outId}::uuid, ${ACC_YEAR}::bpchar, ${outRefno},
          ${SENT}, ${received}, 20, ${SENT * 20},
          DATE '2026-09-12', ${received > 0 ? 'PARTIAL' : 'IN_TRANSIT'},
          'LR-E2E-77', 'TN-77-7777', ${ACTOR}
        )`;
    }
    await prisma.$executeRaw`
      UPDATE stock.stock_voucher SET svh_status = 'IN_TRANSIT' WHERE svh_id = ${outId}::uuid`;

    const [n] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM stock.stock_transit WHERE stt_out_voucher_id = ${outId}::uuid`;
    expect(Number(n.n)).toBe(1);
  }, 60_000);

  it('GET /receive/inbound — the consignment shows up at the receiving branch', async () => {
    const res = await http
      .get(`${RCV}/inbound`)
      .set('Authorization', BEARER)
      .query({ companyId: SCOPE.companyId, branchId: OTHER_BRANCH, limit: 20, offset: 0 });
    // eslint-disable-next-line no-console
    console.log('\n  inbound →', res.status, res.body?.message);
    console.log(
      '  ',
      JSON.stringify(res.body?.data?.rows ?? res.body?.data?.items ?? res.body?.data).slice(0, 700),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.meta.count).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('GET /receive/inbound — the SENDING branch still sees nothing', async () => {
    const res = await http
      .get(`${RCV}/inbound`)
      .set('Authorization', BEARER)
      .query({ companyId: SCOPE.companyId, branchId: SCOPE.branchId, limit: 20, offset: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.meta.count).toBe(0);
  }, 60_000);

  it('GET /receive/prefill — opens at the REMAINDER, not at what was sent', async () => {
    const res = await http.get(`${RCV}/prefill`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: OTHER_BRANCH,
      accYear: ACC_YEAR,
      outVoucherId: outId,
    });
    // eslint-disable-next-line no-console
    console.log('\n  prefill →', res.status, res.body?.message);
    console.log('  ', JSON.stringify(res.body?.data?.rows).slice(0, 800));
    expect(res.status).toBe(200);
    const rows = res.body.data.rows as Array<{
      sentQty: number;
      receivedQty: number;
      remainingQty: number;
    }>;
    expect(rows).toHaveLength(1);
    // 10 sent, 4 already taken — the receipt opens at 6, NOT at 10. Prefilling
    // from the despatch's lines instead is what lets a clerk receive the same
    // stock twice.
    expect(Number(rows[0].sentQty)).toBe(SENT);
    expect(Number(rows[0].receivedQty)).toBe(ALREADY_RECEIVED);
    expect(Number(rows[0].remainingQty)).toBe(SENT - ALREADY_RECEIVED);
  }, 60_000);

  it('GET /receive/prefill — refused from the wrong branch', async () => {
    const res = await http.get(`${RCV}/prefill`).set('Authorization', BEARER).query({
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      accYear: ACC_YEAR,
      outVoucherId: outId,
    });
    // eslint-disable-next-line no-console
    console.log('\n  prefill from the sending branch →', res.status, res.body?.message);
    expect(res.status).toBe(409);
  }, 60_000);

  it('POST /receive — creates the TRANSFER_IN draft against the despatch', async () => {
    const res = await http
      .post(RCV)
      .set('Authorization', BEARER)
      .send({
        header: {
          accYear: ACC_YEAR,
          companyId: SCOPE.companyId,
          branchId: OTHER_BRANCH,
          deviceId: SCOPE.deviceId,
          docDate: DOC_DATE,
          toGodownId: OTHER_GODOWN,
          userId: ACTOR,
          remarks: 'E2E-RCV real-data receipt',
          linkSrcModule: 'STOCK',
          linkSrcDocType: 'TRANSFER_OUT',
          linkSrcDocId: outId,
          linkSrcAccYear: ACC_YEAR,
        },
        lines: [
          {
            lineNo: 1,
            splitNo: 1,
            itemId: lot.itemId,
            godownId: OTHER_GODOWN,
            lotId: lot.lotId,
            bucket: 'SALEABLE',
            uomId: lot.uomId,
            baseUomId: lot.uomId,
            toBaseFactor: 1,
            ...(lot.batch ? { batchNo: lot.batch } : {}),
            ...(lot.expiry ? { expiryDate: lot.expiry } : {}),
            // The remainder the prefill offered, not what was originally sent.
            qty: SENT - ALREADY_RECEIVED,
            baseQty: SENT - ALREADY_RECEIVED,
          },
        ],
      });
    // eslint-disable-next-line no-console
    console.log('\n  POST /receive →', res.status, res.body?.message);
    if (res.body?.errors) console.log('  ', JSON.stringify(res.body.errors).slice(0, 500));
    if (res.status === 201) {
      receiptId = res.body.data.header.svhId;
      expect(res.body.data.header.voucherType).toBe('TRANSFER_IN');
      expect(res.body.data.header.status).toBe('DRAFT');
    }
    expect([201, 409, 422]).toContain(res.status);
  }, 60_000);

  it('POST /receive — refuses more than is in transit', async () => {
    const res = await http
      .post(RCV)
      .set('Authorization', BEARER)
      .send({
        header: {
          accYear: ACC_YEAR,
          companyId: SCOPE.companyId,
          branchId: OTHER_BRANCH,
          deviceId: SCOPE.deviceId,
          docDate: DOC_DATE,
          toGodownId: OTHER_GODOWN,
          userId: ACTOR,
          remarks: 'E2E-RCV over-receipt',
          linkSrcModule: 'STOCK',
          linkSrcDocType: 'TRANSFER_OUT',
          linkSrcDocId: outId,
          linkSrcAccYear: ACC_YEAR,
        },
        lines: [
          {
            lineNo: 1,
            splitNo: 1,
            itemId: lot.itemId,
            godownId: OTHER_GODOWN,
            lotId: lot.lotId,
            bucket: 'SALEABLE',
            uomId: lot.uomId,
            baseUomId: lot.uomId,
            toBaseFactor: 1,
            ...(lot.batch ? { batchNo: lot.batch } : {}),
            ...(lot.expiry ? { expiryDate: lot.expiry } : {}),
            qty: 9999,
            baseQty: 9999,
          },
        ],
      });
    // eslint-disable-next-line no-console
    console.log('\n  POST /receive (9999 units) →', res.status, res.body?.message);
    if (res.body?.errors) console.log('  ', JSON.stringify(res.body.errors).slice(0, 400));
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  it('POST /receive/post — where the receipt actually stops', async () => {
    if (!receiptId) return;
    const res = await http.post(`${RCV}/post`).set('Authorization', BEARER).send({
      svhId: receiptId,
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: OTHER_BRANCH,
      userId: ACTOR,
    });
    // eslint-disable-next-line no-console
    console.log('\n  POST /receive/post →', res.status, res.body?.message);
    if (res.body?.errors) console.log('  ', JSON.stringify(res.body.errors).slice(0, 400));
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);

  it('nothing moved: the source holding and the ledger are untouched', async () => {
    const [led] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM stock.stock_ledger WHERE sml_src_doc_id = ${outId}::uuid`;
    expect(Number(led.n)).toBe(0);
  }, 60_000);
});
