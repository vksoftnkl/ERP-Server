import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  ACC_YEAR,
  BEARER,
  CASH_TENDER_TYPE,
  COMPANY,
  bootApp,
  createAndPost,
  data,
  draftBody,
  expectStatus,
  loadMasters,
  PAYMENT_MENU,
  PaymentFixtures,
  prisma,
  type Masters,
} from './helpers/payment-e2e';

/**
 * NOTES 95 — the acceptance list, over HTTP against the live database:
 *
 *   1 · an employee saved with no ledger comes back with "<name> - Staff Advance";
 *   2 · Payment (menu 100) offers it as a payee, and 500 cash paid and posted puts it Dr 500;
 *   3 · the ledger follows a rename, and the delete is 409 EMP_LEDGER_HAS_BALANCE;
 *   4 · usrPin sets / clears usrPinSet and never returns the hash;
 *   5 · a second active user on the same employee is a 409;
 *   6 · GET names the employee on the user and the ledger on the employee.
 *
 * Real writes: the payment through PaymentFixtures (the ledger is registered as its party, so
 * its teardown removes the voucher, the bill and the ledger), the employee and users by hand.
 * The edge rules are `employee-ledger-user-pin-notes-95.e2e-spec.ts`, in a rolled-back
 * transaction.
 *
 *     npm run test:e2e -- employee-staff-advance-http-notes-95 --runInBand
 */

jest.setTimeout(240_000);

const EMPLOYEES = '/api/v1/employee-masters';
const USERS = '/api/v1/user-administration';

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();
const employeeIds: string[] = [];
const userIds: string[] = [];
const stamp = Date.now().toString(36).toUpperCase();
const ravi = `ZT Ravi ${stamp}`;

const api = () => request(app.getHttpServer());
const auth = <T extends request.Test>(req: T): T => req.set('Authorization', BEARER);

/** A configured dropdown's rows as the Qt client gets them: the stored SQL, icompany_id bound. */
async function dropdownRows(dropdownId: number): Promise<Array<{ led_id: string }>> {
  const config = await prisma.dropdownDetails.findUniqueOrThrow({ where: { dropdownId } });
  return prisma.$queryRawUnsafe(config.dropdownSql.replaceAll('icompany_id', COMPANY));
}

let empId: string;
let ledId: string;

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU]);
  masters = await loadMasters();
  app = await bootApp();
});

afterAll(async () => {
  await fixtures.teardown();
  if (employeeIds.length > 0) {
    await prisma.employeeMaster.deleteMany({ where: { empId: { in: employeeIds } } });
  }
  if (userIds.length > 0) {
    await prisma.userMenus.deleteMany({ where: { umUserId: { in: userIds } } });
    await prisma.userMaster.deleteMany({ where: { usrId: { in: userIds } } });
  }
  await app?.close();
  await prisma.$disconnect();
});

