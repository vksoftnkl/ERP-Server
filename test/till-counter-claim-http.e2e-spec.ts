import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { as, bootIdentityApp, IDENTITIES, PRATHAP, TESTER } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import {
  BRANCH,
  COMPANY,
  WALK_IN,
  WALK_IN_NAME,
  billBody,
  billKeys,
  grantSalesRights,
  makeItem,
  postOpeningStock,
  revokeSalesRights,
  runTag,
  type Item,
  type RightsMemo,
} from './sales/sales-e2e.harness';

/**
 * plan-till-counter-claim.md — how a session gets its counter, over HTTP against the dev database.
 *
 *   rule 1  an unknown device opens nothing (TILL_DEVICE_UNKNOWN); a blocked one neither (TILL_DEVICE_BLOCKED)
 *   rule 2  a back-office device (till.require_session = false) is told no session is needed
 *   rule 3  a LINKED PC opens on its counter, and only there
 *   rule 4  an UNLINKED tablet picks from the free list (§2.1); nothing is written to the counter
 *   §2.3    two tablets on one free counter: the second hears TILL_COUNTER_BUSY
 *   §3.1    money posts only from the session's device; a picked counter's bill lands in its session
 *   §3.2    one drawer per device and per cashier
 *
 * One app; the stubbed token service reads `<user>@<device>` from the bearer, so a request picks
 * who it is and where from. The suite owns its devices and counters (codes E2EK…) and removes
 * them, the sessions and the bill afterwards. COUNTER_RELINK (§3.3 / §3.4) waits for phase 3's
 * approval gate and is not tested here.
 *
 *     npm run test:e2e -- till-counter-claim-http --runInBand
 */

jest.setTimeout(240_000);

const SUPERVISOR = TESTER;
const CASHIER2 = PRATHAP;
const OTHER_BRANCH = '019efa00-c227-7672-a55b-161842adf59c'; // Head Office
const UNKNOWN_DEVICE = '01a00000-0000-7000-8000-0000000000aa';
const TILL_MENUS = [271, 272, 273, 274, 275, 276];
const USERS = IDENTITIES;

const tag = runTag().slice(-6);
const prisma = new PrismaClient();
let app: INestApplication;
const rights: MenuRightsMemo[] = [];
let salesRights: RightsMemo;
let item: Item;
let sbId: string | null = null;
let dayCreated = false;

const dev: Record<'linkedPc' | 'linkedElse' | 'tabA' | 'tabB' | 'tabC' | 'office', string> = {
  linkedPc: '',
  linkedElse: '',
  tabA: '',
  tabB: '',
  tabC: '',
  office: '',
};
const ctr: Record<
  'linked' | 'linkedElse' | 'free1' | 'free2' | 'inactive' | 'noSession' | 'otherBranch',
  string
> = {
  linked: '',
  linkedElse: '',
  free1: '',
  free2: '',
  inactive: '',
  noSession: '',
  otherBranch: '',
};
const SHORT: Record<keyof typeof ctr, string> = {
  linked: 'L',
  linkedElse: 'LX',
  free1: 'F1',
  free2: 'F2',
  inactive: 'IN',
  noSession: 'NS',
  otherBranch: 'OB',
};
const code = (k: keyof typeof ctr) => `E2EK${tag}${SHORT[k]}`;
const sessions: string[] = [];

type Who = keyof typeof USERS;
const check = (who: Who, device: string, query: object = {}) =>
  request(app.getHttpServer())
    .get('/api/v1/till/sessions/open-check')
    .set('Authorization', as(who, device))
    .query({ companyId: COMPANY, branchId: BRANCH, ...query });
async function open(who: Who, device: string, body: object = {}) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/till/sessions/open')
    .set('Authorization', as(who, device))
    .send({ companyId: COMPANY, branchId: BRANCH, floatMode: 'NONE', lines: [], ...body });
  if (res.status === 201) {
    sessions.push(res.body.data.tssId);
  }
  return res;
}
const postAs = (who: Who, device: string, path: string, body: object) =>
  request(app.getHttpServer())
    .post(`/api/v1/${path}`)
    .set('Authorization', as(who, device))
    .send(body);

