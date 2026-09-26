// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * The acceptance criteria from the 2026-09-17 acc_group_master / acc_ledger_master
 * review, driven over real HTTP against the real database:
 *
 *   §1.1  every live customer and supplier has a ledger row, and the FK says so
 *   §1.2  a company-scoped ledger whose name matches a SHARED one is refused
 *   §1.3  the four Tally group flags round-trip through create -> get
 *   §1.4  accGroupChildIds is gone from the payload
 *   §2.1  ledItcEligibility round-trips; a bad value is a 400, not a 500
 *   §2.2  ledIsReverseCharge round-trips
 *   §2.6  ledger shipping addresses can be listed by ledger
 *   §3.1  the six balance columns are refused by the save DTO
 *   §3.4  an invalid ledLedgerType is a 400 naming the field, not a 500
 *
 * Auth is stubbed at the PROVIDER level, never at the guard, so the real
 * AccessTokenGuard, ValidationPipe, versioning, prefix and exception filters run
 * and the status codes match the live server.
 *
 * Everything this suite creates is named with an 'ZZ-E2E-' prefix and soft-deleted
 * in afterAll. See memory: erp-server-http-testing-without-credentials.
 */

const GROUPS = '/api/v1/account-groups';
const LEDGERS = '/api/v1/account-ledger-masters';
const SHIP_ADDRS = '/api/v1/ledger-shipping-addresses';
const BEARER = 'Bearer dummy-test-token';

// Seeded, reserved groups — used only as parents, never modified.
const GROUP_CUSTOMERS = '019f081c-6764-73b0-b397-3f30a6efe73e';
const GROUP_SUPPLIERS = '019f081c-98cc-757a-9346-4cfba810c47f';
// tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();
const NAME = (suffix: string): string => `ZZ-E2E-${suffix}-${Date.now()}`;

