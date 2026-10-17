import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp, TESTER } from './helpers/identity-app';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './helpers/menu-rights';
import { COMPANY, data, expectStatus, prisma } from './helpers/payment-e2e';

/**
 * Notes 134 — head office reviews (POST /till/reviews/create, GET
 * /till/reviews/list), judged on Cash Position (289).
 *
 * Reads an existing CLOSED session of the e2e company and its day — nothing
 * about them is changed — and reviews them. A review is insert-only, so the
 * teardown deletes exactly the review rows this run made and their HO_REVIEW
 * events (by tsr_id), never by day or branch.
 *
 * tester1 (SUPER ADMIN) is head office, granted 289 for the run; 'tester'
 * holds no 289 row (checked first: the 403 case is skipped if someone gave it one).
 *
 *     npm run test:e2e -- till-review-http --runInBand
 */

jest.setTimeout(120_000);

const CASH_POSITION = 289;
let app: INestApplication;
let rights: MenuRightsMemo | null = null;
const made: string[] = [];

type Target = {
  tssId: string;
  accYear: string;
  branchId: string;
  dayId: string;
  sessionNo: string;
};
let target: Target | null = null;
let otherBranch: string;
let posted: { id: string; accYear: string; refno: string | null } | null = null;
let cancelled: { id: string; accYear: string } | null = null;

type Review = {
  tsrId: string;
  dayId: string | null;
  sessionId: string | null;
  sessionNo: string | null;
  businessDate: string | null;
  outcome: string;
  note: string | null;
  reviewedBy: string;
  reviewedByName: string | null;
  refVoucherNo: string | null;
  current: boolean;
};

const http = () => request(app.getHttpServer());
const create = (body: object, who = 'tester1') =>
  http().post('/api/v1/till/reviews/create').set('Authorization', as(who, '')).send(body);
const list = (query: object) =>
  http().get('/api/v1/till/reviews/list').set('Authorization', as('tester1', '')).query(query);
const code = (res: request.Response): unknown => res.body.errors?.[0]?.code;
const base = () => ({ companyId: COMPANY, branchId: target!.branchId, accYear: target!.accYear });
const created = (res: request.Response) => {
  expectStatus(res, 200);
  const body = data<{ review: Review; supersedes: string | null }>(res);
  made.push(body.review.tsrId);
  return body;
};

