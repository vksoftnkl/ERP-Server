import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { BEARER, COMPANY, bootApp, data, expectStatus, prisma } from './helpers/payment-e2e';
import { MenuRightsMemo, grantMenuRights, restoreMenuRights } from './helpers/menu-rights';
import {
  DEPARTMENT_CODE_RULE,
  EMPLOYEE_CODE_RULE,
  firstFreeCode,
  initialsCode,
} from '../src/modules/settings/shared/code-from-name';

/**
 * HR masters review step 5 (admin/review-hr-masters-2026-11-19.md, migration
 * 20261120100000), over HTTP against the live database:
 *
 *   1 · Department / Designation / Employee: a blank Code on create is made from the
 *       name (Company rule / whole name / initials), never on an edit; a typed code a
 *       live row holds in another case is a 409 *_CODE_DUPLICATE on the code field;
 *   2 · Designation ignores edIsDefault and no longer answers it;
 *   3 · Employee: blank company = the token's, blank status = Working, any case →
 *       Working / Resigned, the fixed lists, IFSC, commission value as a Decimal string,
 *       the six new fields on save and get;
 *   4 · Has Commission sent unticked clears the commission type and value (user 20/11);
 *   5 · a Resigned employee leaves the employees lookup and the vehicle driver check.
 *
 * Real writes, ZT- names; the teardown deletes only the ids this run created (and the
 * staff advance ledgers their employees got).
 *
 *     npm run test:e2e -- hr-masters-step5-http --runInBand
 */

jest.setTimeout(240_000);

const DEPARTMENTS = '/api/v1/employee-department-masters';
const DESIGNATIONS = '/api/v1/employee-designation-masters';
const EMPLOYEES = '/api/v1/employee-masters';
const LOOKUP = '/api/v1/master-lookups/name-id/all-masters';
const VEHICLES = '/api/v1/vehicles';
const VEHICLE_MENU = 125;

let app: INestApplication;
let rights: MenuRightsMemo | null = null;
const stamp = Date.now().toString(36).toUpperCase();
const departmentIds: string[] = [];
const designationIds: string[] = [];
const employeeIds: string[] = [];
const vehicleIds: string[] = [];

const api = () => request(app.getHttpServer());
const auth = <T extends request.Test>(req: T): T => req.set('Authorization', BEARER);
const errorOf = (res: request.Response) =>
  (res.body as { errors?: Array<{ field: string; code: string }> }).errors?.[0];

beforeAll(async () => {
  rights = await grantMenuRights(prisma, [VEHICLE_MENU]);
  app = await bootApp();
});