describe('Notes 95 acceptance over HTTP (e2e, live DB, writes)', () => {
  it('1 · an employee created with no ledger answers with "<name> - Staff Advance", PARTY, in Loans & Advances (Asset)', async () => {
    const res = await auth(api().post(`${EMPLOYEES}/create`)).send({
      empCompanyId: COMPANY,
      empName: ravi,
      empSalaryType: 'MONTHLY',
    });
    expectStatus(res, 201);
    const saved = data<{ empId: string; empLoanLedgerId: string | null }>(res);
    empId = saved.empId;
    employeeIds.push(empId);
    expect(saved.empLoanLedgerId).toBeTruthy();
    ledId = saved.empLoanLedgerId!;
    fixtures.parties.push(ledId);

    const ledger = await prisma.accLedgerMaster.findUniqueOrThrow({
      where: { ledId },
      include: { accGroupMaster: { select: { accGroupName: true } } },
    });
    expect(ledger.ledName).toBe(`${ravi} - Staff Advance`);
    expect(ledger.accGroupMaster.accGroupName).toBe('Loans & Advances (Asset)');
    expect(ledger.ledLedgerType).toBe('PARTY');
  });

  it('2 · Payment offers it as a payee; 500 cash paid and posted leaves it Dr 500', async () => {
    expect((await dropdownRows(60)).map((row) => row.led_id)).toContain(ledId);
    expect((await dropdownRows(63)).map((row) => row.led_id)).toContain(ledId);

    const cash = {
      tdRowNo: 1,
      tdTenderId: masters.cashTenderId,
      tdTenderTypeId: CASH_TENDER_TYPE,
      ...(masters.cashLedgerId ? { tdTenderLedgerId: masters.cashLedgerId } : {}),
      tdAmount: 500,
      tdReceivedAmt: 500,
      tdChangeAmt: 0,
    };
    const { voucherId, posted } = await createAndPost(
      app,
      fixtures,
      draftBody(ledId, [cash], { avhRemarks: 'E2E notes 95 staff advance' }),
      { allocations: [], onAccount: 500 },
    );
    expectStatus(posted, 201);

    const legs = await prisma.accVoucher.findMany({
      where: { avVoucherId: voucherId, avAccYear: ACC_YEAR, avLedgerId: ledId, avIsDeleted: false },
      select: { avDrCr: true, avAmount: true, avSignedAmount: true },
    });
    expect(legs).toHaveLength(1);
    expect(legs[0].avDrCr.trim()).toBe('DR');
    expect(Number(legs[0].avSignedAmount)).toBe(500);
  });

  it('3 · the ledger name follows a rename, and the delete is 409 EMP_LEDGER_HAS_BALANCE', async () => {
    const renamed = await auth(api().post(`${EMPLOYEES}/create`)).send({
      empId,
      empCompanyId: COMPANY,
      empName: `ZT Ravi K ${stamp}`,
      empSalaryType: 'MONTHLY',
      empLoanLedgerId: ledId,
    });
    expectStatus(renamed, 201);
    expect(
      (await prisma.accLedgerMaster.findUniqueOrThrow({ where: { ledId } })).ledName,
    ).toBe(`ZT Ravi K ${stamp} - Staff Advance`);

    const refused = await auth(api().delete(`${EMPLOYEES}/delete`)).query({ empId });
    expectStatus(refused, 409);
    const body = refused.body as { errors: Array<{ field: string; code?: string; message: string }> };
    expect(body.errors[0]).toMatchObject({ field: 'empId', code: 'EMP_LEDGER_HAS_BALANCE' });
    expect(body.errors[0].message).toContain('500.00 Dr');
  });

  it('4 · usrPin "4321" → usrPinSet true and no hash; "" → false', async () => {
    const created = await api()
      .post(`${USERS}/create`)
      .send({
        usrLoginName: `ZT95-PIN-${stamp}`,
        usrPassword: 'zt-secret-95',
        usrCompanyId: COMPANY,
        usrPin: '4321',
      });
    expectStatus(created, 201);
    const usrId = data<{ usrId: string }>(created).usrId;
    userIds.push(usrId);

    const got = await api().get(`${USERS}/get`).query({ usrId });
    expectStatus(got, 200);
    expect(data<{ usrPinSet: boolean }>(got).usrPinSet).toBe(true);
    expect(JSON.stringify(got.body)).not.toMatch(/scrypt\$|usrPinHash/);

    const cleared = await api()
      .post(`${USERS}/create`)
      .send({ usrId, usrLoginName: `ZT95-PIN-${stamp}`, usrPin: '' });
    expectStatus(cleared, 201);
    expect(data<{ usrPinSet: boolean }>(cleared).usrPinSet).toBe(false);

    const short = await api()
      .post(`${USERS}/create`)
      .send({ usrId, usrLoginName: `ZT95-PIN-${stamp}`, usrPin: '12' });
    expectStatus(short, 400);
  });

  it('5 · a second active user on the same employee is a 409 on usrEmployeeId; 6 · GET names both links', async () => {
    const first = await api()
      .post(`${USERS}/create`)
      .send({
        usrLoginName: `ZT95-EMP1-${stamp}`,
        usrPassword: 'zt-secret-95',
        usrCompanyId: COMPANY,
        usrEmployeeId: empId,
      });
    expectStatus(first, 201);
    const usrId = data<{ usrId: string }>(first).usrId;
    userIds.push(usrId);

    const second = await api()
      .post(`${USERS}/create`)
      .send({
        usrLoginName: `ZT95-EMP2-${stamp}`,
        usrPassword: 'zt-secret-95',
        usrCompanyId: COMPANY,
        usrEmployeeId: empId,
      });
    expectStatus(second, 409);
    expect((second.body as { errors: Array<{ field: string }> }).errors[0].field).toBe(
      'usrEmployeeId',
    );

    const user = await api().get(`${USERS}/get`).query({ usrId });
    expect(data<{ usrEmployeeName: string }>(user).usrEmployeeName).toBe(`ZT Ravi K ${stamp}`);
    const employee = await auth(api().get(`${EMPLOYEES}/get`)).query({ empId });
    expect(data<{ empLoanLedgerName: string }>(employee).empLoanLedgerName).toBe(
      `ZT Ravi K ${stamp} - Staff Advance`,
    );
  });
});
