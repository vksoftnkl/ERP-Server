// Preload .env exactly like src/main.ts so API_VERSION etc. are present before
// the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * WHOLE-SURFACE SMOKE TEST. Boots the real app, enumerates every registered
 * route from the router, and hits each one with a valid (stubbed) token. The
 * question is narrow and cheap to answer across 298 routes: does any endpoint
 * return a 5xx? A read that crashes, or a write that 500s before validation, is
 * a bug (that is how the transfer uuid=text and item_name bugs surfaced). A
 * 400/401/403/404/422 is a healthy, reachable endpoint refusing a bare call.
 *
 * Mutations are fired with nil-uuid path/query params and an empty body, so a
 * handler that runs anyway targets nothing real. See memory:
 * erp-server-http-testing-without-credentials.
 */

const NIL = '00000000-0000-4000-8000-000000000000';
const BEARER = 'Bearer dummy-test-token';
const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  accYear: '2026-2027',
};
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1

interface RouteInfo {
  method: string;
  path: string;
}

interface Result {
  method: string;
  path: string;
  status: number;
  message?: string;
}

function collectRoutes(app: INestApplication): RouteInfo[] {
  const server = app.getHttpAdapter().getInstance() as {
    _router?: { stack: unknown[] };
    router?: { stack: unknown[] };
  };
  const stack = (server._router?.stack ?? server.router?.stack ?? []) as Array<{
    route?: { path: string; methods: Record<string, boolean> };
  }>;
  const routes: RouteInfo[] = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    const { path } = layer.route;
    for (const m of Object.keys(layer.route.methods)) {
      if (layer.route.methods[m]) routes.push({ method: m.toUpperCase(), path });
    }
  }
  return routes;
}

// Replace :params with a sample value so the route matches its handler.
function concretePath(path: string): string {
  return path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? NIL : seg))
    .join('/');
}

describe('All endpoints smoke test (e2e — live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let routes: RouteInfo[] = [];
  const results: Result[] = [];

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-smoke-session',
      user_type: 'SUPER ADMIN',
      company_id: SCOPE.companyId,
      branch_id: SCOPE.branchId,
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
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: process.env.API_VERSION ?? '1' });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    http = request(app.getHttpServer());
    routes = collectRoutes(app);
  }, 60000);

  afterAll(async () => {
    // Self-clean the one write that succeeds on an empty body: POST
    // /sale-loading-charges/create has no required fields, so hitting it leaves
    // an all-null/zero row. Remove exactly those so re-runs do not accumulate.
    const prisma = new PrismaClient();
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM sales.sale_loading_charges
          WHERE ilc_comp_id IS NULL AND ilc_branch_id IS NULL
            AND COALESCE(ilc_from_weight,0)=0 AND COALESCE(ilc_to_weight,0)=0
            AND COALESCE(ilc_load_chrg,0)=0 AND COALESCE(ilc_unload_chrg,0)=0
            AND ilc_created_on > now() - interval '30 minutes'`,
      );
    } finally {
      await prisma.$disconnect();
    }
    await app?.close();
  });

  it('hits every route with a token; no endpoint may return 5xx', async () => {
    expect(routes.length).toBeGreaterThan(100);

    for (const r of routes) {
      const path = concretePath(r.path);
      // Scope params help GET list endpoints; extra ones are refused with 400 by
      // forbidNonWhitelisted, which is still a healthy (non-5xx) answer.
      const query = r.method === 'GET' ? SCOPE : {};
      let req = (http as any)[r.method.toLowerCase()](path).set('Authorization', BEARER);
      if (r.method === 'GET') req = req.query(query);
      else req = req.send({});
      let status = 0;
      let message: string | undefined;
      try {
        const res = await req;
        status = res.status;
        message =
          typeof res.body?.message === 'string'
            ? res.body.message
            : Array.isArray(res.body?.message)
              ? res.body.message.join('; ')
              : undefined;
      } catch (err) {
        status = 599;
        message = String(err);
      }
      results.push({ method: r.method, path: r.path, status, message });
    }

    // ── Report ────────────────────────────────────────────────────────────
    const byStatus = new Map<number, number>();
    for (const res of results) byStatus.set(res.status, (byStatus.get(res.status) ?? 0) + 1);
    const dist = [...byStatus.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${s}: ${n}`);
    const server5xx = results.filter((r) => r.status >= 500);

    // eslint-disable-next-line no-console
    console.log(`\n[smoke] ${results.length} routes hit. status distribution → ${dist.join(', ')}`);
    // eslint-disable-next-line no-console
    console.log(`[smoke] ${server5xx.length} routes returned 5xx:`);
    for (const r of server5xx) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.status}  ${r.method} ${r.path}  — ${r.message ?? ''}`);
    }

    // Writes that succeeded on an empty body / nil ids — worth a look: a handler
    // that mutates with all-null input.
    const writes2xx = results.filter(
      (r) => r.method !== 'GET' && r.status >= 200 && r.status < 300,
    );
    // eslint-disable-next-line no-console
    console.log(`[smoke] ${writes2xx.length} write routes returned 2xx on an empty body:`);
    for (const r of writes2xx) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.status}  ${r.method} ${r.path}  — ${r.message ?? ''}`);
    }

    // The whole point: no endpoint should crash. If any do, the list above is
    // the finding.
    expect(server5xx.map((r) => `${r.method} ${r.path}`)).toEqual([]);
  }, 180000);

  it('enforces auth: protected routes 401 without a token', async () => {
    // Sample the GET routes (safe, read-only) without a token. Public routes
    // (health, etc.) may 200; everything else must 401.
    const gets = routes.filter((r) => r.method === 'GET');
    const noAuth: Result[] = [];
    for (const r of gets) {
      const res = await http.get(concretePath(r.path)).query(SCOPE);
      noAuth.push({ method: r.method, path: r.path, status: res.status });
    }
    const notProtected = noAuth.filter((r) => r.status !== 401);
    // eslint-disable-next-line no-console
    console.log(
      `\n[smoke] ${gets.length} GET routes without a token: ${
        gets.length - notProtected.length
      } returned 401; ${notProtected.length} did not:`,
    );
    for (const r of notProtected) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.status}  GET ${r.path}`);
    }
    // Most routes must be protected; a handful of public ones (health) are fine.
    expect(notProtected.length).toBeLessThan(gets.length * 0.15);
  }, 120000);
});
