import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { appendFileSync } from 'fs';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * DEBUG TRACE of POST /api/v1/stock/physical/create.
 *
 * Taps Prisma's `query` event on the app's own PrismaService, so every
 * statement the request issues is captured in order, with the table it touches
 * and whether it reads or writes. Runs the route twice: once as a DRAFT, once
 * with status POSTED, so the extra work the post does is visible as the
 * difference between the two traces.
 */

const BASE = '/api/v1/stock/physical';
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-09-10';
const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  godownId: '019daae6-c65c-7eb8-9ba2-7659611b0a01',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';
const prisma = new PrismaClient();

/** Statement → the object it touches and what it does to it. */
function classify(sql: string): { verb: string; target: string } {
  const s = sql.replace(/\s+/g, ' ').trim();
  const verb = (
    s.match(
      /^(SELECT|INSERT INTO|UPDATE|DELETE FROM|WITH|BEGIN|COMMIT|ROLLBACK|SET|DEALLOCATE)/i,
    )?.[1] ?? '?'
  ).toUpperCase();
  const tables = [
    ...s.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+"?([a-z_]+)"?\."?([a-z_]+)"?/gi),
  ].map((m) => `${m[1]}.${m[2]}`);
  const fns = [...s.matchAll(/\b(stock|accounts|public)\.(fn_[a-z_]+)\s*\(/gi)].map(
    (m) => `${m[1]}.${m[2]}()`,
  );
  const uniq = [...new Set([...fns, ...tables])];
  return { verb, target: uniq.join(', ') || '—' };
}

describe('DEBUG POST /stock/physical/create', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let capture: Array<{ verb: string; target: string; sql: string }> | null = null;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-phy-debug',
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

    // Tap the app's OWN client, so what is captured is what the route runs.
    // PrismaService picks its log level at runtime, so the generated client
    // cannot type the 'query' event; the cast says what the event carries.
    const svc = app.get<{ $on(event: 'query', cb: (ev: { query: string }) => void): void }>(
      PrismaService,
    );
    svc.$on('query', (ev) => {
      if (!capture) return;
      const { verb, target } = classify(ev.query);
      capture.push({ verb, target, sql: ev.query.replace(/\s+/g, ' ').slice(0, 190) });
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  }, 60_000);

  async function trace(label: string, run: () => request.Test): Promise<any> {
    capture = [];
    const res = await run();
    await new Promise((r) => setTimeout(r, 250)); // let the last events land
    const steps = capture;
    capture = null;
    const lines = [`##### ${label} → HTTP ${res.status} — ${steps.length} statements`];
    steps.forEach((s, i) => {
      lines.push(`  ${String(i + 1).padStart(2)}. ${s.verb.padEnd(11)} ${s.target}`);
      lines.push(`      ${s.sql}`);
    });
    appendFileSync(process.env.TRACE_OUT!, lines.join('\n') + '\n\n');
    return res;
  }

  let sheet: any[] = [];
  let lotA: any;
  let lotB: any;

  it('captures the count sheet, then traces both forms of create', async () => {
    const cs = await http.get(`${BASE}/count-sheet`).set('Authorization', BEARER).query({
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      godownId: SCOPE.godownId,
    });
    sheet = (cs.body.data.items as any[]).filter((r) => Number(r.bookQty) >= 1);
    expect(sheet.length).toBeGreaterThanOrEqual(2);
    lotA = sheet[0];
    lotB = sheet[1];

    const header = (over: any = {}) => ({
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      deviceId: SCOPE.deviceId,
      docDate: DOC_DATE,
      toGodownId: SCOPE.godownId,
      userId: ACTOR,
      remarks: 'E2E-PHY debug trace',
      ...over,
    });
    const line = (row: any, counted: number) => ({
      lineNo: 1,
      splitNo: row.splitNo,
      itemId: row.itemId,
      godownId: row.godownId,
      bucket: row.bucket,
      lotId: row.lotId,
      countedQty: counted,
    });

    const draft = await trace('A. create — status DRAFT (agreeing line)', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send({ header: header(), lines: [line(lotA, Number(lotA.bookQty))] }),
    );
    expect(draft.status).toBe(201);

    const posted = await trace('B. create — status POSTED (+3 overage)', () =>
      http
        .post(`${BASE}/create`)
        .set('Authorization', BEARER)
        .send({
          header: header({ status: 'POSTED' }),
          lines: [line(lotB, Number(lotB.bookQty) + 3)],
        }),
    );
    expect(posted.status).toBe(201);

    // Put it back.
    await http.post(`${BASE}/cancel`).set('Authorization', BEARER).send({
      svhId: posted.body.data.header.svhId,
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
      reason: 'E2E-PHY debug trace — reversing so the branch nets to zero',
    });
    await http.post(`${BASE}/cancel`).set('Authorization', BEARER).send({
      svhId: draft.body.data.header.svhId,
      accYear: ACC_YEAR,
      companyId: SCOPE.companyId,
      branchId: SCOPE.branchId,
      userId: ACTOR,
      reason: 'E2E-PHY debug trace — abandoning the draft',
    });
  }, 180_000);
});