function expectStatus(res: request.Response, status: number): void {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}
const codeOf = (res: request.Response) => res.body.errors?.[0]?.code as string | undefined;
/** Only this suite's counters: the dev branch may hold others. */
const ours = <T extends { code: string }>(rows: T[]) =>
  rows.filter((r) => r.code.startsWith(`E2EK${tag}`));

async function addDevice(name: string, type: string): Promise<string> {
  const [row] = await prisma.$queryRaw<{ dev_id: string }[]>`
    INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_device_type)
    VALUES (${COMPANY}::uuid, ${BRANCH}::uuid, ${`e2e-claim-${tag}-${name}`}, ${`E2E ${name}`}, ${type})
    RETURNING dev_id::text`;
  return row.dev_id;
}

async function addCounter(
  key: keyof typeof ctr,
  opts: {
    device?: string;
    active?: boolean;
    requiresSession?: boolean;
    sort?: number;
    branch?: string;
  } = {},
): Promise<string> {
  const [row] = await prisma.$queryRaw<{ tcn_id: string }[]>`
    INSERT INTO accounts.till_counter
      (tcn_company_id, tcn_branch_id, tcn_code, tcn_name, tcn_device_id, tcn_is_active, tcn_requires_session,
       tcn_sort_order, tcn_default_float, tcn_created_by)
    VALUES (${COMPANY}::uuid, ${opts.branch ?? BRANCH}::uuid, ${code(key)}, ${`E2E ${key}`},
            ${opts.device ?? null}::uuid, ${opts.active ?? true}, ${opts.requiresSession ?? true},
            ${opts.sort ?? 0}, 1500, 'e2e-till-claim')
    RETURNING tcn_id::text`;
  return row.tcn_id;
}

