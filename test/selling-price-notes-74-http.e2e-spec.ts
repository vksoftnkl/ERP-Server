import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * NOTES 74 over HTTP, read-only, on the dev box's MRP ITEM: an MRP_SELLING item
 * with 18 PCS on hand at MRP 300 in Acme Foods / Coimbatore and only a blank
 * shared headline price row. Skipped where that item is not in that state.
 *
 *   1  GET /stock/price-bulk?itemId= — one item's rows, no other filter needed.
 *   2  GET /stock/price-buckets/:itemId (F12) lists the unpriced MRP 300 bucket
 *      with its stock, as the grid does, beside the headline.
 *
 *     npm run test:e2e -- selling-price-notes-74-http
 */

const BEARER = 'Bearer dummy-test-token';
const prisma = new PrismaClient();
const ITEM_ID = '01a0f5ff-1e28-75e5-9dab-35fc9b65ff89'; // MRP ITEM

describe('Change Selling Price, notes 74 (HTTP — read-only)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let scope: { companyId: string; branchId: string; qty: number; mrp: number } | null = null;

  beforeAll(async () => {
    // The branch where MRP ITEM has an MRP bucket in stock with no price row of its own.
    const [row] = await prisma.$queryRaw<
      Array<{ companyId: string; branchId: string; qty: number; mrp: number }>
    >`
      SELECT b.sbl_company_id AS "companyId", b.sbl_branch_id AS "branchId",
             SUM(b.sbl_on_hand_qty)::float AS qty, b.sbl_mrp::float AS mrp
        FROM stock.stock_balance b
       WHERE b.sbl_item_id = ${ITEM_ID}::uuid AND b.sbl_bucket = 'SALEABLE'
         AND NOT b.sbl_is_deleted AND b.sbl_mrp IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM inventory.item_price_master p
                          WHERE p.ipm_item_id = b.sbl_item_id AND NOT p.ipm_is_deleted
                            AND p.ipm_key_mrp = b.sbl_mrp)
       GROUP BY 1, 2, 4
      HAVING SUM(b.sbl_on_hand_qty) <> 0
       LIMIT 1`;
    scope = row ?? null;
    const [user] = await prisma.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE NOT usr_is_deleted LIMIT 1`;
    const claims: AccessTokenPayload = {
      sub: user.usr_id,
      user_name: 'e2e-notes-74',
      sid: 'e2e-notes-74-session',
      user_type: 'SUPER ADMIN',
      company_id: scope?.companyId ?? (null as unknown as string),
      branch_id: scope?.branchId ?? (null as unknown as string),
      device_id: null as unknown as string,
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
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  type Row = {
    itemId: string;
    mrp: number | null;
    stockQty: number;
    priceSource: string;
    priceScope: string | null;
    bucketId: string | null;
    maxPrice: number;
    lineNo: number;
  };

  it('1. /stock/price-bulk?itemId= answers that one item’s rows', async () => {
    if (!scope) return;
    const res = await http
      .get('/api/v1/stock/price-bulk')
      .set('Authorization', BEARER)
      .query({ companyId: scope.companyId, branchId: scope.branchId, itemId: ITEM_ID });
    expect(res.status).toBe(200);
    const rows = res.body.data.items as Row[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.itemId === ITEM_ID)).toBe(true);
    expect(rows.find((r) => r.mrp === scope!.mrp)).toMatchObject({
      stockQty: scope.qty,
      priceSource: 'MASTER',
    });
  });

  it('2. F12 lists the headline AND the unpriced stock bucket, as the grid does', async () => {
    if (!scope) return;
    const [f12, grid] = await Promise.all([
      http
        .get(`/api/v1/stock/price-buckets/${ITEM_ID}`)
        .set('Authorization', BEARER)
        .query({ companyId: scope.companyId, branchId: scope.branchId }),
      http
        .get('/api/v1/stock/price-bulk')
        .set('Authorization', BEARER)
        .query({ companyId: scope.companyId, branchId: scope.branchId, itemId: ITEM_ID }),
    ]);
    expect(f12.status).toBe(200);
    const rows = f12.body.data as Row[];
    expect(rows[0]).toMatchObject({ mrp: null, priceSource: 'MASTER' });
    const bucket = rows.find((r) => r.mrp === scope!.mrp);
    expect(bucket).toMatchObject({ stockQty: scope.qty, priceSource: 'MASTER' });
    const gridBucket = (grid.body.data.items as Row[]).find((r) => r.mrp === scope!.mrp);
    const { lineNo: _a, ...f12Rest } = bucket!;
    const { lineNo: _b, ...gridRest } = gridBucket!;
    expect(f12Rest).toEqual(gridRest);
  });
});
