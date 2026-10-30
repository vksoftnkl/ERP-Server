import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp } from './helpers/identity-app';
import { BRANCH, COMPANY, prisma } from './helpers/payment-e2e';

/**
 * Notes 125 — User Role takes the till levels' names, and SUPER ADMIN is VK
 * Softwares' own account (§3, the security hole):
 *
 *   §1/§2  STORE MANAGER · AREA MANAGER · HO FINANCE · CASH OFFICE save;
 *          MANAGER no longer does (400)
 *   §3     a non-super-admin (prathap, USER) cannot create a SUPER ADMIN, raise
 *          a user to it, or edit / reset / deactivate / delete one — 403
 *          USER_ROLE_RESERVED; a SUPER ADMIN (tester1) can. /user-administration
 *          and /users want a login token; /users wants a SUPER ADMIN.
 *
 * Users the suite makes are named zt-role125-<tag>-… and hard-deleted after.
 *
 *     npm run test:e2e -- user-role-reserved-notes-125 --runInBand
 */

jest.setTimeout(120_000);

const tag = Date.now().toString(36).slice(-6);
const BASE = '/api/v1/user-administration';
let app: INestApplication;
const made: string[] = [];

const http = () => request(app.getHttpServer());
const save = (who: string, body: Record<string, unknown>) =>
  http()
    .post(`${BASE}/create`)
    .set('Authorization', as(who, ''))
    .send({ usrCompanyId: COMPANY, usrBranchId: BRANCH, ...body });
const firstError = (res: request.Response): Record<string, unknown> => res.body.errors?.[0] ?? {};

async function create(who: string, name: string, usrType: string): Promise<request.Response> {
  const res = await save(who, {
    usrLoginName: `zt-role125-${tag}-${name}`,
    usrDisplayName: `ZT role ${name}`,
    usrPassword: 'Str0ng!Passw0rd',
    usrType,
  });
  if (res.status === 201) {
    made.push(res.body.data.usrId as string);
  }
  return res;
}

beforeAll(async () => {
  app = await bootIdentityApp();
});

afterAll(async () => {
  if (made.length > 0) {
    await prisma.$executeRaw`DELETE FROM public.user_menus WHERE um_user_id = ANY(${made}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM public.user_master WHERE usr_id = ANY(${made}::uuid[])`;
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('§1 / §2 · the role names', () => {
  it.each(['STORE MANAGER', 'AREA MANAGER', 'HO FINANCE', 'CASH OFFICE'])(
    '%s saves and reads back',
    async (role) => {
      const res = await create('prathap', role.replace(' ', '-').toLowerCase(), role);
      expect(res.status).toBe(201);
      expect(res.body.data.usrType).toBe(role);
    },
  );

  it('MANAGER is no longer a role (400)', async () => {
    const res = await create('prathap', 'manager', 'MANAGER');
    expect(res.status).toBe(400);
    expect(firstError(res).field).toBe('usrType');
  });

  it('no user is left holding MANAGER', async () => {
    const [row] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.user_master WHERE usr_type = 'MANAGER'`;
    expect(row.n).toBe(0);
  });
});

describe('§3 · SUPER ADMIN is reserved', () => {
  let superId: string;
  let plainId: string;

  it('a non-super-admin cannot create one (403 USER_ROLE_RESERVED on usrType)', async () => {
    const res = await create('prathap', 'sa-by-user', 'SUPER ADMIN');
    expect(res.status).toBe(403);
    expect(firstError(res)).toEqual(
      expect.objectContaining({ code: 'USER_ROLE_RESERVED', field: 'usrType' }),
    );
  });

  it('a SUPER ADMIN can', async () => {
    const res = await create('tester1', 'sa', 'SUPER ADMIN');
    expect(res.status).toBe(201);
    superId = res.body.data.usrId;
  });

  it('a non-super-admin cannot raise a user to it', async () => {
    const plain = await create('prathap', 'plain', 'CASHIER');
    expect(plain.status).toBe(201);
    plainId = plain.body.data.usrId;
    const res = await save('prathap', {
      usrId: plainId,
      usrLoginName: `zt-role125-${tag}-plain`,
      usrType: 'SUPER ADMIN',
    });
    expect(res.status).toBe(403);
    expect(firstError(res).code).toBe('USER_ROLE_RESERVED');
    // …while an ordinary edit of an ordinary user goes through.
    const ok = await save('prathap', {
      usrId: plainId,
      usrLoginName: `zt-role125-${tag}-plain`,
      usrType: 'SUPERVISOR',
    });
    expect(ok.status).toBe(201);
  });

  it('a non-super-admin cannot edit, reset, deactivate or delete a SUPER ADMIN user', async () => {
    const login = `zt-role125-${tag}-sa`;
    for (const change of [
      { usrDisplayName: 'taken over' },
      { usrPassword: 'N3w!Passw0rd' },
      { usrIsActive: false },
      { usrType: 'USER' },
    ]) {
      const res = await save('prathap', { usrId: superId, usrLoginName: login, ...change });
      expect(res.status).toBe(403);
      expect(firstError(res)).toEqual(
        expect.objectContaining({ code: 'USER_ROLE_RESERVED', field: 'usrId' }),
      );
    }
    const del = await http()
      .delete(`${BASE}/delete`)
      .query({ usrId: superId })
      .set('Authorization', as('prathap', ''));
    expect(del.status).toBe(403);
    expect(firstError(del).code).toBe('USER_ROLE_RESERVED');
    const [row] = await prisma.$queryRaw<{ active: boolean; deleted: boolean }[]>`
      SELECT usr_is_active AS active, usr_is_deleted AS deleted FROM public.user_master
       WHERE usr_id = ${superId}::uuid`;
    expect(row).toEqual({ active: true, deleted: false });
  });

  it('a SUPER ADMIN can change and delete one', async () => {
    const res = await save('tester1', {
      usrId: superId,
      usrLoginName: `zt-role125-${tag}-sa`,
      usrIsActive: false,
    });
    expect(res.status).toBe(201);
    const del = await http()
      .delete(`${BASE}/delete`)
      .query({ usrId: superId })
      .set('Authorization', as('tester1', ''));
    expect(del.status).toBe(200);
  });

  it('no login token: /user-administration and /users answer 401', async () => {
    expect((await http().get(`${BASE}/get`).query({ usrId: plainId })).status).toBe(401);
    expect((await http().get('/api/v1/users')).status).toBe(401);
    expect(
      (await http().patch(`/api/v1/users/${superId}`).send({ user_password: 'x' })).status,
    ).toBe(401);
  });

  it('/users is for a SUPER ADMIN only', async () => {
    const user = await http().get('/api/v1/users').set('Authorization', as('prathap', ''));
    expect(user.status).toBe(403);
    expect(firstError(user).code).toBe('USER_ROLE_RESERVED');
    const reset = await http()
      .patch(`/api/v1/users/${plainId}`)
      .set('Authorization', as('prathap', ''))
      .send({ user_password: 'x' });
    expect(reset.status).toBe(403);
    const ok = await http().get('/api/v1/users').set('Authorization', as('tester1', ''));
    expect(ok.status).toBe(200);
  });
});