beforeAll(async () => {
  dev.linkedPc = await addDevice('linked-pc', 'Desktop');
  dev.linkedElse = await addDevice('linked-else', 'Desktop');
  dev.tabA = await addDevice('tab-a', 'Mobile');
  dev.tabB = await addDevice('tab-b', 'Mobile');
  dev.tabC = await addDevice('tab-c', 'Mobile');
  dev.office = await addDevice('office', 'Desktop');

  ctr.linked = await addCounter('linked', { device: dev.linkedPc });
  ctr.linkedElse = await addCounter('linkedElse', { device: dev.linkedElse });
  ctr.free1 = await addCounter('free1', { sort: 2 });
  ctr.free2 = await addCounter('free2', { sort: 1 });
  ctr.inactive = await addCounter('inactive', { active: false });
  ctr.noSession = await addCounter('noSession', { requiresSession: false });
  ctr.otherBranch = await addCounter('otherBranch', { branch: OTHER_BRANCH });

  await prisma.$executeRaw`
    INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_device_id, asv_value, asv_created_by)
    VALUES ('till.require_session', 'DEVICE', ${dev.office}::uuid, 'false', 'e2e-till-claim')`;

  const [day] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM accounts.till_business_day
     WHERE tbd_company_id = ${COMPANY}::uuid AND tbd_branch_id = ${BRANCH}::uuid AND tbd_is_deleted = false`;
  dayCreated = day.n === 0;

  for (const user of [TESTER1, CASHIER2, SUPERVISOR]) {
    rights.push(await grantMenuRights(prisma, TILL_MENUS, user));
  }
  salesRights = await grantSalesRights(prisma);
  app = await bootIdentityApp();
  item = await makeItem(prisma, `E2E-CLAIM-${tag}`);
  await postOpeningStock(
    { app, http: request(app.getHttpServer()), prisma },
    item,
    10,
    20,
    `E2E-CLAIM-${tag} opening`,
  );
});

afterAll(async () => {
  const days = sessions.length
    ? await prisma.$queryRaw<{ d: string }[]>`
        SELECT DISTINCT tss_day_id::text AS d FROM accounts.till_session WHERE tss_id = ANY(${sessions}::uuid[])`
    : [];
  if (sessions.length) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_session_id = ANY(${sessions}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_variance WHERE tvr_session_id = ANY(${sessions}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_count WHERE tct_session_id = ANY(${sessions}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_session WHERE tss_id = ANY(${sessions}::uuid[])`;
  }
  const devices = Object.values(dev).filter(Boolean);
  await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_device_id = ANY(${devices}::uuid[])`;
  if (dayCreated) {
    for (const { d } of days) {
      await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_day_id = ${d}::uuid`;
      await prisma.$executeRaw`
        DELETE FROM accounts.till_business_day x WHERE x.tbd_id = ${d}::uuid
           AND NOT EXISTS (SELECT 1 FROM accounts.till_session s WHERE s.tss_day_id = x.tbd_id)`;
    }
  }
  // The session row is gone, so the D7 guard no longer applies: cancel as the sales suites do.
  if (sbId) {
    await postAs('tester1', dev.tabA, 'bills/cancel', {
      ...billKeys(sbId),
      reason: 'e2e till claim teardown',
    });
  }
  await prisma.$executeRaw`DELETE FROM accounts.till_counter WHERE tcn_code LIKE ${`E2EK${tag}%`}`;
  await prisma.$executeRaw`DELETE FROM public.app_setting_value WHERE asv_created_by = 'e2e-till-claim'`;
  await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id = ANY(${devices}::uuid[])`;
  if (salesRights) {
    await revokeSalesRights(prisma, salesRights);
  }
  for (const memo of rights.reverse()) {
    await restoreMenuRights(prisma, memo);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('Rule 1 · the device must be known and usable', () => {
  it('an unknown device is TILL_DEVICE_UNKNOWN, on open-check and on open', async () => {
    const res = await check('tester1', UNKNOWN_DEVICE);
    expectStatus(res, 409);
    expect(codeOf(res)).toBe('TILL_DEVICE_UNKNOWN');
    const opened = await open('tester1', UNKNOWN_DEVICE, { counterId: ctr.free1 });
    expectStatus(opened, 409);
    expect(codeOf(opened)).toBe('TILL_DEVICE_UNKNOWN');
  });

  it('a blocked device is TILL_DEVICE_BLOCKED', async () => {
    await prisma.$executeRaw`UPDATE fixed.device_master SET dev_is_blocked = true WHERE dev_id = ${dev.tabC}::uuid`;
    try {
      const res = await check('tester1', dev.tabC);
      expectStatus(res, 403);
      expect(codeOf(res)).toBe('TILL_DEVICE_BLOCKED');
    } finally {
      await prisma.$executeRaw`UPDATE fixed.device_master SET dev_is_blocked = false WHERE dev_id = ${dev.tabC}::uuid`;
    }
  });

  it('open-check refuses a deviceId or userId that is not the login’s', async () => {
    expectStatus(await check('tester1', dev.tabA, { deviceId: dev.tabB }), 400);
    expectStatus(await check('tester1', dev.tabA, { userId: CASHIER2 }), 400);
    expectStatus(await check('tester1', dev.tabA, { deviceId: dev.tabA, userId: TESTER1 }), 200);
  });
});

describe('Rule 2 · a back-office device', () => {
  it('needs no session: no counter is offered (test 9)', async () => {
    const res = await check('tester1', dev.office);
    expectStatus(res, 200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        requireSession: false,
        linkedCounter: null,
        freeCounters: [],
        busyCounters: [],
      }),
    );
  });
});

describe('Rules 3 and 4 · the counter line of S1', () => {
  it('a linked PC sees its counter and no free list', async () => {
    const res = await check('tester', dev.linkedPc);
    expectStatus(res, 200);
    expect(res.body.data.requireSession).toBe(true);
    expect(res.body.data.linkedCounter).toEqual(
      expect.objectContaining({
        counterId: ctr.linked,
        code: code('linked'),
        defaultFloat: 1500,
        liveSessionId: null,
        inactive: false,
        carriedFrom: null,
      }),
    );
    expect(res.body.data.freeCounters).toEqual([]);
    expect(res.body.data.businessDay).toEqual(expect.objectContaining({ autoOpen: true }));
  });

  it('an unlinked tablet sees the free list, ordered, without linked / inactive / no-session / other-branch counters (test 10)', async () => {
    const res = await check('tester1', dev.tabA);
    expectStatus(res, 200);
    expect(res.body.data.linkedCounter).toBeNull();
    expect(ours(res.body.data.freeCounters).map((c: { code: string }) => c.code)).toEqual([
      code('free2'),
      code('free1'),
    ]);
    expect(res.body.data.freeCounters[0]).toEqual(
      expect.objectContaining({ defaultFloat: 1500, carriedFrom: null }),
    );
  });
});

describe('Opening', () => {
  let linkedSession: string;
  let tabASession: { tssId: string; tssSessionNo: string };

  it('a linked PC opens only on its counter: claim LINKED (test 1)', async () => {
    const elsewhere = await open('tester', dev.linkedPc, { counterId: ctr.free1 });
    expectStatus(elsewhere, 409);
    expect(codeOf(elsewhere)).toBe('TILL_COUNTER_NOT_YOURS');

    const res = await open('tester', dev.linkedPc);
    expectStatus(res, 201);
    expect(res.body.data.tssCounterId).toBe(ctr.linked);
    linkedSession = res.body.data.tssId;
    const event = await prisma.tillEvent.findFirstOrThrow({
      where: { tevSessionId: linkedSession, tevEventCode: 'SESSION_OPEN' },
    });
    expect(event.tevPayload).toEqual(expect.objectContaining({ claim: 'LINKED' }));
    expect(event.tevDeviceId).toBe(dev.linkedPc);
    const check2 = await check('tester', dev.linkedPc);
    expect(check2.body.data.linkedCounter.liveSessionId).toBe(linkedSession);
    expect(check2.body.data.deviceSession).toEqual(
      expect.objectContaining({ sessionId: linkedSession }),
    );
  });

  it('an unlinked tablet must name a free counter; a linked, inactive or no-session one is TILL_COUNTER_NOT_YOURS (test 3)', async () => {
    expectStatus(await open('tester1', dev.tabA), 400);
    for (const counterId of [ctr.linkedElse, ctr.linked, ctr.inactive, ctr.noSession]) {
      const res = await open('tester1', dev.tabA, { counterId });
      expectStatus(res, 409);
      expect(codeOf(res)).toBe('TILL_COUNTER_NOT_YOURS');
    }
    const foreign = await open('tester1', dev.tabA, { counterId: ctr.otherBranch });
    expectStatus(foreign, 404);
  });

  it('it opens on the counter it picked: claim PICKED, stamped with the tablet, the counter untouched (test 2)', async () => {
    const res = await open('tester1', dev.tabA, { counterId: ctr.free1 });
    expectStatus(res, 201);
    tabASession = res.body.data;
    expect(res.body.data.tssCounterId).toBe(ctr.free1);
    const row = await prisma.tillSession.findFirstOrThrow({ where: { tssId: tabASession.tssId } });
    expect(row.tssDeviceId).toBe(dev.tabA);
    const counter = await prisma.tillCounter.findUniqueOrThrow({ where: { tcnId: ctr.free1 } });
    expect(counter.tcnDeviceId).toBeNull();
    const event = await prisma.tillEvent.findFirstOrThrow({
      where: { tevSessionId: tabASession.tssId, tevEventCode: 'SESSION_OPEN' },
    });
    expect(event.tevPayload).toEqual(expect.objectContaining({ claim: 'PICKED' }));
    expect(
      await prisma.tillEvent.count({
        where: { tevEventCode: 'COUNTER_RELINK', tevDeviceId: dev.tabA },
      }),
    ).toBe(0);
  });

  it('a second tablet on the same counter hears TILL_COUNTER_BUSY, and sees who holds it (test 4)', async () => {
    const res = await open('prathap', dev.tabB, { counterId: ctr.free1 });
    expectStatus(res, 409);
    expect(codeOf(res)).toBe('TILL_COUNTER_BUSY');

    const board = await check('prathap', dev.tabB);
    expect(ours(board.body.data.freeCounters).map((c: { code: string }) => c.code)).toEqual([
      code('free2'),
    ]);
    expect(ours(board.body.data.busyCounters)).toEqual([
      expect.objectContaining({
        counterId: ctr.free1,
        session: expect.objectContaining({
          sessionId: tabASession.tssId,
          operatorId: TESTER1,
          deviceId: dev.tabA,
          deviceName: 'E2E tab-a',
          status: 'OPEN',
        }),
      }),
    ]);
  });

  it('the same cashier on another device is TILL_OPERATOR_BUSY, and open-check says where (test 6)', async () => {
    const board = await check('tester1', dev.tabB);
    expect(board.body.data.userSessionElsewhere).toEqual(
      expect.objectContaining({ sessionId: tabASession.tssId, deviceName: 'E2E tab-a' }),
    );
    const res = await open('tester1', dev.tabB, { counterId: ctr.free2 });
    expectStatus(res, 409);
    expect(codeOf(res)).toBe('TILL_OPERATOR_BUSY');
  });

  it('another cashier on a device holding a session opens nothing there (test 7)', async () => {
    const board = await check('prathap', dev.tabA);
    expect(board.body.data.deviceSession).toEqual(
      expect.objectContaining({ sessionId: tabASession.tssId, operatorId: TESTER1 }),
    );
    const res = await open('prathap', dev.tabA, { counterId: ctr.free2 });
    expectStatus(res, 409);
    expect(codeOf(res)).toBe('TILL_COUNTER_BUSY');
    expect(res.body.errors[0].sessionNo).toBe(tabASession.tssSessionNo);
  });

  it('with every counter taken, an unlinked device is TILL_NO_FREE_COUNTER', async () => {
    expectStatus(await open('prathap', dev.tabB, { counterId: ctr.free2 }), 201);
    const board = await check('tester1', dev.tabC);
    expect(ours(board.body.data.freeCounters)).toEqual([]);
    expect(ours(board.body.data.busyCounters).map((b: { code: string }) => b.code)).toEqual([
      code('free2'),
      code('free1'),
    ]);
    // Only this suite's counters may be free for the refusal to be ours to assert.
    if (board.body.data.freeCounters.length === 0) {
      const res = await open('tester1', dev.tabC);
      expectStatus(res, 409);
      expect(codeOf(res)).toBe('TILL_NO_FREE_COUNTER');
    }
  });

  it('a linked counter switched off is TILL_COUNTER_INACTIVE', async () => {
    await prisma.$executeRaw`UPDATE accounts.till_counter SET tcn_is_active = false WHERE tcn_id = ${ctr.linked}::uuid`;
    try {
      const board = await check('tester', dev.linkedPc);
      expect(board.body.data.linkedCounter.inactive).toBe(true);
      const res = await open('tester', dev.linkedPc);
      expectStatus(res, 409);
      expect(codeOf(res)).toBe('TILL_COUNTER_INACTIVE');
    } finally {
      await prisma.$executeRaw`UPDATE accounts.till_counter SET tcn_is_active = true WHERE tcn_id = ${ctr.linked}::uuid`;
    }
  });

  describe('§3.1 · money follows the session’s device', () => {
    it('a cash bill from device B naming A’s session is TILL_SESSION_WRONG_DEVICE (test 5)', async () => {
      const created = await postAs(
        'tester1',
        dev.tabB,
        'bills/create',
        billBody({
          custId: WALK_IN,
          custName: WALK_IN_NAME,
          lines: [{ item, qty: 1, rate: 100 }],
          usrRefno: `E2E-CLAIM-${tag}`,
          extra: { sbSessionId: tabASession.tssId },
        }),
      );
      expectStatus(created, 201);
      sbId = created.body.data.sbId;
      const res = await postAs('tester1', dev.tabB, 'bills/post', billKeys(sbId!));
      expectStatus(res, 409);
      expect(codeOf(res)).toBe('TILL_SESSION_WRONG_DEVICE');
    });

    it('the same bill from the tablet that picked the counter posts in its session', async () => {
      const res = await postAs('tester1', dev.tabA, 'bills/post', billKeys(sbId!));
      expectStatus(res, 201);
      const [bill] = await prisma.$queryRaw<{ s: string; c: string }[]>`
        SELECT sb_session_id::text AS s, sb_counter_id::text AS c FROM sales.sale_bill WHERE sb_id = ${sbId}::uuid`;
      expect(bill).toEqual({ s: tabASession.tssId, c: ctr.free1 });
    });
  });
});
