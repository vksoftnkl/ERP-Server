// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL etc. are
// present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { createHouseValidationPipe } from '../src/common/validation/house-validation';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { grantMenuRights, restoreMenuRights, TESTER1, type MenuRightsMemo } from './helpers/menu-rights';

/**
 * Notes 159 (2026-10-26) §3 Ageing Slabs and §4 Tracking Presets write
 * routes. Live DB, HTTP level, through the house ValidationPipe main.ts uses.
 *
 * Leaves nothing behind: the slab rows and the preset this run writes are
 * removed by their own ids at the end, and a ladder the company already had
 * is saved back. The in-use lock (an item naming the preset) is the unit
 * spec's — this suite does not repoint a real item.
 *
 * Run with --runInBand: the menu 249 / 294 grants are shared rows.
 */

const SLABS = '/api/v1/stock/ageing-slabs';
const PRESETS = '/api/v1/stock-track-presets';
const BEARER = 'Bearer dummy-test-token';
const COMPANY_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const HOME_BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180';
const AGEING_SLABS_MENU = 294;
const TRACKING_PRESETS_MENU = 249;

const prisma = new PrismaClient();
let menuRights: MenuRightsMemo | null = null;

interface Slab {
  slabNo: number;
  label: string;
  fromDays: number;
  toDays: number | null;
}