describe('account masters — 2026-09-17 review acceptance (e2e, live DB)', () => {
  let app: INestApplication;
  const createdGroupIds: string[] = [];
  const createdLedgerIds: string[] = [];

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-account-masters',
      user_type: 'SUPER ADMIN',
      company_id: null,
      branch_id: null,
      device_id: null,
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
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
  });

  afterAll(async () => {
    // Soft-delete what this suite made, so a rerun does not trip the new
    // uniqueness rules on its own leftovers.
    if (createdLedgerIds.length > 0) {
      await prisma.accLedgerMaster.updateMany({
        where: { ledId: { in: createdLedgerIds } },
        data: { ledIsDeleted: true, ledIsActive: false },
      });
    }
    if (createdGroupIds.length > 0) {
      await prisma.accGroupMaster.updateMany({
        where: { accGroupId: { in: createdGroupIds } },
        data: { accGroupIsDeleted: true, accGroupIsActive: false },
      });
    }
    await app?.close();
    await prisma.$disconnect();
  });

  // ── §1.1 ────────────────────────────────────────────────────────────────
  describe('§1.1 — cus_id / sup_id ARE led_id', () => {
    it('leaves no live customer without a ledger row', async () => {
      const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) AS count
           FROM sales.customers c
           LEFT JOIN accounts.acc_ledger_master l ON l.led_id = c.cus_id
          WHERE l.led_id IS NULL AND NOT c.cus_is_deleted`,
      );
      expect(Number(count)).toBe(0);
    });

    it('leaves no live supplier without a ledger row', async () => {
      const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) AS count
           FROM purchase.suppliers s
           LEFT JOIN accounts.acc_ledger_master l ON l.led_id = s.sup_id
          WHERE l.led_id IS NULL AND NOT s.sup_is_deleted`,
      );
      expect(Number(count)).toBe(0);
    });

    it('has both foreign keys, validated', async () => {
      const rows = await prisma.$queryRawUnsafe<Array<{ conname: string; convalidated: boolean }>>(
        `SELECT conname, convalidated FROM pg_constraint
          WHERE conname IN ('fk_cus_ledger', 'fk_sup_ledger')`,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.convalidated)).toBe(true);
    });
  });

  // ── §1.3 + §1.4 ─────────────────────────────────────────────────────────
  describe('§1.3 — the four Tally group flags round-trip', () => {
    it('accepts all five on create and reads them back on get', async () => {
      const create = await request(app.getHttpServer())
        .post(`${GROUPS}/create`)
        .set('Authorization', BEARER)
        .send({
          accGroupName: NAME('GRP'),
          accGroupParentId: GROUP_CUSTOMERS,
          accGroupBehaveAsSubledger: true,
          accGroupNetDebitCredit: true,
          accGroupUsedForCalculation: true,
          accGroupAffectsGrossProfit: true,
          accGroupIsActive: true,
        })
        .expect(201);

      const accGroupId = create.body.data.accGroupId as string;
      createdGroupIds.push(accGroupId);

      const get = await request(app.getHttpServer())
        .get(`${GROUPS}/get`)
        .query({ accGroupId })
        .set('Authorization', BEARER)
        .expect(200);

      expect(get.body.data).toMatchObject({
        accGroupBehaveAsSubledger: true,
        accGroupNetDebitCredit: true,
        accGroupUsedForCalculation: true,
        accGroupAffectsGrossProfit: true,
        accGroupIsActive: true,
      });
      // §1.4 — the stale subtree array is gone from the payload entirely.
      expect(get.body.data).not.toHaveProperty('accGroupChildIds');
    });

    // The update path lost its child-array bookkeeping in §1.4; this is here so the
    // rest of it — inheritance from the parent, the circular-hierarchy guard, the
    // audit entry — is exercised after the surgery, not assumed.
    it('still updates, reparents and soft-deletes after the childIds removal', async () => {
      const create = await request(app.getHttpServer())
        .post(`${GROUPS}/create`)
        .set('Authorization', BEARER)
        .send({ accGroupName: NAME('GRP-UPD'), accGroupParentId: GROUP_CUSTOMERS })
        .expect(201);
      const accGroupId = create.body.data.accGroupId as string;
      createdGroupIds.push(accGroupId);

      const renamed = NAME('GRP-UPD2');
      const update = await request(app.getHttpServer())
        .post(`${GROUPS}/create`)
        .set('Authorization', BEARER)
        .send({
          accGroupId,
          accGroupName: renamed,
          accGroupParentId: GROUP_SUPPLIERS,
          accGroupAffectsGrossProfit: true,
        })
        .expect(201);
      expect(update.body.data).toMatchObject({
        accGroupName: renamed,
        accGroupParentId: GROUP_SUPPLIERS,
        accGroupAffectsGrossProfit: true,
        // Reparenting re-inherits all four from the new parent.
        accGroupNature: 'Liabilities',
      });

      // A group cannot become its own parent.
      await request(app.getHttpServer())
        .post(`${GROUPS}/create`)
        .set('Authorization', BEARER)
        .send({ accGroupId, accGroupName: renamed, accGroupParentId: accGroupId })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`${GROUPS}/delete`)
        .query({ accGroupId })
        .set('Authorization', BEARER)
        .expect(200);

      await request(app.getHttpServer())
        .get(`${GROUPS}/get`)
        .query({ accGroupId })
        .set('Authorization', BEARER)
        .expect(404);
    });
  });

  // ── §2.1, §2.2, §3.1, §3.4, §1.2 ────────────────────────────────────────
  describe('account ledger save contract', () => {
    it('§2.1 + §2.2 — ITC eligibility and reverse charge round-trip', async () => {
      const create = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send({
          ledGroupId: GROUP_SUPPLIERS,
          ledName: NAME('LED-GST'),
          ledItcEligibility: 'INELIGIBLE_17_5',
          ledIsReverseCharge: true,
        })
        .expect(201);

      const ledId = create.body.data.ledId as string;
      createdLedgerIds.push(ledId);

      const get = await request(app.getHttpServer())
        .get(`${LEDGERS}/get`)
        .query({ ledId })
        .set('Authorization', BEARER)
        .expect(200);

      expect(get.body.data).toMatchObject({
        ledItcEligibility: 'INELIGIBLE_17_5',
        ledIsReverseCharge: true,
      });
    });

    it('§2.1 — an invalid ledItcEligibility is a 400 naming the field', async () => {
      const res = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send({
          ledGroupId: GROUP_SUPPLIERS,
          ledName: NAME('LED-BAD-ITC'),
          ledItcEligibility: 'NONSENSE',
        })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('ledItcEligibility');
    });

    it('§3.4 — an invalid ledLedgerType is a 400 naming the field, not a 500', async () => {
      const res = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send({
          ledGroupId: GROUP_SUPPLIERS,
          ledName: NAME('LED-BAD-TYPE'),
          ledLedgerType: 'NONSENSE',
        })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('ledLedgerType');
    });

    it.each([
      'ledObAmount',
      'ledObType',
      'ledObAsOn',
      'ledTotalDr',
      'ledTotalCr',
      'ledTotalBalance',
    ])('§3.1 — %s is refused by the save DTO', async (field) => {
      const payload: Record<string, unknown> = {
        ledGroupId: GROUP_SUPPLIERS,
        ledName: NAME(`LED-${field}`),
      };
      payload[field] = field === 'ledObType' ? 'DR' : field === 'ledObAsOn' ? '2026-04-01' : 1;

      const res = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send(payload)
        .expect(400);
      expect(JSON.stringify(res.body)).toContain(`property ${field} should not exist`);
    });

    it('§2.6 — shipping addresses can be listed by ledger', async () => {
      const create = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send({ ledGroupId: GROUP_SUPPLIERS, ledName: NAME('LED-SHIP') })
        .expect(201);
      const ledId = create.body.data.ledId as string;
      createdLedgerIds.push(ledId);

      const list = await request(app.getHttpServer())
        .get(`${SHIP_ADDRS}/get`)
        .query({ ledgerId: ledId })
        .set('Authorization', BEARER)
        .expect(200);
      expect(list.body.data).toEqual({ data: [], total: 0 });

      // Neither parameter is a 400 naming the field, not a 500.
      await request(app.getHttpServer())
        .get(`${SHIP_ADDRS}/get`)
        .set('Authorization', BEARER)
        .expect(400);
    });

    it("§1.2 — a company-scoped ledger may not take a SHARED ledger's name", async () => {
      const company = await prisma.company.findFirst({ select: { compId: true } });
      expect(company).not.toBeNull();

      const sharedName = NAME('LED-SHARED');
      const shared = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send({ ledGroupId: GROUP_SUPPLIERS, ledName: sharedName })
        .expect(201);
      createdLedgerIds.push(shared.body.data.ledId as string);

      // Same name, this time scoped to a company. The old check passed this:
      // it looked only inside that company. Every company can see the shared row,
      // so the operator would see the name twice and a Tally export would merge
      // the two <LEDGER> entries and combine their balances.
      const res = await request(app.getHttpServer())
        .post(`${LEDGERS}/create`)
        .set('Authorization', BEARER)
        .send({
          ledGroupId: GROUP_SUPPLIERS,
          ledName: sharedName.toLowerCase(), // and case must not get round it
          ledCompanyId: company!.compId,
        })
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('ledName');
    });
  });
});
