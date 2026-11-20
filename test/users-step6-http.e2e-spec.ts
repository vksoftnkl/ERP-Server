// Preload .env exactly like src/main.ts (DATABASE_URL, API_VERSION …) before AppModule loads.
import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { createHouseValidationPipe } from '../src/common/validation/house-validation';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { ACC_YEAR, BRANCH, COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';
import {
  MenuRightsMemo,
  TESTER1,
  USERS_RIGHTS_MENU,
  grantMenuRights,
  restoreMenuRights,
} from './helpers/menu-rights';

/**
 * Users & Rights review step 6 (admin/review-users-rights-2026-11-19.md points 3, 10, 14,
 * 15; migration 20261120110000), over HTTP against the live database:
 *
 *   1 · max discount % on the save (decimal string, 0-100 or null, USER_MAX_DISC_INVALID);
 *   2 · login: the real reason only after a right password (inactive / channel off),
 *       a wrong one stays AUTH_INVALID_CREDENTIALS;
 *   3 · reset password (typed / generated) → mustChangePassword → 403
 *       AUTH_PASSWORD_CHANGE_REQUIRED everywhere but /auth/change-password → changed;
 *   4 · unlock; 5 · delete → restore (inactive, no rights) and the login-name clash;
 *   6 · the Sale Bill rate / discount lock for a user without the right and with a limit.
 *
 * Auth: the administrator is tester1 ("Bearer dummy-test-token", stubbed claims, as every
 * suite); the ZT users this suite makes log in FOR REAL through /auth/login, their tokens
 * signed and verified by a TokenService with a test secret, so the pwc claim and the guard
 * run exactly as live. Sessions are not kept (AuthSessionService stubbed).
 *
 * Real writes, ZT- names; the teardown deletes only the users this run created (with their
 * menu rows and login-session rows). No bill is written: the lock's refusals roll back.
 *
 *     npm run test:e2e -- users-step6-http --runInBand
 */

jest.setTimeout(240_000);

const USERS = '/api/v1/user-administration';
const LOGIN = '/api/v1/auth/login';
const CHANGE_PASSWORD = '/api/v1/auth/change-password';
const BILLS = '/api/v1/bills';
const ADMIN_TOKEN = 'dummy-test-token';
const SALE_BILL_MENU = 12;
const DC_MENU = 182;
const SO_DESK_MENU = 299;
/** "CD - AFTER TAX": a sales DEDUCT charge the master auto-applies, default rate 0. */
const CD_AFTER_TAX = 'bf12e18d-56fd-4bc6-8246-4467367a506f';
// The live sales fixtures the existing suites use: ZT-ITEM-B (level-1 price 105, tax
// inclusive, no customer rate, no slab), its godown, the desktop device, ZT-CUST-CASH.
const ITEM_B = {
  itemId: '01a0d242-56a9-7e80-95ea-4b6141872fa7',
  unitId: '01a0d242-56bf-7512-b62b-fed348185fcb',
};
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const DEVICE = '019ea5d1-261f-7f3d-b350-93a30c147788';
const CASH_CUSTOMER = '01a0d242-55c9-753f-8945-abdc4e15c0c1';

const stamp = Date.now().toString(36).toUpperCase();
const PASSWORD = `ztS6e-${stamp}`;
const createdUserIds: string[] = [];
let app: INestApplication;
let rights: MenuRightsMemo | null = null;

const signer = new TokenService({
  get: (key: string, fallback?: unknown) =>
    key === 'auth.jwtSecret' ? 'users-step6-e2e' : fallback,
} as unknown as ConfigService);
const adminClaims: AccessTokenPayload = {
  sub: TESTER1,
  user_name: 'tester1',
  sid: 'e2e-test-session',
  user_type: 'SUPER ADMIN',
  company_id: COMPANY,
  branch_id: BRANCH,
  device_id: null,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  typ: 'access',
};

const api = () => request(app.getHttpServer());
const as = <T extends request.Test>(req: T, token = ADMIN_TOKEN): T =>
  req.set('Authorization', `Bearer ${token}`);
const errorOf = (res: request.Response) =>
  (res.body as { errors?: Array<Record<string, unknown>> }).errors?.[0] ?? {};

async function newUser(tag: string, extra: Record<string, unknown> = {}) {
  const usrLoginName = `ZT-S6E-${tag}-${stamp}`;
  const res = await as(api().post(`${USERS}/create`)).send({
    usrLoginName,
    usrPassword: PASSWORD,
    usrType: 'USER',
    usrFullName: `ZT step6 e2e ${tag}`,
    usrCompanyId: COMPANY,
    usrBranchId: BRANCH,
    usrDesktopLogin: true,
    usrWebLogin: false,
    usrMobileLogin: false,
    usrIsActive: true,
    ...extra,
  });
  expectStatus(res, 201);
  const user = data<{ usrId: string; usrLoginName: string; usrMaxDiscPerc: string | null }>(res);
  createdUserIds.push(user.usrId);
  return user;
}

const login = (usrLoginName: string, usrPassword: string, device_type = 'PC') =>
  api().post(LOGIN).send({ usrLoginName, usrPassword, device_type });

beforeAll(async () => {
  rights = await grantMenuRights(prisma, [USERS_RIGHTS_MENU]);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenService)
    .useValue({
      signAccessToken: signer.signAccessToken.bind(signer),
      signRefreshToken: signer.signRefreshToken.bind(signer),
      verifyRefreshToken: signer.verifyRefreshToken.bind(signer),
      verifyAccessToken: (token: string): AccessTokenPayload =>
        token === ADMIN_TOKEN ? adminClaims : signer.verifyAccessToken(token),
    })
    .overrideProvider(AuthSessionService)
    .useValue({
      createSessionId: () => randomUUID(),
      storeTokenSession: async (): Promise<void> => undefined,
      assertAccessTokenIsActive: async (): Promise<void> => undefined,
      assertRefreshTokenIsActive: async (): Promise<void> => undefined,
    })
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(createHouseValidationPipe());
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: process.env.API_VERSION ?? '1',
  });
  app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
  await app.init();
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.userLoginSession.deleteMany({ where: { ulsUserId: { in: createdUserIds } } });
    await prisma.userMenus.deleteMany({ where: { umUserId: { in: createdUserIds } } });
    await prisma.userMaster.deleteMany({ where: { usrId: { in: createdUserIds } } });
  }
  await restoreMenuRights(prisma, rights);
  await app?.close();
  await prisma.$disconnect();
});