beforeAll(async () => {
  app = await bootIdentityApp();
  rights = await grantMenuRights(prisma, [CASH_POSITION]);

  const [s] = await prisma.$queryRaw<Target[]>`
    SELECT tss_id::text AS "tssId", tss_acc_year AS "accYear", tss_branch_id::text AS "branchId",
           tss_day_id::text AS "dayId", tss_session_no AS "sessionNo"
      FROM accounts.till_session
     WHERE tss_company_id = ${COMPANY}::uuid AND tss_status = 'CLOSED'
     ORDER BY tss_opened_on DESC LIMIT 1`;
  target = s ?? null;

  const [b] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT br_id::text AS id FROM public.branch_master
     WHERE br_id <> ${target?.branchId ?? COMPANY}::uuid AND br_is_deleted = false LIMIT 1`;
  otherBranch = b?.id ?? '019c0000-0000-7000-8000-000000000000';

  const vouchers = await prisma.$queryRaw<
    { id: string; accYear: string; status: string; refno: string | null }[]
  >`
    SELECT DISTINCT ON (avh_voucher_status)
           avh_voucher_id::text AS id, avh_acc_year AS "accYear", avh_voucher_status AS status,
           avh_voucher_refno AS refno
      FROM accounts.acc_voucher_header
     WHERE avh_company_id = ${COMPANY}::uuid AND avh_is_deleted = false
       AND avh_voucher_status IN ('POSTED', 'CANCELLED')`;
  posted = vouchers.find((v) => v.status === 'POSTED') ?? null;
  cancelled = vouchers.find((v) => v.status === 'CANCELLED') ?? null;
});

afterAll(async () => {
  if (made.length) {
    await prisma.$executeRaw`DELETE FROM accounts.till_event WHERE tev_src_doc_type = 'TILL_REVIEW' AND tev_src_doc_id = ANY(${made}::uuid[])`;
    await prisma.$executeRaw`DELETE FROM accounts.till_session_review WHERE tsr_id = ANY(${made}::uuid[])`;
  }
  if (rights) {
    await restoreMenuRights(prisma, rights);
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('POST /till/reviews/create — refusals', () => {
  it('needs a closed session of the company to review', () => {
    expect(target).not.toBeNull();
  });

  it('403 TILL_RIGHT_CREATE without Cash Position (289) CREATE', async () => {
    const held = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.user_menus
       WHERE um_user_id = ${TESTER}::uuid AND um_menu_id = ${CASH_POSITION} AND um_is_deleted = false AND um_can_create`;
    if (held[0].n > 0) {
      return; // someone granted 'tester' the menu: nothing to prove here
    }
    const res = await create({ ...base(), sessionId: target!.tssId, outcome: 'OK' }, 'tester');
    expectStatus(res, 403);
    expect(code(res)).toBe('TILL_RIGHT_CREATE');
  });

  it('400 TILL_REVIEW_TARGET for neither or both of dayId / sessionId', async () => {
    const none = await create({ ...base(), outcome: 'OK' });
    expectStatus(none, 400);
    expect(code(none)).toBe('TILL_REVIEW_TARGET');
    const both = await create({
      ...base(),
      dayId: target!.dayId,
      sessionId: target!.tssId,
      outcome: 'OK',
    });
    expectStatus(both, 400);
    expect(code(both)).toBe('TILL_REVIEW_TARGET');
  });

  it('400 VALIDATION_IS_IN for an outcome outside ck_tsr_outcome', async () => {
    const res = await create({ ...base(), sessionId: target!.tssId, outcome: 'FINE' });
    expectStatus(res, 400);
    expect(code(res)).toBe('VALIDATION_IS_IN');
  });

  it('400 TILL_NOTE_REQUIRED for anything but OK without a note', async () => {
    const res = await create({ ...base(), sessionId: target!.tssId, outcome: 'QUERY', note: '  ' });
    expectStatus(res, 400);
    expect(code(res)).toBe('TILL_NOTE_REQUIRED');
  });

  it('400 on a journal named wrongly: half a pair, or on an outcome that raises none', async () => {
    const half = await create({
      ...base(),
      dayId: target!.dayId,
      outcome: 'WRITTEN_OFF',
      note: 'n',
      refVoucherId: target!.tssId,
    });
    expectStatus(half, 400);
    expect(code(half)).toBe('TILL_REVIEW_REF_PAIR');
    const onQuery = await create({
      ...base(),
      dayId: target!.dayId,
      outcome: 'QUERY',
      note: 'n',
      refVoucherId: target!.tssId,
      refVoucherAccYear: target!.accYear,
    });
    expectStatus(onQuery, 400);
    expect(code(onQuery)).toBe('TILL_REVIEW_REF_NOT_ALLOWED');
  });

  it('404 for a day / session that is not this branch’s', async () => {
    const day = await create({
      ...base(),
      branchId: otherBranch,
      dayId: target!.dayId,
      outcome: 'OK',
    });
    expectStatus(day, 404);
    expect(code(day)).toBe('TILL_DAY_NOT_FOUND');
    const session = await create({
      ...base(),
      branchId: otherBranch,
      sessionId: target!.tssId,
      outcome: 'OK',
    });
    expectStatus(session, 404);
    expect(code(session)).toBe('TILL_SESSION_NOT_FOUND');
  });

  it('404 / 409 for a journal that is not a posted voucher of the company', async () => {
    const unknown = await create({
      ...base(),
      dayId: target!.dayId,
      outcome: 'SUSPENSE_CLEARED',
      note: 'n',
      refVoucherId: target!.tssId,
      refVoucherAccYear: target!.accYear,
    });
    expectStatus(unknown, 404);
    expect(code(unknown)).toBe('TILL_REVIEW_REF_NOT_FOUND');
    if (cancelled) {
      const res = await create({
        ...base(),
        dayId: target!.dayId,
        outcome: 'WRITTEN_OFF',
        note: 'n',
        refVoucherId: cancelled.id,
        refVoucherAccYear: cancelled.accYear,
      });
      expectStatus(res, 409);
      expect(code(res)).toBe('TILL_REVIEW_REF_NOT_POSTED');
    }
  });

  it('wrote nothing for any refusal', async () => {
    expect(made).toHaveLength(0);
  });
});