describe('Stock small masters — notes 159 (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const startedOn = new Date();
  let ownBefore: Slab[] | null = null;
  let presetId: string | undefined;
  const code = `ZT159-${Date.now().toString(36).toUpperCase()}`;

  const errorsOf = (body: { errors?: Array<{ field: string; code: string }> }) =>
    (body.errors ?? []).map((e) => [e.field, e.code]);

  beforeAll(async () => {
    menuRights = await grantMenuRights(prisma, [AGEING_SLABS_MENU, TRACKING_PRESETS_MENU]);
    const claims: AccessTokenPayload = {
      sub: TESTER1,
      user_name: 'tester1',
      sid: 'e2e-notes-159',
      user_type: 'SUPER ADMIN',
      company_id: COMPANY_ID,
      branch_id: HOME_BRANCH,
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
    app.useGlobalPipes(createHouseValidationPipe());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: process.env.API_VERSION ?? '1' });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    try {
      if (http && ownBefore) {
        await http.post(`${SLABS}/save`).set('Authorization', BEARER).send({ companyId: COMPANY_ID, slabs: ownBefore });
      }
      // This run's slab rows (live or retired), by the actor and the clock —
      // never the company's older history.
      await prisma.$executeRaw`
        DELETE FROM stock.stock_ageing_slab
         WHERE sag_company_id = ${COMPANY_ID}::uuid AND sag_created_by = ${TESTER1}
           AND sag_created_on >= ${startedOn} AND sag_is_deleted = true`;
      if (presetId) {
        await prisma.$executeRaw`DELETE FROM stock.stock_track_preset WHERE spt_id = ${presetId}::uuid`;
      }
    } finally {
      await restoreMenuRights(prisma, menuRights);
      await app?.close();
      await prisma.$disconnect();
    }
  });

  describe('§3 Ageing Slabs', () => {
    it('reads the ladder in force', async () => {
      const res = await http.get(SLABS).query({ companyId: COMPANY_ID }).set('Authorization', BEARER).expect(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.usingOwn).toBe('boolean');
      expect(res.body.data.slabs.length).toBeGreaterThan(0);
      expect(res.body.data.slabs[0]).toEqual(expect.objectContaining({ slabNo: 1, fromDays: 0 }));
      expect(res.body.data.slabs.at(-1).toDays).toBeNull();
      if (res.body.data.usingOwn) {
        ownBefore = res.body.data.slabs;
      }
    });

    it('refuses a bad ladder 422, per field, and writes nothing', async () => {
      const res = await http
        .post(`${SLABS}/save`)
        .set('Authorization', BEARER)
        .send({
          companyId: COMPANY_ID,
          slabs: [
            { slabNo: 1, label: 'Fresh', fromDays: 0, toDays: 14 },
            { slabNo: 2, label: 'fresh', fromDays: 20, toDays: null },
            { slabNo: 3, label: 'Old', fromDays: 31, toDays: 60 },
          ],
        })
        .expect(422);
      expect(errorsOf(res.body)).toEqual([
        ['slabs.1.label', 'STOCK_AGEING_SLAB_LABEL'],
        ['slabs.1.fromDays', 'STOCK_AGEING_SLAB_NOT_CONTIGUOUS'],
        ['slabs.1.toDays', 'STOCK_AGEING_SLAB_OPEN_END'],
        ['slabs.2.toDays', 'STOCK_AGEING_SLAB_OPEN_END'],
      ]);
      const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM stock.stock_ageing_slab
         WHERE sag_company_id = ${COMPANY_ID}::uuid AND sag_created_on >= ${startedOn}`;
      expect(n).toBe(0);
    });

    it('refuses a wrong type 400 from the pipe', async () => {
      const res = await http
        .post(`${SLABS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, slabs: [{ slabNo: 'one', label: 'All', fromDays: 0, toDays: null }] })
        .expect(400);
      expect(res.body.errors[0].field).toBe('slabs.0.slabNo');
    });

    it('saves a ladder of its own, then reshapes it whole (boundaries move under the deferred constraint)', async () => {
      const first: Slab[] = [
        { slabNo: 1, label: '0-30', fromDays: 0, toDays: 30 },
        { slabNo: 2, label: '31-90', fromDays: 31, toDays: 90 },
        { slabNo: 3, label: 'Older', fromDays: 91, toDays: null },
      ];
      const saved = await http
        .post(`${SLABS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, slabs: first })
        .expect(201);
      expect(saved.body.data).toEqual({ usingOwn: true, slabs: first });

      const reshaped: Slab[] = [
        { slabNo: 1, label: '0-3', fromDays: 0, toDays: 3 },
        { slabNo: 2, label: '4-7', fromDays: 4, toDays: 7 },
        { slabNo: 3, label: '8-45', fromDays: 8, toDays: 45 },
        { slabNo: 4, label: 'Older', fromDays: 46, toDays: null },
      ];
      const again = await http
        .post(`${SLABS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, slabs: reshaped })
        .expect(201);
      expect(again.body.data).toEqual({ usingOwn: true, slabs: reshaped });

      const read = await http.get(SLABS).query({ companyId: COMPANY_ID }).set('Authorization', BEARER).expect(200);
      expect(read.body.data).toEqual({ usingOwn: true, slabs: reshaped });
      const [{ live }] = await prisma.$queryRaw<{ live: number }[]>`
        SELECT count(*)::int AS live FROM stock.stock_ageing_slab
         WHERE sag_company_id = ${COMPANY_ID}::uuid AND NOT sag_is_deleted`;
      expect(live).toBe(4);
    });

    it('reverts to the shared default', async () => {
      const res = await http
        .post(`${SLABS}/revert`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID })
        .expect(201);
      expect(res.body.data.usingOwn).toBe(false);
      const [shared] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM stock.stock_ageing_slab
         WHERE sag_company_id IS NULL AND sag_is_active AND NOT sag_is_deleted`;
      expect(res.body.data.slabs).toHaveLength(shared.n);
    });
  });

  describe('§4 Tracking Presets', () => {
    it('adds usedByItems / usedByGroups to the GET, counted as the lock counts them', async () => {
      const res = await http
        .get(`${PRESETS}/get`)
        .query({ company_id: COMPANY_ID })
        .set('Authorization', BEARER)
        .expect(200);
      const none = res.body.data.find((p: { spt_code: string }) => p.spt_code === 'NONE');
      const [{ items, groups }] = await prisma.$queryRaw<{ items: number; groups: number }[]>`
        SELECT (SELECT count(*) FROM inventory.item_master WHERE item_track_preset_id = ${none.spt_id}::uuid AND NOT item_is_deleted)::int AS items,
               (SELECT count(*) FROM inventory.item_group_master WHERE itg_track_preset_id = ${none.spt_id}::uuid AND NOT itg_is_deleted)::int AS groups`;
      expect([none.usedByItems, none.usedByGroups]).toEqual([items, groups]);
    });

    it('refuses to write a shared preset 409', async () => {
      const [shared] = await prisma.$queryRaw<{ spt_id: string }[]>`
        SELECT spt_id FROM stock.stock_track_preset WHERE spt_company_id IS NULL AND spt_code = 'BATCH' AND NOT spt_is_deleted`;
      const res = await http
        .post(`${PRESETS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, sptId: shared.spt_id, name: 'Mine' })
        .expect(409);
      expect(errorsOf(res.body)).toEqual([['sptId', 'STOCK_PRESET_SHARED_READ_ONLY']]);
      const off = await http
        .post(`${PRESETS}/deactivate`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, sptId: shared.spt_id })
        .expect(409);
      expect(errorsOf(off.body)).toEqual([['sptId', 'STOCK_PRESET_SHARED_READ_ONLY']]);
    });

    it('words the CHECKs as 422s', async () => {
      const res = await http
        .post(`${PRESETS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, code, name: 'E2E 159', trackExpiry: true, issueStrategy: 'FEFO' })
        .expect(422);
      expect(errorsOf(res.body)).toEqual([['trackExpiry', 'STOCK_PRESET_EXPIRY_NEEDS_BATCH']]);
      const fefo = await http
        .post(`${PRESETS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, code, name: 'E2E 159', trackBatch: true, issueStrategy: 'FEFO', valuationMethod: 'WAVG' })
        .expect(422);
      expect(errorsOf(fefo.body)).toEqual([
        ['issueStrategy', 'STOCK_PRESET_FEFO_NEEDS_EXPIRY'],
        ['valuationMethod', 'STOCK_PRESET_VALUATION_MISMATCH'],
      ]);
    });

    it('creates the company preset, valuation derived', async () => {
      const res = await http
        .post(`${PRESETS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, code: code.toLowerCase(), name: 'E2E 159', trackBatch: true, trackExpiry: true, sortOrder: 999 })
        .expect(201);
      presetId = res.body.data.spt_id;
      expect(res.body.data).toMatchObject({
        spt_company_id: COMPANY_ID,
        spt_code: code,
        spt_track_signature: 'BE',
        spt_valuation_method: 'LOT_ACTUAL',
        spt_issue_strategy: 'FEFO',
        spt_is_active: true,
        usedByItems: 0,
        usedByGroups: 0,
      });
    });

    it('409s the same code twice', async () => {
      const res = await http
        .post(`${PRESETS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, code, name: 'Again' })
        .expect(409);
      expect(errorsOf(res.body)).toEqual([['code', 'STOCK_PRESET_CODE_TAKEN']]);
    });

    it('updates what is sent and keeps the rest; an unused preset may change its flags', async () => {
      const res = await http
        .post(`${PRESETS}/save`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, sptId: presetId, name: 'E2E 159 renamed', trackSerial: true, nearExpiryDays: 7 })
        .expect(201);
      expect(res.body.data).toMatchObject({
        spt_name: 'E2E 159 renamed',
        spt_track_batch: true,
        spt_track_expiry: true,
        spt_track_serial: true,
        spt_near_expiry_days: 7,
        spt_sort_order: 999,
      });
    });

    it('deactivates and reactivates; the picker hides it meanwhile', async () => {
      const off = await http
        .post(`${PRESETS}/deactivate`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, sptId: presetId })
        .expect(201);
      expect(off.body).toMatchObject({ message: 'Stock track preset deactivated', data: { spt_is_active: false } });
      const list = await http
        .get(`${PRESETS}/get`)
        .query({ company_id: COMPANY_ID })
        .set('Authorization', BEARER)
        .expect(200);
      expect(list.body.data.map((p: { spt_id: string }) => p.spt_id)).not.toContain(presetId);

      const on = await http
        .post(`${PRESETS}/deactivate`)
        .set('Authorization', BEARER)
        .send({ companyId: COMPANY_ID, sptId: presetId, reactivate: true })
        .expect(201);
      expect(on.body.data.spt_is_active).toBe(true);
    });
  });
});
