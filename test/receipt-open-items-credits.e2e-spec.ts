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
 * GET /api/v1/receipts/open-items returned `credits: []` for every party,
 * because CREDIT_BILL_TYPES admitted only ADVANCE and SALES_RETURN and every
 * credit a go-live produces is an OPENING row.
 *
 * READ-ONLY: this drives the live dev database but issues only GETs, so unlike
 * the cancel suite it mutates nothing. The expectations are derived FROM the
 * database rather than hard-coded, so the suite still means something after the
 * dev data moves on.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const ROUTE = '/api/v1/receipts/open-items';
const BEARER = 'Bearer dummy-test-token';

const prisma = new PrismaClient();

interface PartyCredits {
  partyId: string;
  companyId: string;
  ledName: string;
  creditCount: number;
  creditsHeld: string;
}

interface CreditRow {
  billId: string;
  billAccYear: string;
  billType: string;
  docRefno: string;
  pendingAmount: string;
  adjType: string;
  settlementMode: string;
  drCr: string;
}

describe('GET /receipts/open-items — credits (e2e, live DB, read-only)', () => {
  let app: INestApplication;
  let parties: PartyCredits[] = [];
  // tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
  const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

  beforeAll(async () => {
    // Every party holding an open credit, with the count and total the
    // endpoint must report. This is the report's own verification query.
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        abl_party_id: string;
        abl_company_id: string;
        led_name: string;
        n: bigint;
        total: string;
      }>
    >(
      `SELECT b.abl_party_id, b.abl_company_id,
              COALESCE(l.led_name, '?') AS led_name,
              count(*) AS n, sum(b.abl_pending_amount)::text AS total
         FROM accounts.acc_bill_balance b
         LEFT JOIN accounts.acc_ledger_master l ON l.led_id = b.abl_party_id
        WHERE b.abl_dr_cr = 'CR'
          AND b.abl_is_deleted = false
          AND b.abl_is_active = true
          AND b.abl_pending_amount > 0
        GROUP BY 1, 2, 3
        ORDER BY 3`,
    );
    parties = rows.map((row) => ({
      partyId: row.abl_party_id,
      companyId: row.abl_company_id,
      ledName: row.led_name,
      creditCount: Number(row.n),
      creditsHeld: row.total,
    }));

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
      user_type: 'SUPER ADMIN',
      company_id: parties[0]?.companyId ?? null,
      branch_id: null,
      device_id: null,
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
    // Mirror src/main.ts so the route, validation and errors behave as live.
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

    // eslint-disable-next-line no-console
    console.log(
      `\n[open-items e2e] parties holding credit: ` +
        (parties.map((p) => `${p.ledName} (${p.creditCount} x ${p.creditsHeld})`).join(', ') ||
          'NONE'),
    );
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  const fetchCredits = async (
    party: PartyCredits,
  ): Promise<{ credits: CreditRow[]; creditsHeld: string; status: number }> => {
    const res = await request(app.getHttpServer())
      .get(ROUTE)
      .query({ partyId: party.partyId, companyId: party.companyId, onDate: '2026-09-16' })
      .set('Authorization', BEARER);
    const payload = res.body?.data ?? res.body;
    return {
      credits: payload?.credits ?? [],
      creditsHeld: String(payload?.summary?.creditsHeld ?? ''),
      status: res.status,
    };
  };

  it('the dev database still holds at least one open credit to assert on', () => {
    // A guard, not a real expectation: if the fixtures are wiped, every test
    // below would pass vacuously and the regression would go unnoticed.
    expect(parties.length).toBeGreaterThan(0);
  });

  it('returns every open credit the party holds, and sums them into creditsHeld', async () => {
    for (const party of parties) {
      const { credits, creditsHeld, status } = await fetchCredits(party);
      expect(status).toBe(200);
      // The bug: this was [] and 0 for every party.
      expect(credits).toHaveLength(party.creditCount);
      expect(Number(creditsHeld)).toBeCloseTo(Number(party.creditsHeld), 2);
      const summed = credits.reduce((acc, row) => acc + Number(row.pendingAmount), 0);
      expect(summed).toBeCloseTo(Number(party.creditsHeld), 2);
    }
  });

  it('carries the fields the client reads, on every credit', async () => {
    for (const party of parties) {
      const { credits } = await fetchCredits(party);
      for (const credit of credits) {
        expect(credit.billId).toEqual(expect.any(String));
        expect(credit.billAccYear).toEqual(expect.any(String));
        expect(credit.docRefno).toEqual(expect.any(String));
        expect(credit.drCr).toBe('CR');
        // Every credit must carry a route, or it can be shown but not spent.
        expect(credit.adjType).toEqual(expect.any(String));
        expect(credit.settlementMode).toEqual(expect.any(String));
      }
    }
  });

  it('routes an OPENING or JOURNAL credit as ADVANCE_ADJUST / ADVANCE', async () => {
    for (const party of parties) {
      const { credits } = await fetchCredits(party);
      for (const credit of credits.filter(
        (c) => c.billType === 'OPENING' || c.billType === 'JOURNAL',
      )) {
        expect(credit.adjType).toBe('ADVANCE_ADJUST');
        expect(credit.settlementMode).toBe('ADVANCE');
      }
    }
  });

  it('does not filter credits by accounting year', async () => {
    // A credit raised in 2025-2026 is spendable in 2026-2027, which is why each
    // row carries its own billAccYear. If a year filter crept back in, a party
    // whose credit predates the current year would come back short.
    for (const party of parties) {
      const { credits } = await fetchCredits(party);
      const years = await prisma.$queryRawUnsafe<Array<{ abl_acc_year: string }>>(
        `SELECT DISTINCT abl_acc_year FROM accounts.acc_bill_balance
          WHERE abl_party_id = $1::uuid AND abl_company_id = $2::uuid AND abl_dr_cr = 'CR'
            AND abl_is_deleted = false AND abl_is_active = true AND abl_pending_amount > 0`,
        party.partyId,
        party.companyId,
      );
      expect(new Set(credits.map((c) => c.billAccYear))).toEqual(
        new Set(years.map((y) => y.abl_acc_year)),
      );
    }
  });
});
