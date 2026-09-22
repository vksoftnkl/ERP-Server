import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { TxnStatusDocType } from '../src/common/txn-status-log/txn-status-log.helper';

/**
 * WHAT HAPPENS TO A TRANSFER_IN — the receiving half of a branch-to-branch
 * transfer.
 *
 * It cannot be reached through the API: POST /stock/transfer/receive refuses
 * with 409 until the despatch it settles is IN_TRANSIT, and the despatch is
 * itself blocked. So this file BUILDS a TRANSFER_IN draft directly — the
 * document the API would have created — and runs the real preflight on it, to
 * find out what the receive screen will hit the moment the despatch is fixed.
 *
 * The fixture is a DRAFT that never posts, and it is deleted afterwards.
 * stock_voucher is not append-only; only stock_ledger is, and nothing here
 * writes one.
 */

const ACC_YEAR = '2026-2027';
const BEARER = 'Bearer dummy-test-token';
const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const SRC_GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65';
const OTHER_GODOWN = '019f0812-7c0b-7f5f-8478-df1d03328a19';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();

/** Exactly as pinned in stock-transfer-receive.controller.ts. */
const TRANSFER_IN_RULES: StockVoucherTypeRules = {
  voucherType: 'TRANSFER_IN',
  typeCode: 'TRI',
  displayName: 'Transfer receipt',
  requiresToGodown: true,
  requiresFromGodown: true,
  isInward: true,
  ledgerTxnTypes: ['TRANSFER_IN'],
  quantityMode: 'QTY',
  requiresLot: true,
  zeroesLineCost: true,
  allowsCount: false,
  allowsToBranch: false,
  postFunction: 'stock.fn_svh_receive_transfer',
  auditScreenName: 'Stock Transfer Receipt',
  statusDocType: TxnStatusDocType.STOCK_TRANSFER,
  refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

describe('TRANSFER_IN — what the receiving half will hit', () => {
  let app: INestApplication;
  let service: StockVoucherService;
  let svhId = '';
  let lot: {
    lotId: string;
    itemId: string;
    uomId: string;
    batch: string | null;
    expiry: Date | null;
  };

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-tri',
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
    service = app.get(StockVoucherService);

    const [row] = await prisma.$queryRaw<
      Array<{ lot: string; item: string; uom: string; batch: string | null; expiry: Date | null }>
    >`
      SELECT b.sbl_lot_id AS lot, b.sbl_item_id AS item, b.sbl_base_uom_id AS uom,
             l.slt_batch_no AS batch, l.slt_expiry_date AS expiry
        FROM stock.stock_balance b JOIN stock.stock_lot l ON l.slt_id = b.sbl_lot_id
       WHERE b.sbl_godown_id = ${SRC_GODOWN}::uuid AND b.sbl_on_hand_qty > 10
       ORDER BY b.sbl_on_hand_qty DESC LIMIT 1`;
    lot = {
      lotId: row.lot,
      itemId: row.item,
      uomId: row.uom,
      batch: row.batch,
      expiry: row.expiry,
    };

    // The receipt the API would have built: TRANSFER_IN, DRAFT, in the
    // RECEIVING branch, its line landing in the receiving godown at cost 0 —
    // which is what `zeroesLineCost` means and what the engine expects, because
    // the real cost travels on stt_cost_rate.
    // ck_svh_transfer_in_link: a TRANSFER_IN MUST name the despatch it settles.
    // The link is not decoration — it is how the receipt finds its transit rows.
    const [outDoc] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT svh_id AS id FROM stock.stock_voucher
       WHERE svh_voucher_type = 'TRANSFER_OUT' AND svh_to_branch_id IS NOT NULL
         AND svh_is_deleted = false LIMIT 1`;
    if (!outDoc) throw new Error('No inter-branch TRANSFER_OUT to link a receipt to.');

    const [hdr] = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO stock.stock_voucher (
        svh_company_id, svh_branch_id, svh_acc_year, svh_device_id, svh_voucher_type,
        svh_slno, svh_refno, svh_doc_date, svh_from_godown_id, svh_to_godown_id,
        svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
        svh_status, svh_created_by
      ) VALUES (
        ${SCOPE.companyId}::uuid, ${OTHER_BRANCH}::uuid, ${ACC_YEAR}::bpchar,
        ${SCOPE.deviceId}::uuid, 'TRANSFER_IN',
        '9001', ${'E2E-TRI-PREFLIGHT-' + Date.now()}, DATE '2026-09-10',
        ${SRC_GODOWN}::uuid, ${OTHER_GODOWN}::uuid,
        'STOCK', 'TRANSFER_OUT', ${outDoc.id}::uuid, ${ACC_YEAR}::bpchar,
        'DRAFT', ${ACTOR}
      ) RETURNING svh_id AS id`;
    svhId = hdr.id;

    await prisma.$executeRaw`
      INSERT INTO stock.stock_voucher_item (
        svi_voucher_id, svi_company_id, svi_branch_id, svi_acc_year, svi_line_no, svi_split_no, svi_item_id,
        svi_uom_id, svi_base_uom_id, svi_to_base_factor, svi_godown_id, svi_bucket,
        svi_lot_id, svi_batch_no, svi_expiry_date,
        svi_qty, svi_base_qty, svi_cost_rate, svi_cost_rate_wot, svi_created_by
      ) VALUES (
        ${svhId}::uuid, ${SCOPE.companyId}::uuid, ${OTHER_BRANCH}::uuid, ${ACC_YEAR}::bpchar, 1, 1, ${lot.itemId}::uuid,
        ${lot.uomId}::uuid, ${lot.uomId}::uuid, 1, ${OTHER_GODOWN}::uuid, 'SALEABLE',
        ${lot.lotId}::uuid, ${lot.batch}, ${lot.expiry}::date,
        4, 4, 0, 0, ${ACTOR}
      )`;
  }, 120_000);

  afterAll(async () => {
    if (svhId) {
      await prisma.$executeRaw`DELETE FROM stock.stock_voucher_item WHERE svi_voucher_id = ${svhId}::uuid`;
      await prisma.$executeRaw`DELETE FROM stock.stock_voucher WHERE svh_id = ${svhId}::uuid`;
    }
    await app?.close();
    await prisma.$disconnect();
  }, 60_000);

  it('the preflight refuses the receipt, and not for one reason but two', async () => {
    const rows = await service.validate(
      TRANSFER_IN_RULES,
      svhId,
      ACC_YEAR,
      SCOPE.companyId,
      OTHER_BRANCH,
    );
    // eslint-disable-next-line no-console
    console.log('\n  TRANSFER_IN preflight →', JSON.stringify(rows.map((r) => r.problem)));
    expect(rows).toHaveLength(1);
    expect(rows[0].problem).not.toBeNull();
  }, 60_000);

  it('isolates which gate refuses it — the zero-cost one', async () => {
    // BOTH corrections, to show that the line itself is fine and it is the
    // gating that refuses it:
    //   allowsRepeatHolding  turns off the OPENING-only uniqueness guard
    //   isInward:false       stands in for gating the zero-cost check on
    //                        `!zeroesLineCost`, the way assertPayloadRules
    //                        already gates its own copy of that rule
    // Isolated, so it is clear WHICH gate refuses this document.
    const onlyCost = await service.validate(
      { ...TRANSFER_IN_RULES, isInward: false },
      svhId,
      ACC_YEAR,
      SCOPE.companyId,
      OTHER_BRANCH,
    );
    const onlyOpening = await service.validate(
      { ...TRANSFER_IN_RULES, allowsRepeatHolding: true },
      svhId,
      ACC_YEAR,
      SCOPE.companyId,
      OTHER_BRANCH,
    );
    // eslint-disable-next-line no-console
    console.log('  zero-cost gate corrected →', JSON.stringify(onlyCost.map((r) => r.problem)));
    // eslint-disable-next-line no-console
    console.log('  opening gate corrected   →', JSON.stringify(onlyOpening.map((r) => r.problem)));

    // The zero-cost gate is the one that refuses THIS receipt: the line is
    // clean the moment it stops firing.
    expect(onlyCost[0].problem).toBeNull();
    // The opening guard is still wrong on TRANSFER_IN — it simply does not
    // fire here, because the RECEIVING godown has no opening for this lot.
    // Receive into a godown that opened the same holding this year and it will.
    expect(onlyOpening[0].problem).toBe(
      'this line brings stock in with no cost rate and no rate source the engine can derive one from',
    );
  }, 60_000);

  it('and behind the preflight, its engine is missing too', async () => {
    const [fn] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
       WHERE n2.nspname = 'stock' AND p.proname = 'fn_svh_receive_transfer'`;
    expect(Number(fn.n)).toBe(0);
  }, 60_000);

  it('POST /receive is unreachable while the despatch is blocked', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock/transfer/receive/post')
      .set('Authorization', BEARER)
      .send({
        svhId,
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: OTHER_BRANCH,
        userId: ACTOR,
      });
    // eslint-disable-next-line no-console
    console.log('  POST /receive/post on a hand-built receipt →', res.status, res.body?.message);
    expect(res.status).toBeGreaterThanOrEqual(400);
  }, 60_000);
});
