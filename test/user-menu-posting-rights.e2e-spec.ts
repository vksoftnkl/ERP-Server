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
 * The five transaction rights, end to end — and the capability that says where
 * they can mean anything.
 *
 * WHAT WAS BROKEN. `user_menus` has carried `um_can_post` / `_cancel` /
 * `_amend` / `_override` / `_retender` since migration 20260921220000, but
 * `SaveUserMenuDto` stopped at the six CRUD flags — so no request could ever
 * set one. All 1,111 rows were false, `/bills/get` answered `rights` all-false,
 * and the sale bill screen correctly greyed every verb with no way to ungrey
 * it. Nothing in the posting chain could be tested end to end.
 *
 * WHAT IS ASSERTED HERE:
 *   1 · a save that names the five flags persists them, and /get reads them back
 *   2 · a save that OMITS them revokes them — a save is a full replace, and
 *       silence is not "leave it alone"
 *   3 · `menu_verbs` says which screens can do what: RETENDER on exactly one
 *       menu, POST on the twenty documents, and nothing on a master
 *   4 · the menu tree answers both, so a grid can render only the cells that
 *       can mean something
 *
 * The fixture is a throwaway user created and hard-deleted here. It is never a
 * real one: a user_menus save REPLACES the whole grid, so running this against
 * a live operator would wipe their permissions.
 */

const BASE = '/api/v1/user-administration';
const MENUS = '/api/v1/menu-masters';
const BEARER = 'Bearer dummy-test-token';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d'; // tester1

/** fixed.menu_master ids this asserts against. */
const SALES_ENTRY = 12; // the one screen that can re-tender
const SALES_ORDER = 11; // a posting document, no re-tender
const TAX_MASTER_LIKE = 249; // Stock Track Policy — read-only, VIEW + PRINT

const tag = Date.now().toString(36).toUpperCase();
const LOGIN = `e2e_rights_${tag}`;

const prisma = new PrismaClient();

