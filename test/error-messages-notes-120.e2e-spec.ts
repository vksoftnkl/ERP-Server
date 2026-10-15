import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp } from './helpers/identity-app';
import {
  grantMenuRights,
  restoreMenuRights,
  TESTER1,
  type MenuRightsMemo,
} from './helpers/menu-rights';
import { BRANCH, COMPANY, prisma } from './helpers/payment-e2e';

/**
 * Notes 120 — the plain error wording lives on the server: GET /error-messages,
 * and a `user` block on every coded error, through a module filter (till,
 * held bills), the variant rows (the Cockpit's field=tssId) and the global
 * filter. Read-only: every till call here is refused before it writes.
 *
 *     npm run test:e2e -- error-messages-notes-120 --runInBand
 */

jest.setTimeout(120_000);

let app: INestApplication;
let device: string;
let rights: MenuRightsMemo | null = null;
const http = () => request(app.getHttpServer());
const NO_SUCH = '00000000-0000-4000-8000-000000000000';
type Err = {
  field: string;
  code: string;
  message: string;
  status?: string;
  user?: { title: string; line: string; todo: string };
};
const APP = {
  title: 'Something went wrong',
  line: 'The app sent a wrong request.',
  todo: 'Send a photo of this to support.',
};

beforeAll(async () => {
  const [row] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT dev_id::text AS id FROM fixed.device_master
     WHERE dev_company_id = ${COMPANY}::uuid AND dev_branch_id = ${BRANCH}::uuid
       AND dev_is_deleted = false
     ORDER BY dev_created_on LIMIT 1`;
  device = row.id;
  rights = await grantMenuRights(prisma, [273], TESTER1);
  app = await bootIdentityApp();
});

afterAll(async () => {
  await restoreMenuRights(prisma, rights);
  await app?.close();
  await prisma.$disconnect();
});

describe('notes 120 · GET /error-messages', () => {
  it('serves the catalogue and its version; `since` the same version answers unchanged', async () => {
    const [catalogue] = await prisma.$queryRaw<{ v: string; n: number }[]>`
      SELECT emc_version AS v,
             (SELECT count(*)::int FROM fixed.error_message WHERE erm_is_active AND erm_lang = 'en') AS n
        FROM fixed.error_message_catalogue`;
    const res = await http()
      .get('/api/v1/error-messages')
      .set('Authorization', as('tester1', device));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ version: catalogue.v, lang: 'en', unchanged: false }),
    );
    expect(res.body.data.rows).toHaveLength(catalogue.n);
    expect(res.body.data.rows).toContainEqual({
      code: 'TILL_SESSION_NOT_OPEN',
      variant: 'status=PENDING_APPROVAL',
      lang: 'en',
      title: 'Cannot take payment',
      line: 'Your till is waiting for supervisor OK.',
      todo: 'Call supervisor.',
    });

    const same = await http()
      .get('/api/v1/error-messages')
      .set('Authorization', as('tester1', device))
      .query({ since: catalogue.v });
    expect(same.body.data).toEqual({ version: catalogue.v, lang: 'en', unchanged: true, rows: [] });

    const tamil = await http()
      .get('/api/v1/error-messages')
      .set('Authorization', as('tester1', device))
      .set('Accept-Language', 'ta-IN');
    expect(tamil.body.data.lang).toBe('en');
  });
});

describe('notes 120 · the `user` block on errors', () => {
  it('a module filter words each coded error; a prefix row words the app’s mistakes', async () => {
    const res = await http()
      .post('/api/v1/till/safes/count')
      .set('Authorization', as('tester1', device))
      .send({ companyId: 'nope', branchId: BRANCH, safeId: NO_SUCH, lines: [{ tenderTypeId: 0 }] });
    expect(res.status).toBe(400);
    const byField = Object.fromEntries((res.body.errors as Err[]).map((e) => [e.field, e]));
    expect(byField.companyId.user).toEqual(APP);
    expect(byField['lines.0.tenderTypeId'].user).toEqual({
      title: 'Wrong amount',
      line: 'An amount is too small.',
      todo: 'Check the amounts.',
    });
  });

  it('a held bill not found: its own row', async () => {
    const res = await http()
      .get('/api/v1/txn-holds/get')
      .set('Authorization', as('tester1', device))
      .query({ txhId: NO_SUCH });
    expect(res.status).toBe(404);
    expect((res.body.errors as Err[])[0].user).toEqual({
      title: 'Not found',
      line: 'This held bill is not there now.',
      todo: 'Refresh the held bills list.',
    });
  });

  it('a variant: TILL_SESSION_NOT_OPEN on tssId (the Cockpit) words it for a supervisor', async () => {
    const [closed] = await prisma.$queryRaw<{ id: string; y: string }[]>`
      SELECT tss_id::text AS id, tss_acc_year AS y FROM accounts.till_session
       WHERE tss_company_id = ${COMPANY}::uuid AND tss_branch_id = ${BRANCH}::uuid
         AND tss_status = 'CLOSED' AND tss_is_deleted = false
       ORDER BY tss_closed_on DESC LIMIT 1`;
    if (!closed) {
      return; // no closed session on this database: nothing to read
    }
    const res = await http()
      .post('/api/v1/till/sessions/x-report')
      .set('Authorization', as('tester1', device))
      .send({ companyId: COMPANY, branchId: BRANCH, accYear: closed.y, tssId: closed.id });
    expect(res.status).toBe(409);
    expect((res.body.errors as Err[])[0]).toEqual(
      expect.objectContaining({
        code: 'TILL_SESSION_NOT_OPEN',
        field: 'tssId',
        status: 'CLOSED',
        user: { title: 'Not now', line: 'This till is not in the right state.', todo: 'Refresh.' },
      }),
    );
  });

  it('the global filter words a controller with no filter of its own', async () => {
    const res = await http()
      .get('/api/v1/hsn-code-masters/get')
      .set('Authorization', as('tester1', device))
      .query({ zzz: '1' });
    expect(res.status).toBe(400);
    expect((res.body.errors as Err[])[0]).toEqual(
      expect.objectContaining({ code: 'VALIDATION_WHITELIST', user: APP }),
    );
  });

  it('a prefix row words a code inside it (TENDER_LINE_* is the app’s mistake)', async () => {
    const res = await http()
      .get('/api/v1/tender-details/get')
      .set('Authorization', as('tester1', device))
      .query({ tdId: NO_SUCH });
    expect(res.status).toBe(404);
    const [err] = res.body.errors as Err[];
    expect(err.code).toBe('TENDER_LINE_NOT_FOUND');
    expect(err.user).toEqual(APP);
  });

  it('a code with no row gets no `user` block — never the developer sentence', async () => {
    const res = await http()
      .get('/api/v1/sale-returns/get')
      .set('Authorization', as('tester1', device))
      .query({
        srId: '01a13ddd-0000-7000-8000-000000000000',
        srCompanyId: COMPANY,
        srBranchId: BRANCH,
        srAccYear: '2026-2027',
      });
    expect(res.status).toBe(404);
    const [err] = res.body.errors as Err[];
    expect(err.code).toBe('SALES_NOT_FOUND');
    expect(err).not.toHaveProperty('user');
  });
});