describe('POST /till/reviews/create — reviews', () => {
  it('a session reviewed OK, then QUERY: the second supersedes the first', async () => {
    const first = created(await create({ ...base(), sessionId: target!.tssId, outcome: 'OK' }));
    expect(first.review).toMatchObject({
      sessionId: target!.tssId,
      dayId: null,
      sessionNo: target!.sessionNo,
      outcome: 'OK',
      note: null,
      reviewedByName: 'tester1',
      current: true,
    });
    expect(first.review.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const second = created(
      await create({
        ...base(),
        sessionId: target!.tssId,
        outcome: 'QUERY',
        note: '  short of 40 — explain  ',
      }),
    );
    expect(second.supersedes).toBe(first.review.tsrId);
    expect(second.review).toMatchObject({
      outcome: 'QUERY',
      note: 'short of 40 — explain',
      current: true,
    });

    const res = await list({
      companyId: COMPANY,
      branchId: target!.branchId,
      sessionId: target!.tssId,
    });
    expectStatus(res, 200);
    const mine = data<{ reviews: Review[] }>(res).reviews.filter((r) => made.includes(r.tsrId));
    expect(mine.map((r) => [r.tsrId, r.current])).toEqual([
      [second.review.tsrId, true],
      [first.review.tsrId, false],
    ]);
  });

  it('journals HO_REVIEW with the outcome on the session’s day and counter', async () => {
    const events = await prisma.$queryRaw<
      {
        code: string;
        day: string;
        session: string | null;
        counter: string | null;
        user: string;
        outcome: string;
      }[]
    >`
      SELECT tev_event_code AS code, tev_day_id::text AS day, tev_session_id::text AS session,
             tev_counter_id::text AS counter, tev_user_id::text AS "user", tev_payload->>'outcome' AS outcome
        FROM accounts.till_event
       WHERE tev_src_doc_type = 'TILL_REVIEW' AND tev_src_doc_id = ANY(${made}::uuid[])
       ORDER BY tev_created_on`;
    expect(events.map((e) => e.outcome)).toEqual(['OK', 'QUERY']);
    for (const e of events) {
      expect(e).toMatchObject({ code: 'HO_REVIEW', day: target!.dayId, session: target!.tssId });
      expect(e.counter).not.toBeNull();
    }
  });

  it('a day written off against a posted journal', async () => {
    if (!posted) {
      return; // no posted voucher in the company to cite
    }
    const body = created(
      await create({
        ...base(),
        dayId: target!.dayId,
        outcome: 'WRITTEN_OFF',
        note: 'written off by HO',
        refVoucherId: posted.id,
        refVoucherAccYear: posted.accYear,
      }),
    );
    expect(body.review).toMatchObject({
      dayId: target!.dayId,
      sessionId: null,
      sessionNo: null,
      outcome: 'WRITTEN_OFF',
      refVoucherNo: posted.refno,
      current: true,
    });

    const res = await list({
      companyId: COMPANY,
      branchId: target!.branchId,
      dayId: target!.dayId,
    });
    expectStatus(res, 200);
    const reviews = data<{ reviews: Review[] }>(res).reviews;
    expect(reviews.every((r) => r.dayId === target!.dayId && r.sessionId === null)).toBe(true);
    expect(reviews.find((r) => r.tsrId === body.review.tsrId)?.current).toBe(true);
  });
});
