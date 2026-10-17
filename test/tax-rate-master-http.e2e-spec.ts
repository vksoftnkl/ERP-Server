// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';

/**
 * HTTP-level test for the tax rate master — header plus ledger overrides.
 *
 * Auth is stubbed at the PROVIDER level, never at the guard, so the real
 * AccessTokenGuard, the global ValidationPipe, URI versioning, the global
 * prefix and the exception filters all run and the status codes match the live
 * server. See memory: erp-server-http-testing-without-credentials.
 *
 * This drives the SAME database the live server uses. Everything it creates is
 * named with the E2E_ prefix and hard-deleted in afterAll, including the one
 * global tax ledger it has to borrow: the dev chart has no global TAX ledger,
 * so without it no override line could be saved at all.
 */

const BASE = '/api/v1/tax-rates';
const BEARER = 'Bearer dummy-test-token';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1, a real user_master row

const prisma = new PrismaClient();

const NAME = 'E2E_TaxRate_Alpha';
const CODE = 'E2ETAXA';
const LEDGER_NAME = 'E2E_Global_Output_CGST';

describe('tax-rates (e2e — live DB)', () => {
  let app: INestApplication;
  let ledgerId: string;
  let companyLedgerId: string | null = null;
  let taxId: string | null = null;

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(`${BASE}/create`).set('Authorization', BEARER).send(body);
  const get = (query: string) =>
    request(app.getHttpServer()).get(`${BASE}/get?${query}`).set('Authorization', BEARER);

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
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

    // A global TAX / Central Tax ledger for OUTPUT_CGST to point at. The dev
    // chart's four Output ledgers are all company-scoped, which the guard
    // rejects on purpose — a rate is shared by every company.
    const group = await prisma.accGroupMaster.findFirst({ select: { accGroupId: true } });
    // findFirst + create rather than upsert: led_company_id is nullable, and a
    // compound unique containing a NULL never matches in Postgres.
    const existingLedger = await prisma.accLedgerMaster.findFirst({
      where: { ledName: LEDGER_NAME },
      select: { ledId: true },
    });
    ledgerId =
      existingLedger?.ledId ??
      (
        await prisma.accLedgerMaster.create({
          data: {
            ledGroupId: group!.accGroupId,
            ledName: LEDGER_NAME,
            ledLedgerType: 'TAX',
            ledGstDutyHead: 'Central Tax',
            ledCompanyId: null,
          },
          select: { ledId: true },
        })
      ).ledId;

    const companyLedger = await prisma.accLedgerMaster.findFirst({
      where: { ledCompanyId: { not: null }, ledGstDutyHead: 'Central Tax', ledIsDeleted: false },
      select: { ledId: true },
    });
    companyLedgerId = companyLedger?.ledId ?? null;
  });

  afterAll(async () => {
    if (taxId) {
      await prisma.taxRateLedger.deleteMany({ where: { trlTaxId: taxId } });
      await prisma.taxRateMaster.deleteMany({ where: { taxId } });
    }
    await prisma.taxRateMaster.deleteMany({ where: { taxName: { startsWith: 'E2E_' } } });
    await prisma.accLedgerMaster.deleteMany({ where: { ledName: LEDGER_NAME } });
    await app?.close();
    await prisma.$disconnect();
  });

  // ─── auth and shape ───────────────────────────────────────────────────────

  it('401 without an Authorization header', async () => {
    const res = await request(app.getHttpServer()).post(`${BASE}/create`).send({});
    expect(res.status).toBe(401);
  });

  it('400 when tax_name is missing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  // ─── the header ───────────────────────────────────────────────────────────

  it('creates a rate with no lines — the normal, complete case', async () => {
    const res = await post({
      tax_name: NAME,
      tax_code: CODE,
      tax_rate_perc: 18,
      tax_sort_order: 900,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    taxId = res.body.data.tax_id;

    // The three component rates are GENERATED from tax_rate_perc.
    expect(res.body.data.tax_rate_perc).toBe(18);
    expect(res.body.data.tax_cgst_perc).toBe(9);
    expect(res.body.data.tax_sgst_perc).toBe(9);
    expect(res.body.data.tax_igst_perc).toBe(18);
    expect(res.body.data.lines).toEqual([]);
  });

  it('409 on a duplicate name, case-insensitively', async () => {
    const res = await post({ tax_name: NAME.toLowerCase(), tax_rate_perc: 5 });
    expect(res.status).toBe(409);
    expect(res.body.errors[0].field).toBe('tax_name');
  });

  it('409 on a duplicate code, case-insensitively', async () => {
    const res = await post({ tax_name: 'E2E_TaxRate_Beta', tax_code: CODE.toLowerCase() });
    expect(res.status).toBe(409);
    expect(res.body.errors[0].field).toBe('tax_code');
  });

  it('400 when the cess basis and its figures disagree', async () => {
    const res = await post({
      tax_name: 'E2E_TaxRate_Cess',
      tax_rate_perc: 28,
      tax_cess_basis: 'PERCENT',
      tax_cess_perc: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toContain('tax_cess_perc');
  });

  it('400 when an EXEMPT rate charges something', async () => {
    const res = await post({
      tax_name: 'E2E_TaxRate_Exempt',
      tax_taxability: 'EXEMPT',
      tax_rate_perc: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('tax_taxability');
  });

  it('accepts ZERO_RATED at 0% — an export is taxable, not exempt', async () => {
    const res = await post({ tax_name: 'E2E_TaxRate_Zero', tax_taxability: 'ZERO_RATED' });
    expect(res.status).toBe(201);
    await prisma.taxRateMaster.deleteMany({ where: { taxId: res.body.data.tax_id } });
  });

  it('reads the rate back whole', async () => {
    const res = await get(`tax_id=${taxId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tax_name).toBe(NAME);
    expect(res.body.data.lines).toEqual([]);
  });

  it('lists it, narrowed by search', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/list?search=E2E_TaxRate`)
      .set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { tax_id: string }) => r.tax_id)).toContain(taxId);
  });

  // ─── the lines, and the guard that owns their rules ───────────────────────

  it('400 when a line names a role that cannot be overridden per rate', async () => {
    const res = await post({
      tax_id: taxId,
      tax_name: NAME,
      lines: [{ trl_role: 'ROUND_OFF', trl_ledger_id: ledgerId }],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('lines.0.trl_role');
    expect(res.body.errors[0].message).toContain('cannot be set per rate');
  });

  it('400 when a line narrows a role that already implies its supply nature', async () => {
    const res = await post({
      tax_id: taxId,
      tax_name: NAME,
      lines: [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: ledgerId, trl_supply_nature: 'INTRA' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('lines.0.trl_supply_nature');
  });

  it('400 when two lines override the same role and nature', async () => {
    const res = await post({
      tax_id: taxId,
      tax_name: NAME,
      lines: [
        { trl_role: 'OUTPUT_CGST', trl_ledger_id: ledgerId },
        { trl_role: 'OUTPUT_CGST', trl_ledger_id: ledgerId },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('lines.1.trl_role');
  });

  it('400 when a line points at a ledger of the wrong duty head', async () => {
    const wrongDuty = await prisma.accLedgerMaster.findFirst({
      where: { ledCompanyId: null, ledGstDutyHead: null, ledIsDeleted: false },
      select: { ledId: true },
    });
    const res = await post({
      tax_id: taxId,
      tax_name: NAME,
      lines: [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: wrongDuty!.ledId }],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('lines.0.trl_ledger_id');
  });

  it('400 when a line points at a company-scoped ledger', async () => {
    if (!companyLedgerId) return;
    const res = await post({
      tax_id: taxId,
      tax_name: NAME,
      lines: [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: companyLedgerId }],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain('must be global');
  });

  it('saves a valid override line with the header', async () => {
    const res = await post({
      tax_id: taxId,
      tax_name: NAME,
      lines: [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: ledgerId, trl_remarks: 'e2e' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.lines).toHaveLength(1);
    expect(res.body.data.lines[0].trl_role).toBe('OUTPUT_CGST');
    expect(res.body.data.lines[0].trl_role_label).toBe('Output CGST');
    expect(res.body.data.lines[0].trl_ledger_name).toBe(LEDGER_NAME);
    expect(res.body.data.lines[0].trl_supply_nature).toBeNull();
  });

  it('leaves the grid alone when the key is omitted', async () => {
    const res = await post({ tax_id: taxId, tax_name: NAME, tax_sort_order: 901 });
    expect(res.status).toBe(201);
    expect(res.body.data.tax_sort_order).toBe(901);
    expect(res.body.data.lines).toHaveLength(1);
  });

  it('empties the grid when the key is present and empty', async () => {
    const res = await post({ tax_id: taxId, tax_name: NAME, lines: [] });
    expect(res.status).toBe(201);
    expect(res.body.data.lines).toEqual([]);
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  it('soft deletes the rate, and it is gone from /get afterwards', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/delete?tax_id=${taxId}`)
      .set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const after = await get(`tax_id=${taxId}`);
    expect(after.status).toBe(404);
  });

  it('frees the name for reuse once deleted', async () => {
    const res = await post({ tax_name: NAME, tax_code: CODE });
    expect(res.status).toBe(201);
    await prisma.taxRateMaster.deleteMany({ where: { taxId: res.body.data.tax_id } });
  });
});
