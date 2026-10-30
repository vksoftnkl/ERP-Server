// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL etc. are
// present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import {
  grantMenuRights,
  restoreMenuRights,
  type MenuRightsMemo,
  STOCK_TRANSFER_MENU,
} from './helpers/menu-rights';

/**
 * Notes 154 (2026-10-26) — reading the receiving half back. READ-ONLY against
 * the dev database: it opens the newest posted branch receipt that already
 * exists and writes nothing, so no stock moves and no branch average shifts
 * (a round trip to make its own receipt would — notes 154 #5). Skips when the
 * box holds no posted receipt.
 *
 *   #1 GET /stock/transfer/receive — the receipt, its despatch and transit rows
 *   #2/#3 the inbound and prefill SQL run against the real tables
 *   #4 the despatch's header names its to-branch
 */

const T = '/api/v1/stock/transfer';
const BEARER = 'Bearer dummy-test-token';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180';

const prisma = new PrismaClient();
let menuRights: MenuRightsMemo | null = null;

interface Receipt {
  in_id: string;
  in_year: string;
  company_id: string;
  in_branch_id: string;
  out_id: string;
  out_year: string;
  out_refno: string;
  out_branch_id: string;
  out_branch_name: string | null;
  out_status: string;
  to_branch_name: string | null;
  batch_no: string | null;
}

describe('Branch Inward — reading a receipt back, notes 154 (e2e, read-only)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let receipt: Receipt | undefined;

  beforeAll(async () => {
    menuRights = await grantMenuRights(prisma, [STOCK_TRANSFER_MENU]);
    [receipt] = await prisma.$queryRaw<Receipt[]>`
      SELECT i.svh_id AS in_id, i.svh_acc_year AS in_year, i.svh_company_id AS company_id,
             i.svh_branch_id AS in_branch_id,
             o.svh_id AS out_id, o.svh_acc_year AS out_year, o.svh_refno AS out_refno,
             o.svh_branch_id AS out_branch_id, ob.br_name AS out_branch_name,
             o.svh_status AS out_status, tb.br_name AS to_branch_name,
             (SELECT l.slt_batch_no FROM stock.stock_voucher_item li
                JOIN stock.stock_lot l ON l.slt_id = li.svi_lot_id
               WHERE li.svi_voucher_id = i.svh_id AND li.svi_acc_year = i.svh_acc_year
                 AND NOT li.svi_is_deleted
               ORDER BY li.svi_line_no, li.svi_split_no LIMIT 1) AS batch_no
        FROM stock.stock_voucher i
        JOIN stock.stock_voucher o ON o.svh_id = i.svh_link_src_doc_id
                                  AND o.svh_acc_year = i.svh_link_src_acc_year
        LEFT JOIN public.branch_master ob ON ob.br_id = o.svh_branch_id
        LEFT JOIN public.branch_master tb ON tb.br_id = o.svh_to_branch_id
       WHERE i.svh_voucher_type = 'TRANSFER_IN' AND i.svh_status = 'POSTED' AND NOT i.svh_is_deleted
       ORDER BY i.svh_created_on DESC
       LIMIT 1`;
    if (receipt) {
      receipt.in_year = receipt.in_year.trim();
      receipt.out_year = receipt.out_year.trim();
    }

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-notes-154',
      user_type: 'SUPER ADMIN',
      company_id: receipt?.company_id ?? '00000000-0000-4000-8000-000000000000',
      branch_id: receipt?.in_branch_id ?? '00000000-0000-4000-8000-000000000000',
      device_id: DEVICE_ID,
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
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: process.env.API_VERSION ?? '1' });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    await restoreMenuRights(prisma, menuRights);
    await app?.close();
    await prisma.$disconnect();
  });

  const inScope = () => ({
    svhId: receipt!.in_id,
    accYear: receipt!.in_year,
    companyId: receipt!.company_id,
    branchId: receipt!.in_branch_id,
  });

  it('#1: GET /receive opens the receipt — header + lines + the despatch\'s transit rows', async () => {
    if (!receipt) return;
    const res = await http.get(`${T}/receive`).set('Authorization', BEARER).query(inScope());
    expect(res.status).toBe(200);
    expect(res.body.data.header).toMatchObject({
      svhId: receipt.in_id,
      voucherType: 'TRANSFER_IN',
      status: 'POSTED',
      linkSrcDocId: receipt.out_id,
      linkSrcAccYear: receipt.out_year,
      linkSrcRefno: receipt.out_refno,
      fromBranchId: receipt.out_branch_id,
      fromBranchName: receipt.out_branch_name,
    });
    expect(res.body.data.lines.length).toBeGreaterThan(0);
    // Notes 153 E5 applies to the receiving half too: the line reads its lot.
    expect(res.body.data.lines[0].batchNo).toBe(receipt.batch_no);
    expect(res.body.data.transit.length).toBeGreaterThan(0);
    expect(res.body.data.transit[0]).toEqual(
      expect.objectContaining({ sentQty: expect.any(Number), remainingQty: expect.any(Number) }),
    );
  });

  it('#1: the transfer GET still refuses a receipt (404) — the receipt route is the way in', async () => {
    if (!receipt) return;
    const res = await http.get(T).set('Authorization', BEARER).query(inScope());
    expect(res.status).toBe(404);
  });

  it('#4: the despatch header names the branch it went to', async () => {
    if (!receipt) return;
    const res = await http.get(T).set('Authorization', BEARER).query({
      svhId: receipt.out_id,
      accYear: receipt.out_year,
      companyId: receipt.company_id,
      branchId: receipt.out_branch_id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.header.toBranchName).toBe(receipt.to_branch_name);
    expect(res.body.data.header.toBranchName).not.toBeNull();
  });

  it('#2/#3: inbound and prefill run their SQL against the real tables', async () => {
    if (!receipt) return;
    const inbound = await http
      .get(`${T}/receive/inbound`)
      .set('Authorization', BEARER)
      .query({ companyId: receipt.company_id, branchId: receipt.in_branch_id });
    expect(inbound.status).toBe(200);
    for (const row of inbound.body.data.items as Array<Record<string, unknown>>) {
      expect(row).toEqual(
        expect.objectContaining({
          outVoucherId: expect.any(String),
          outAccYear: expect.stringMatching(/^\d{4}-\d{4}$/),
          fromBranchName: expect.anything(),
        }),
      );
    }

    // A received despatch: the prefill reads it — names joined — and then
    // refuses it as no longer in transit. Nothing is written either way.
    const prefill = await http.get(`${T}/receive/prefill`).set('Authorization', BEARER).query({
      companyId: receipt.company_id,
      branchId: receipt.in_branch_id,
      outVoucherId: receipt.out_id,
      accYear: receipt.out_year,
    });
    if (receipt.out_status === 'IN_TRANSIT') {
      expect(prefill.status).toBe(200);
      expect(prefill.body.data.outVoucher).toMatchObject({ fromBranchName: receipt.out_branch_name });
    } else {
      expect(prefill.status).toBe(409);
      expect(prefill.body.errors[0].code).toBe('STOCK_TRANSFER_NOT_IN_TRANSIT');
    }
  });
});