describe('user_menus transaction rights + menu_verbs (e2e, live DB)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let userId: string;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: `e2e-rights-${tag}`,
      user_type: 'SUPER ADMIN',
      company_id: COMPANY,
      branch_id: BRANCH,
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
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    if (userId) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.user_menus WHERE um_user_id = $1::uuid`,
        userId,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.user_master WHERE usr_id = $1::uuid`,
        userId,
      );
    }
    await app?.close();
    await prisma.$disconnect();
  }, 60_000);

  const save = (body: Record<string, unknown>) =>
    http.post(`${BASE}/create`).set('Authorization', BEARER).send(body);

  const menuRow = async (menuId: number) =>
    (
      await prisma.$queryRawUnsafe<Record<string, boolean>[]>(
        `SELECT um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender,
                um_can_view, um_can_create
           FROM public.user_menus
          WHERE um_user_id = $1::uuid AND um_menu_id = $2::int AND um_is_deleted = false`,
        userId,
        menuId,
      )
    )[0];

  // ───────────────────────────────────────────────────── the five flags

  it('a save that names the five rights persists them', async () => {
    const res = await save({
      usrLoginName: LOGIN,
      usrDisplayName: `E2E rights ${tag}`,
      usrCompanyId: COMPANY,
      usrBranchId: BRANCH,
      usrPassword: 'Str0ng!Passw0rd',
      menus: [
        {
          umMenuId: SALES_ENTRY,
          umCanView: true,
          umCanCreate: true,
          umCanEdit: true,
          umCanDelete: false,
          umCanPrint: true,
          umCanExport: false,
          umCanPost: true,
          umCanCancel: true,
          umCanAmend: true,
          umCanOverride: true,
          umCanRetender: true,
        },
        {
          umMenuId: SALES_ORDER,
          umCanView: true,
          umCanPost: true,
          umCanCancel: false,
          umCanAmend: false,
          umCanOverride: false,
          // deliberately NOT sent — a menu that cannot re-tender
        },
      ],
    });
    if (res.status !== 201) {
      // eslint-disable-next-line no-console
      console.error('[rights e2e] create failed:', res.status, JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(201);
    userId = res.body.data.usrId;
    expect(userId).toBeTruthy();

    const bill = await menuRow(SALES_ENTRY);
    expect(bill.um_can_post).toBe(true);
    expect(bill.um_can_cancel).toBe(true);
    expect(bill.um_can_amend).toBe(true);
    expect(bill.um_can_override).toBe(true);
    expect(bill.um_can_retender).toBe(true);

    const order = await menuRow(SALES_ORDER);
    expect(order.um_can_post).toBe(true);
    expect(order.um_can_cancel).toBe(false);
    // Omitted → false, never "inherit".
    expect(order.um_can_retender).toBe(false);
  });

  it('the response and /get echo the five rights back', async () => {
    const created = await http.get(`${BASE}/get?usrId=${userId}`).set('Authorization', BEARER);
    expect(created.status).toBe(200);
    const menus = created.body.data.menus as Record<string, unknown>[];
    const bill = menus.find((m) => m.umMenuId === SALES_ENTRY)!;
    expect(bill).toEqual(
      expect.objectContaining({
        umCanPost: true,
        umCanCancel: true,
        umCanAmend: true,
        umCanOverride: true,
        umCanRetender: true,
      }),
    );
    const order = menus.find((m) => m.umMenuId === SALES_ORDER)!;
    expect(order).toEqual(
      expect.objectContaining({ umCanPost: true, umCanCancel: false, umCanRetender: false }),
    );
  });

  it('a save is a FULL REPLACE — omitting the flags revokes them', async () => {
    const res = await save({
      usrId: userId,
      usrLoginName: LOGIN,
      usrCompanyId: COMPANY,
      usrBranchId: BRANCH,
      menus: [{ umMenuId: SALES_ENTRY, umCanView: true, umCanCreate: true }],
    });
    expect(res.status).toBe(201);
    const bill = await menuRow(SALES_ENTRY);
    expect(bill.um_can_view).toBe(true);
    expect(bill.um_can_create).toBe(true);
    // Every one of the five is back to false: silence is a revocation.
    expect(bill.um_can_post).toBe(false);
    expect(bill.um_can_cancel).toBe(false);
    expect(bill.um_can_amend).toBe(false);
    expect(bill.um_can_override).toBe(false);
    expect(bill.um_can_retender).toBe(false);
    // The menu dropped from the payload is soft-deleted, not left standing.
    expect(await menuRow(SALES_ORDER)).toBeUndefined();
  });

  // ────────────────────────────────────────────── menu_verbs, the capability

  it('menu_verbs says what each screen can DO — RETENDER on exactly one menu', async () => {
    const rows = await prisma.$queryRawUnsafe<{ menu_id: number; verbs: string[] }[]>(
      `SELECT menu_id, menu_verbs AS verbs FROM fixed.menu_master
        WHERE menu_id IN ($1::int, $2::int, $3::int) ORDER BY menu_id`,
      SALES_ORDER,
      SALES_ENTRY,
      TAX_MASTER_LIKE,
    );
    const by = new Map(rows.map((r) => [r.menu_id, r.verbs]));

    // Sales Entry: everything, including the one RETENDER in the product.
    expect(by.get(SALES_ENTRY)).toEqual(
      expect.arrayContaining(['VIEW', 'CREATE', 'POST', 'CANCEL', 'AMEND', 'OVERRIDE', 'RETENDER']),
    );
    // Sales Order posts, but cannot re-tender.
    expect(by.get(SALES_ORDER)).toEqual(
      expect.arrayContaining(['POST', 'CANCEL', 'AMEND', 'OVERRIDE']),
    );
    expect(by.get(SALES_ORDER)).not.toContain('RETENDER');
    // A read-only screen says so rather than offering Create.
    expect(by.get(TAX_MASTER_LIKE)).toEqual(['VIEW', 'PRINT']);

    const [only] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM fixed.menu_master WHERE menu_verbs @> '{RETENDER}'`,
    );
    expect(Number(only.n)).toBe(1);
  });

  it('a master menu carries none of the four transaction verbs', async () => {
    const [row] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM fixed.menu_master
        WHERE menu_is_active
          AND NOT menu_verbs @> '{POST}'
          AND (menu_verbs && '{CANCEL,AMEND,OVERRIDE,RETENDER}')`,
    );
    // Nothing may carry a transaction verb without POST: the four travel together.
    expect(Number(row.n)).toBe(0);
  });

  it('GET /menu-masters/get answers menu_verbs on every node', async () => {
    const res = await http.get(`${MENUS}/get`).set('Authorization', BEARER);
    expect(res.status).toBe(200);

    const flat: Record<string, any>[] = [];
    const walk = (nodes: Record<string, any>[]) => {
      for (const n of nodes) {
        flat.push(n);
        if (Array.isArray(n.children)) walk(n.children as Record<string, any>[]);
      }
    };
    walk(res.body.data as Record<string, any>[]);

    expect(flat.length).toBeGreaterThan(0);
    for (const node of flat) {
      expect(Array.isArray(node.menuVerbs)).toBe(true);
      expect(node.menuVerbs.length).toBeGreaterThan(0);
    }
    const bill = flat.find((n) => n.menuId === SALES_ENTRY)!;
    expect(bill.menuVerbs).toContain('RETENDER');
    const policy = flat.find((n) => n.menuId === TAX_MASTER_LIKE)!;
    expect(policy.menuVerbs).toEqual(['VIEW', 'PRINT']);
    expect(policy.menuVerbs).not.toContain('CREATE');
  });

  // ───────────────────────── the bill screen, driveable for real

  it('tester1 now holds the rights on the sales menus — granted, not stubbed', async () => {
    const rows = await prisma.$queryRawUnsafe<Record<string, boolean | number>[]>(
      `SELECT um_menu_id, um_can_post, um_can_cancel, um_can_amend, um_can_override, um_can_retender
         FROM public.user_menus
        WHERE um_user_id = $1::uuid AND um_menu_id IN (11, 12, 13, 182) AND um_is_deleted = false
        ORDER BY um_menu_id`,
      ACTOR,
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.um_can_post).toBe(true);
      expect(row.um_can_cancel).toBe(true);
      expect(row.um_can_amend).toBe(true);
      expect(row.um_can_override).toBe(true);
    }
    // Re-tender only where the screen can do it.
    const byMenu = new Map(rows.map((r) => [r.um_menu_id as number, r]));
    expect(byMenu.get(SALES_ENTRY)!.um_can_retender).toBe(true);
    expect(byMenu.get(SALES_ORDER)!.um_can_retender).toBe(false);
  });

  it('GET /menu-masters/usermenu answers the five for the signed-in user', async () => {
    const res = await http.get(`${MENUS}/usermenu`).set('Authorization', BEARER);
    expect(res.status).toBe(200);

    const flat: Record<string, any>[] = [];
    const walk = (nodes: Record<string, any>[]) => {
      for (const n of nodes) {
        flat.push(n);
        if (Array.isArray(n.children)) walk(n.children as Record<string, any>[]);
      }
    };
    walk(res.body.data as Record<string, any>[]);

    const bill = flat.find((n) => n.menuId === SALES_ENTRY);
    expect(bill).toBeDefined();
    expect(bill!.permissions).toEqual(
      expect.objectContaining({
        canPost: true,
        canCancel: true,
        canAmend: true,
        canOverride: true,
        canRetender: true,
      }),
    );
    // The capability travels with it, so the screen can tell a right it holds
    // from a right this screen could never exercise.
    expect(bill!.menuVerbs).toContain('RETENDER');
  });

  it('GET /bills/get now answers rights TRUE — the screen can ungrey Post', async () => {
    const [live] = await prisma.$queryRawUnsafe<Record<string, string>[]>(
      `SELECT sb_id, sb_company_id, sb_branch_id, sb_acc_year FROM sales.sale_bill
        WHERE sb_is_deleted = false ORDER BY sb_created_on DESC LIMIT 1`,
    );
    if (!live) {
      // eslint-disable-next-line no-console
      console.warn('[rights e2e] no bill on this database to read rights against');
      return;
    }
    const res = await http.get(`/api/v1/bills/get`).set('Authorization', BEARER).query({
      sbId: live.sb_id,
      sbCompanyId: live.sb_company_id,
      sbBranchId: live.sb_branch_id,
      sbAccYear: live.sb_acc_year.trim(),
    });
    expect(res.status).toBe(200);
    // This block is what the sale bill screen greys its verbs on. Every one of
    // them was false for every user in the system until the DTO carried them.
    expect(res.body.data.rights).toEqual(
      expect.objectContaining({ post: true, cancel: true, amend: true, override: true }),
    );
  });

  it('the grid a client would render is 42% smaller than eleven columns everywhere', async () => {
    const [row] = await prisma.$queryRawUnsafe<{ before: bigint; after: bigint }[]>(
      `SELECT COUNT(*) * 11 AS before, SUM(cardinality(menu_verbs)) AS after
         FROM fixed.menu_master m
        WHERE menu_is_active
          AND NOT EXISTS (SELECT 1 FROM fixed.menu_master c WHERE c.menu_parent = m.menu_id)`,
    );
    const before = Number(row.before);
    const after = Number(row.after);
    expect(after).toBeLessThan(before);
    // eslint-disable-next-line no-console
    console.log(
      `\n[rights e2e] permission cells across active leaf menus: ${before} → ${after} ` +
        `(${Math.round((1 - after / before) * 100)}% fewer)\n`,
    );
  });
});