describe('Users & Rights step 6 over HTTP (e2e, live DB, writes)', () => {
  it('max discount %: stored as typed, answered "12.50"; 101 is 400 USER_MAX_DISC_INVALID', async () => {
    const user = await newUser('MAX', { usrMaxDiscPerc: '12.5' });
    expect(user.usrMaxDiscPerc).toBe('12.50');
    const bad = await as(api().post(`${USERS}/create`)).send({
      usrId: user.usrId,
      usrLoginName: user.usrLoginName,
      usrMaxDiscPerc: 101,
    });
    expectStatus(bad, 400);
    expect(errorOf(bad)).toMatchObject({ field: 'usrMaxDiscPerc', code: 'USER_MAX_DISC_INVALID' });
    const cleared = await as(api().post(`${USERS}/create`)).send({
      usrId: user.usrId,
      usrLoginName: user.usrLoginName,
      usrMaxDiscPerc: null,
    });
    expectStatus(cleared, 201);
    expect(data<{ usrMaxDiscPerc: string | null }>(cleared).usrMaxDiscPerc).toBeNull();
  });

  it('login: wrong password says nothing; the right one names the state (inactive, channel)', async () => {
    const user = await newUser('LOGIN');
    const wrong = await login(user.usrLoginName, 'not-it');
    expectStatus(wrong, 401);
    expect(errorOf(wrong).code).toBe('AUTH_INVALID_CREDENTIALS');
    const ok = await login(user.usrLoginName.toLowerCase(), PASSWORD);
    expectStatus(ok, 200);
    expect(ok.body).toMatchObject({ usrId: user.usrId, mustChangePassword: false });

    await as(api().post(`${USERS}/create`)).send({
      usrId: user.usrId,
      usrLoginName: user.usrLoginName,
      usrIsActive: false,
    });
    const inactive = await login(user.usrLoginName, PASSWORD);
    expectStatus(inactive, 401);
    expect(errorOf(inactive).code).toBe('AUTH_USER_INACTIVE');
    expect(errorOf(await login(user.usrLoginName, 'not-it')).code).toBe('AUTH_INVALID_CREDENTIALS');

    await as(api().post(`${USERS}/create`)).send({
      usrId: user.usrId,
      usrLoginName: user.usrLoginName,
      usrIsActive: true,
      usrDesktopLogin: false,
    });
    const channel = await login(user.usrLoginName, PASSWORD, 'PC');
    expectStatus(channel, 401);
    expect(errorOf(channel)).toMatchObject({ code: 'AUTH_CHANNEL_DISABLED', channel: 'desktop' });
  });

  it('reset (generated) → mustChangePassword → only change-password → the same session goes on', async () => {
    const user = await newUser('RESET');
    const both = await as(api().post(`${USERS}/reset-password`)).send({
      usrId: user.usrId,
      newPassword: 'abcd',
      generate: true,
    });
    expectStatus(both, 400);
    expect(errorOf(both).code).toBe('USER_RESET_PASSWORD_CHOICE');
    const short = await as(api().post(`${USERS}/reset-password`)).send({
      usrId: user.usrId,
      newPassword: 'ab',
    });
    expectStatus(short, 400);
    expect(errorOf(short)).toMatchObject({ field: 'newPassword', code: 'USER_PASSWORD_TOO_SHORT' });

    const reset = await as(api().post(`${USERS}/reset-password`)).send({
      usrId: user.usrId,
      generate: true,
    });
    expectStatus(reset, 200);
    const answer = data<{ generatedPassword: string; usrMustChangePassword: boolean }>(reset);
    expect(answer.generatedPassword).toMatch(/^[A-Za-z2-9]{8}$/);
    expect(answer.usrMustChangePassword).toBe(true);

    const first = await login(user.usrLoginName, answer.generatedPassword);
    expectStatus(first, 200);
    expect(first.body.mustChangePassword).toBe(true);
    const token = (first.body as { access_token: string }).access_token;

    const blocked = await as(api().get(`${USERS}/get`).query({ usrId: user.usrId }), token);
    expectStatus(blocked, 403);
    expect(errorOf(blocked).code).toBe('AUTH_PASSWORD_CHANGE_REQUIRED');

    const changed = await as(api().post(CHANGE_PASSWORD), token).send({
      currentPassword: answer.generatedPassword,
      newPassword: PASSWORD,
    });
    expectStatus(changed, 200);
    expectStatus(await as(api().get(`${USERS}/get`).query({ usrId: user.usrId }), token), 200);

    const notes = await prisma.$queryRawUnsafe<{ log_notes: string }[]>(
      `SELECT log_notes FROM audit.audit_log WHERE log_pk = $1 AND log_notes LIKE 'Password reset by%'`,
      user.usrId,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].log_notes).not.toContain(answer.generatedPassword);
  });

  it('unlock clears the failed-login count; nothing left = changed false', async () => {
    const user = await newUser('UNLOCK');
    await login(user.usrLoginName, 'not-it');
    const first = await as(api().post(`${USERS}/unlock`).query({ usrId: user.usrId })).send();
    expectStatus(first, 200);
    expect(data(first)).toEqual({
      usrId: user.usrId,
      usrIsLocked: false,
      usrFailedLoginCount: 0,
      usrLockedOn: null,
      usrLockedBy: null,
      changed: true,
    });
    const again = await as(api().post(`${USERS}/unlock`).query({ usrId: user.usrId })).send();
    expect(data<{ changed: boolean }>(again).changed).toBe(false);
  });

  it('delete → restore comes back inactive WITH the rights the delete removed; a live holder of the name blocks it', async () => {
    const user = await newUser('RESTORE', {
      menus: [
        { umMenuId: SALE_BILL_MENU, umCanView: true, umCanCreate: true, umCanPost: true },
        { umMenuId: DC_MENU, umCanView: true },
        { umMenuId: SO_DESK_MENU, umCanView: true },
      ],
    });
    // An earlier save takes SO Desk away: that row must NOT come back with the restore.
    expectStatus(
      await as(api().post(`${USERS}/create`)).send({
        usrId: user.usrId,
        usrLoginName: user.usrLoginName,
        menus: [
          { umMenuId: SALE_BILL_MENU, umCanView: true, umCanCreate: true, umCanPost: true },
          { umMenuId: DC_MENU, umCanView: true },
        ],
      }),
      201,
    );
    expectStatus(await as(api().delete(`${USERS}/delete`).query({ usrId: user.usrId })), 200);
    const deleted = await login(user.usrLoginName, PASSWORD);
    expect(errorOf(deleted).code).toBe('AUTH_USER_INACTIVE');

    const holder = await newUser('HOLDER', { usrLoginName: user.usrLoginName.toLowerCase() });
    const taken = await as(api().post(`${USERS}/restore`).query({ usrId: user.usrId })).send();
    expectStatus(taken, 409);
    expect(errorOf(taken)).toMatchObject({
      code: 'USER_RESTORE_LOGIN_TAKEN',
      loginName: holder.usrLoginName,
    });

    expectStatus(await as(api().delete(`${USERS}/delete`).query({ usrId: holder.usrId })), 200);
    const restored = await as(api().post(`${USERS}/restore`).query({ usrId: user.usrId })).send();
    expectStatus(restored, 200);
    expect(data(restored)).toEqual({
      usrId: user.usrId,
      usrLoginName: user.usrLoginName,
      usrIsDeleted: false,
      usrIsActive: false,
      menuCount: 2,
    });
    const back = await as(api().get(`${USERS}/get`).query({ usrId: user.usrId }));
    const restoredUser = data<{
      usrIsActive: boolean;
      menus: Array<{
        umMenuId: number;
        umCanView: boolean;
        umCanCreate: boolean;
        umCanPost: boolean;
      }>;
    }>(back);
    expect(restoredUser.usrIsActive).toBe(false);
    expect(restoredUser.menus.map((m) => m.umMenuId)).toEqual([SALE_BILL_MENU, DC_MENU]);
    expect(restoredUser.menus[0]).toMatchObject({
      umCanView: true,
      umCanCreate: true,
      umCanPost: true,
    });
    const notes = await prisma.$queryRawUnsafe<{ log_notes: string }[]>(
      `SELECT log_notes FROM audit.audit_log WHERE log_pk = $1 AND log_notes LIKE 'User restored%'`,
      user.usrId,
    );
    expect(notes.map((n) => n.log_notes)).toEqual([
      'User restored by tester1: inactive, with the 2 menu rights the delete removed',
    ]);
    const twice = await as(api().post(`${USERS}/restore`).query({ usrId: user.usrId })).send();
    expectStatus(twice, 409);
    expect(errorOf(twice).code).toBe('USER_NOT_DELETED');
  });

  describe('the Sale Bill rate / discount lock', () => {
    let userId: string;
    let loginName: string;
    let token: string;
    let loginBody: Record<string, unknown> = {};

    const bill = (
      rate: number,
      discAmt = 0,
      discPerc = 0,
      levels: { bill?: number; line?: number } = {},
      charges: Array<Record<string, unknown>> = [],
    ) => {
      const gross = 2 * rate;
      const net = gross - discAmt;
      return {
        sbCompanyId: COMPANY,
        sbBranchId: BRANCH,
        sbAccYear: ACC_YEAR,
        sbDeviceType: 'DESKTOP',
        sbDeviceId: DEVICE,
        sbPriceLevel: levels.bill ?? 1,
        sbCustId: CASH_CUSTOMER,
        sbCustName: 'ZT-CUST-CASH',
        sbUserId: userId,
        sbPayMode: 'CREDIT',
        sbCreditAmt: net,
        items: [
          {
            sbiItemId: ITEM_B.itemId,
            sbiItemUnitId: ITEM_B.unitId,
            sbiGodownId: GODOWN,
            sbiBillQty: 2,
            sbiNetQty: 2,
            sbiRate: rate,
            sbiRatePreTax: rate,
            sbiIsTaxIncl: true,
            sbiItemDiscPerc: discPerc,
            sbiItemDiscAmt: discAmt,
            sbiGrossAmt: gross,
            sbiTaxableAmt: net,
            sbiNetAmt: net,
            sbiLineNo: 1,
            ...(levels.line ? { sbiPriceLevel: levels.line } : {}),
          },
        ],
        charges,
        sbBillAmt: net,
        sbGrossAmt: gross,
        sbTaxableAmt: net,
      };
    };
    const LOCK = [
      'SALES_PRICE_LEVEL_NOT_ALLOWED',
      'SALES_RATE_CHANGE_NOT_ALLOWED',
      'SALES_DISC_NOT_ALLOWED',
      'SALES_LINE_DISC_OVER_USER_MAX',
      'SALES_BILL_DISC_OVER_USER_MAX',
    ];
    const lockRefusals = (res: request.Response) =>
      (data<{ refusals?: Array<{ code: string; line?: number }> }>(res).refusals ?? []).filter(
        (r) => LOCK.includes(r.code),
      );

    beforeAll(async () => {
      const user = await newUser('LOCK', {
        usrEditRate: false,
        usrMaxDiscPerc: '7.5',
        menus: [{ umMenuId: SALE_BILL_MENU, umCanView: true, umCanCreate: true, umCanEdit: true }],
      });
      userId = user.usrId;
      loginName = user.usrLoginName;
      const res = await login(loginName, PASSWORD);
      expectStatus(res, 200);
      token = (res.body as { access_token: string }).access_token;
      loginBody = res.body as Record<string, unknown>;
    });

    it("the login answers the user's own lock values (usrEditRate, usrMaxDiscPerc)", async () => {
      expect(loginBody).toMatchObject({ usrEditRate: false, usrMaxDiscPerc: '7.50' });
      await as(api().post(`${USERS}/create`)).send({
        usrId: userId,
        usrLoginName: loginName,
        usrMaxDiscPerc: null,
      });
      const again = await login(loginName, PASSWORD);
      expect(again.body).toMatchObject({ usrEditRate: false, usrMaxDiscPerc: null });
      await as(api().post(`${USERS}/create`)).send({
        usrId: userId,
        usrLoginName: loginName,
        usrMaxDiscPerc: '7.5',
      });
    });

    it('no right: the item rate passes; another rate and any typed discount are refused', async () => {
      const ok = await as(api().post(`${BILLS}/validate`), token).send(bill(105));
      expect(lockRefusals(ok)).toEqual([]);
      const rate = await as(api().post(`${BILLS}/validate`), token).send(bill(100));
      expect(lockRefusals(rate)).toEqual([
        expect.objectContaining({ code: 'SALES_RATE_CHANGE_NOT_ALLOWED', line: 1 }),
      ]);
      const disc = await as(api().post(`${BILLS}/validate`), token).send(bill(105, 10.5, 5));
      expect(lockRefusals(disc).map((r) => r.code)).toEqual(['SALES_DISC_NOT_ALLOWED']);

      const before = await prisma.saleBill.count({ where: { sbUserId: userId } });
      const create = await as(api().post(`${BILLS}/create`), token).send(bill(100));
      expectStatus(create, 403);
      expect(errorOf(create)).toMatchObject({ code: 'SALES_RATE_CHANGE_NOT_ALLOWED', line: 1 });
      expect(await prisma.saleBill.count({ where: { sbUserId: userId } })).toBe(before);
    });

    it("no right: the price level is the bill's default (customer / setting: level 1); another is refused", async () => {
      // ZT-ITEM-B sells at 105 on levels A and B alike, so only the level is judged here.
      const ok = await as(api().post(`${BILLS}/validate`), token).send(
        bill(105, 0, 0, { line: 1 }),
      );
      expect(lockRefusals(ok)).toEqual([]);
      const line = await as(api().post(`${BILLS}/validate`), token).send(
        bill(105, 0, 0, { line: 2 }),
      );
      expect(lockRefusals(line)).toEqual([
        expect.objectContaining({ code: 'SALES_PRICE_LEVEL_NOT_ALLOWED', line: 1, field: 'items' }),
      ]);
      const before = await prisma.saleBill.count({ where: { sbUserId: userId } });
      const header = await as(api().post(`${BILLS}/create`), token).send(
        bill(105, 0, 0, { bill: 2 }),
      );
      expectStatus(header, 403);
      expect(errorOf(header)).toMatchObject({
        code: 'SALES_PRICE_LEVEL_NOT_ALLOWED',
        field: 'sbPriceLevel',
      });
      expect(errorOf(header)).not.toHaveProperty('line');
      expect(await prisma.saleBill.count({ where: { sbUserId: userId } })).toBe(before);
    });

    /** The auto-applied "CD - AFTER TAX" row (chg_auto_apply, default 0) holding `amount`. */
    const cdAfterTax = async (amount: number) => {
      const master = await prisma.chargeMaster.findUniqueOrThrow({
        where: { chgId: CD_AFTER_TAX },
        select: { chgLedgerCode: true },
      });
      return {
        cdChgId: CD_AFTER_TAX,
        cdLedgerCode: master.chgLedgerCode,
        cdType: 'DEDUCT',
        cdMethod: 'FIXED',
        cdRate: 0,
        cdAmount: amount,
        cdBeforeTax: false,
      };
    };

    it('no right: the auto-applied CD row at its default (0) passes; typed 10 is refused (api-tester 11-20)', async () => {
      const atDefault = await as(api().post(`${BILLS}/validate`), token).send(
        bill(105, 0, 0, {}, [await cdAfterTax(0)]),
      );
      expect(lockRefusals(atDefault)).toEqual([]);
      const typedValidate = await as(api().post(`${BILLS}/validate`), token).send(
        bill(105, 0, 0, {}, [await cdAfterTax(10)]),
      );
      expect(lockRefusals(typedValidate)).toEqual([
        expect.objectContaining({ code: 'SALES_DISC_NOT_ALLOWED', field: 'charges' }),
      ]);
      const before = await prisma.saleBill.count({ where: { sbUserId: userId } });
      const typed = await as(api().post(`${BILLS}/create`), token).send(
        bill(105, 0, 0, {}, [await cdAfterTax(10)]),
      );
      expectStatus(typed, 403);
      expect(errorOf(typed)).toMatchObject({ code: 'SALES_DISC_NOT_ALLOWED', field: 'charges' });
      expect(await prisma.saleBill.count({ where: { sbUserId: userId } })).toBe(before);
    });

    it('with the right: any rate; a line discount over the 7.5 % limit is refused with {line, max}', async () => {
      await as(api().post(`${USERS}/create`)).send({
        usrId: userId,
        usrLoginName: loginName,
        usrEditRate: true,
      });
      const within = await as(api().post(`${BILLS}/validate`), token).send(bill(100, 10, 5));
      expect(lockRefusals(within)).toEqual([]);
      const over = await as(api().post(`${BILLS}/create`), token).send(bill(105, 21, 10));
      expectStatus(over, 403);
      expect(errorOf(over)).toMatchObject({
        code: 'SALES_LINE_DISC_OVER_USER_MAX',
        line: 1,
        max: '7.5',
      });
    });

    it('with the right: the typed auto-applied CD row counts towards the 7.5 % limit', async () => {
      // bill value with tax 210: 10 = 4.8 % (within), 20 = 9.5 % (over)
      const within = await as(api().post(`${BILLS}/validate`), token).send(
        bill(105, 0, 0, {}, [await cdAfterTax(10)]),
      );
      expect(lockRefusals(within)).toEqual([]);
      const over = await as(api().post(`${BILLS}/create`), token).send(
        bill(105, 0, 0, {}, [await cdAfterTax(20)]),
      );
      expectStatus(over, 403);
      expect(errorOf(over)).toMatchObject({
        code: 'SALES_BILL_DISC_OVER_USER_MAX',
        field: 'charges',
        max: '7.5',
      });
    });
  });
});