afterAll(async () => {
  if (vehicleIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.vehicle_master WHERE veh_id = ANY($1::uuid[])`,
      vehicleIds,
    );
  }
  if (employeeIds.length > 0) {
    const ledgers = await prisma.employeeMaster.findMany({
      where: { empId: { in: employeeIds } },
      select: { empLoanLedgerId: true },
    });
    await prisma.employeeMaster.deleteMany({ where: { empId: { in: employeeIds } } });
    const ledIds = ledgers.map((row) => row.empLoanLedgerId).filter((id): id is string => !!id);
    if (ledIds.length > 0) {
      await prisma.accLedgerMaster.deleteMany({ where: { ledId: { in: ledIds } } });
    }
  }
  if (designationIds.length > 0) {
    await prisma.employeeDesignation.deleteMany({ where: { edId: { in: designationIds } } });
  }
  if (departmentIds.length > 0) {
    await prisma.employeeDepartment.deleteMany({ where: { edptId: { in: departmentIds } } });
  }
  await restoreMenuRights(prisma, rights);
  await app?.close();
  await prisma.$disconnect();
});

describe('HR masters step 5 over HTTP (e2e, live DB, writes)', () => {
  let edptCode: string;
  let edptId: string;

  it('Department: a blank code is the Company rule initials; a clash in another case is 409', async () => {
    const edptName = `ZT Hr ${stamp}`;
    const base = initialsCode(edptName, DEPARTMENT_CODE_RULE)!;
    const taken = await prisma.employeeDepartment.findMany({
      where: { edptIsDeleted: false, edptCode: { startsWith: base, mode: 'insensitive' } },
      select: { edptCode: true },
    });
    const res = await auth(api().post(`${DEPARTMENTS}/create`)).send({ edptName, edptCode: '' });
    expectStatus(res, 201);
    const saved = data<{ edptId: string; edptCode: string }>(res);
    departmentIds.push(saved.edptId);
    edptId = saved.edptId;
    edptCode = saved.edptCode;
    expect(edptCode).toBe(
      firstFreeCode(
        base,
        taken.map((row) => row.edptCode),
      ),
    );

    const clash = await auth(api().post(`${DEPARTMENTS}/create`)).send({
      edptName: `ZT Hr Other ${stamp}`,
      edptCode: edptCode.toLowerCase(),
    });
    expectStatus(clash, 409);
    expect(errorOf(clash)).toMatchObject({ field: 'edptCode', code: 'DEPARTMENT_CODE_DUPLICATE' });
  });

  it('Department: an edit never makes a code; a blank one clears it', async () => {
    const res = await auth(api().post(`${DEPARTMENTS}/create`)).send({
      edptId,
      edptName: `ZT Hr ${stamp}`,
      edptCode: '',
    });
    expectStatus(res, 201);
    expect(data<{ edptCode: string | null }>(res).edptCode).toBeNull();
  });

  it('Designation: a blank code is the whole name; edIsDefault is ignored and not answered', async () => {
    const edName = `ZT Desig ${stamp}`;
    const res = await auth(api().post(`${DESIGNATIONS}/create`)).send({
      edName,
      edCode: null,
      edIsDefault: true,
    });
    expectStatus(res, 201);
    const saved = data<Record<string, unknown> & { edId: string; edCode: string }>(res);
    designationIds.push(saved.edId);
    expect(saved.edCode).toBe(`ZTDESIG${stamp}`.slice(0, 20));
    expect(saved).not.toHaveProperty('edIsDefault');
    const row = await prisma.employeeDesignation.findUniqueOrThrow({
      where: { edId: saved.edId },
      select: { edIsDefault: true },
    });
    expect(row.edIsDefault).toBe(false);

    const clash = await auth(api().post(`${DESIGNATIONS}/create`)).send({
      edName: `ZT Desig Other ${stamp}`,
      edCode: saved.edCode.toLowerCase(),
    });
    expectStatus(clash, 409);
    expect(errorOf(clash)).toMatchObject({ field: 'edCode', code: 'DESIGNATION_CODE_DUPLICATE' });
  });

  let empId: string;
  let empCode: string;

  it('Employee: blank code, company and status → initials, the token company, Working', async () => {
    const empName = `ZT Emp ${stamp}`;
    const base = initialsCode(empName, EMPLOYEE_CODE_RULE)!;
    const taken = await prisma.employeeMaster.findMany({
      where: { empIsDeleted: false, empCode: { startsWith: base, mode: 'insensitive' } },
      select: { empCode: true },
    });
    const res = await auth(api().post(`${EMPLOYEES}/create`)).send({
      empName,
      empSalaryType: 'MONTHLY',
      empCode: '  ',
    });
    expectStatus(res, 201);
    const saved = data<Record<string, unknown> & { empId: string; empCode: string }>(res);
    employeeIds.push(saved.empId);
    empId = saved.empId;
    empCode = saved.empCode;
    expect(saved).toMatchObject({
      empCompanyId: COMPANY,
      empStatus: 'Working',
      empCode: firstFreeCode(
        base,
        taken.map((row) => row.empCode),
      ),
      empCommissionValue: null,
      empBankIfsc: null,
    });
  });

  it('Employee: a typed code a live employee holds, in another case, is 409 EMPLOYEE_CODE_DUPLICATE', async () => {
    const res = await auth(api().post(`${EMPLOYEES}/create`)).send({
      empName: `ZT Emp Other ${stamp}`,
      empSalaryType: 'MONTHLY',
      empCode: empCode.toLowerCase(),
    });
    expectStatus(res, 409);
    expect(errorOf(res)).toMatchObject({ field: 'empCode', code: 'EMPLOYEE_CODE_DUPLICATE' });
  });

  it.each([
    [{ empStatus: 'On Leave' }, 'empStatus', 'VALIDATION_IS_IN'],
    [{ empEmploymentType: 'Casual' }, 'empEmploymentType', 'VALIDATION_IS_IN'],
    [{ empCommissionType: '%' }, 'empCommissionType', 'VALIDATION_IS_IN'],
    [{ empBankIfsc: 'SBIN001234' }, 'empBankIfsc', 'VALIDATION_IS_IFSC'],
    [{ empCommissionValue: '1.2345' }, 'empCommissionValue', 'VALIDATION_MATCHES'],
  ])('Employee: refuses %p with 400 %s %s', async (fields, field, code) => {
    const res = await auth(api().post(`${EMPLOYEES}/create`)).send({
      empName: `ZT Emp Bad ${stamp}`,
      empSalaryType: 'MONTHLY',
      ...fields,
    });
    expectStatus(res, 400);
    expect(errorOf(res)).toMatchObject({ field, code });
  });

  it('Employee: an edit stores the lists in their spelling, the Decimal and the new fields; get answers them', async () => {
    const fields = {
      empUanNo: '100200300400',
      empBankName: 'ZT Bank',
      empBankAccountNo: '00112233445566',
      empEmergencyContactName: 'ZT Contact',
      empEmergencyContactPhone: '9840012345',
    };
    const res = await auth(api().post(`${EMPLOYEES}/create`)).send({
      empId,
      empName: `ZT Emp ${stamp}`,
      empSalaryType: 'MONTHLY',
      empCode,
      empStatus: 'resigned',
      empEmploymentType: 'daily wage',
      empHasCommission: true,
      empCommissionType: 'percent',
      empCommissionValue: 2.5,
      empBankIfsc: 'sbin0001234',
      ...fields,
    });
    expectStatus(res, 201);
    const expected = {
      empCode,
      empStatus: 'Resigned',
      empEmploymentType: 'Daily Wage',
      empHasCommission: true,
      empCommissionType: 'Percent',
      empCommissionValue: '2.500',
      empBankIfsc: 'SBIN0001234',
      ...fields,
    };
    expect(data(res)).toMatchObject(expected);

    const got = await auth(api().get(`${EMPLOYEES}/get`)).query({ empId });
    expectStatus(got, 200);
    expect(data(got)).toMatchObject({ ...expected, empCompanyId: COMPANY });
    const row = await prisma.employeeMaster.findUniqueOrThrow({
      where: { empId },
      select: { empCommissionValue: true, empStatus: true },
    });
    expect(row.empCommissionValue?.toString()).toBe('2.5');
    expect(row.empStatus).toBe('Resigned');
  });

  it('Employee: an edit without Has Commission keeps the commission; unticking it clears type and value', async () => {
    const base = { empId, empName: `ZT Emp ${stamp}`, empSalaryType: 'MONTHLY', empCode };
    const kept = await auth(api().post(`${EMPLOYEES}/create`)).send(base);
    expectStatus(kept, 201);
    expect(data(kept)).toMatchObject({
      empHasCommission: true,
      empCommissionType: 'Percent',
      empCommissionValue: '2.500',
    });

    const cleared = await auth(api().post(`${EMPLOYEES}/create`)).send({
      ...base,
      empHasCommission: false,
      empCommissionType: 'Amount',
      empCommissionValue: '99',
    });
    expectStatus(cleared, 201);
    expect(data(cleared)).toMatchObject({
      empHasCommission: false,
      empCommissionType: null,
      empCommissionValue: null,
    });
    const row = await prisma.employeeMaster.findUniqueOrThrow({
      where: { empId },
      select: { empHasCommission: true, empCommissionType: true, empCommissionValue: true },
    });
    expect(row).toEqual({
      empHasCommission: false,
      empCommissionType: null,
      empCommissionValue: null,
    });
  });

  it('a Resigned employee leaves the employees lookup and the vehicle driver check', async () => {
    const lookup = await auth(api().get(LOOKUP)).query({ module: 'employees' });
    expectStatus(lookup, 200);
    const ids = data<Array<{ id: string }>>(lookup).map((row) => row.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain(empId);

    const vehicle = await auth(api().post(`${VEHICLES}/save`)).send({
      companyId: COMPANY,
      vehicleNo: `ZT${stamp}`.slice(0, 20),
      type: 'REGULAR',
      isOwn: true,
      driverId: empId,
    });
    if (vehicle.status === 201 || vehicle.status === 200) {
      vehicleIds.push(data<{ vehId: string }>(vehicle).vehId);
    }
    expectStatus(vehicle, 422);
    expect(errorOf(vehicle)).toMatchObject({ field: 'driverId', code: 'VEH_DRIVER_INVALID' });
  });

  it('deletes what it made through the delete routes', async () => {
    const emp = await auth(api().delete(`${EMPLOYEES}/delete`)).query({ empId });
    expectStatus(emp, 200);
    for (const edId of designationIds) {
      expectStatus(await auth(api().delete(`${DESIGNATIONS}/delete`)).query({ edId }), 200);
    }
    for (const id of departmentIds) {
      expectStatus(await auth(api().delete(`${DEPARTMENTS}/delete`)).query({ edptId: id }), 200);
    }
  });
});
