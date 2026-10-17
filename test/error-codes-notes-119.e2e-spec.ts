import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { as, bootIdentityApp } from './helpers/identity-app';
import { BRANCH, COMPANY, prisma } from './helpers/payment-e2e';

/**
 * Notes 119 — an error `code` on every refusal the counter meets (parts 1 and
 * 4). Read-only: every request here is refused, nothing is written.
 *
 *   §4  a DTO failure answers in the house shape, one coded error per field —
 *       through a module filter (till) and through the global filter (a
 *       controller with none); a framework param pipe's 400 is coded too
 *   §1  held bills (HOLD_*) and tender lines (TENDER_LINE_*) name their code
 *
 *     npm run test:e2e -- error-codes-notes-119 --runInBand
 */

jest.setTimeout(120_000);

let app: INestApplication;
let device: string;
const http = () => request(app.getHttpServer());
const NO_SUCH = '00000000-0000-4000-8000-000000000000';
type Body = {
  success: boolean;
  message: string;
  errors: { field: string; code: string; message: string }[];
};

beforeAll(async () => {
  const [row] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT dev_id::text AS id FROM fixed.device_master
     WHERE dev_company_id = ${COMPANY}::uuid AND dev_branch_id = ${BRANCH}::uuid
       AND dev_is_deleted = false
     ORDER BY dev_created_on LIMIT 1`;
  device = row.id;
  app = await bootIdentityApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('notes 119 · §4 validation', () => {
  it('a module filter passes the house shape through: a coded error per field', async () => {
    const res = await http()
      .post('/api/v1/till/safes/count')
      .set('Authorization', as('tester1', device))
      .send({
        companyId: 'nope',
        branchId: BRANCH,
        safeId: NO_SUCH,
        lines: [{ tenderTypeId: 0 }],
        extra: 1,
      });
    expect(res.status).toBe(400);
    const body = res.body as Body;
    expect(body).toEqual(expect.objectContaining({ success: false, message: 'Validation failed' }));
    const byField = Object.fromEntries(body.errors.map((e) => [e.field, e]));
    expect(byField.companyId.code).toBe('VALIDATION_IS_UUID');
    expect(byField.extra).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_WHITELIST',
        message: 'property extra should not exist',
      }),
    );
    expect(byField['lines.0.tenderTypeId'].code).toBe('VALIDATION_MIN');
  });

  it('a controller with no filter of its own answers the same shape at the top level', async () => {
    const res = await http()
      .get('/api/v1/hsn-code-masters/get')
      .set('Authorization', as('tester1', device))
      .query({ zzz: '1' });
    expect(res.status).toBe(400);
    expect((res.body as Body).errors).toEqual([
      expect.objectContaining({ field: 'zzz', code: 'VALIDATION_WHITELIST' }),
    ]);
  });

  it('a framework param pipe’s 400 is coded', async () => {
    const res = await http()
      .get('/api/v1/txn-holds/get')
      .set('Authorization', as('tester1', device))
      .query({ txhId: 'bad' });
    expect(res.status).toBe(400);
    expect((res.body as Body).errors[0].code).toBe('VALIDATION_IS_UUID');
  });
});

describe('notes 119 · §1 the counter', () => {
  it('a held bill that is not there: HOLD_NOT_FOUND', async () => {
    const res = await http()
      .get('/api/v1/txn-holds/get')
      .set('Authorization', as('tester1', device))
      .query({ txhId: NO_SUCH });
    expect(res.status).toBe(404);
    expect((res.body as Body).errors[0]).toEqual(
      expect.objectContaining({ field: 'txhId', code: 'HOLD_NOT_FOUND' }),
    );
  });

  it('a tender-line lookup by id and by document at once: TENDER_LINE_LOOKUP_AMBIGUOUS', async () => {
    const res = await http()
      .get('/api/v1/tender-details/get')
      .set('Authorization', as('tester1', device))
      .query({ tdId: NO_SUCH, tdSrcModule: 'SALES' });
    expect(res.status).toBe(400);
    expect((res.body as Body).errors[0].code).toBe('TENDER_LINE_LOOKUP_AMBIGUOUS');
  });
});
