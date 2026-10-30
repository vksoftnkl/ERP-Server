import { HttpException } from '@nestjs/common';
import { EmployeeDepartment } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { EmployeeDepartmentMasterService } from './employee-department-master.service';
import { EmployeeDepartmentMasterErrorCode } from './types/employee-department-master-error-codes';

const DEPT_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const departmentRow = (overrides: Partial<EmployeeDepartment> = {}): EmployeeDepartment => ({
  edptId: DEPT_ID,
  edptName: 'Accounts',
  edptCode: 'ACC',
  edptAlias: null,
  edptRemarks: null,
  edptIsActive: true,
  edptIsDeleted: false,
  edptSyncDate: null,
  edptCreatedOn: STAMP,
  edptCreatedBy: USER_ID,
  edptModifiedOn: STAMP,
  edptModifiedBy: USER_ID,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

type FindFirstArgs = { where: Record<string, unknown>; select?: unknown };

type PrismaMock = {
  employeeDepartment: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  employeeMaster: { count: jest.Mock };
  $transaction: jest.Mock;
};

describe('EmployeeDepartmentMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: EmployeeDepartmentMasterService;

  /** The stored row for an existence read; nothing for a duplicate check (it selects). */
  const storedRow = (row: EmployeeDepartment | null, clash: object | null = null) =>
    prisma.employeeDepartment.findFirst.mockImplementation(async (args: FindFirstArgs) =>
      args.select ? clash : row,
    );

  beforeEach(() => {
    prisma = {
      employeeDepartment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<EmployeeDepartment> }) =>
          departmentRow(data),
        ),
        update: jest.fn(async ({ data }: { data: Partial<EmployeeDepartment> }) =>
          departmentRow(data),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employeeMaster: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new EmployeeDepartmentMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.employeeDepartment.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedCall = () =>
    prisma.employeeDepartment.update.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create (no edptId)', () => {
    it('trims the name and code, stamps the request user and audits the new department', async () => {
      const payload = await service.save({ edptName: '  Accounts ', edptCode: ' ACC ' });

      expect(createdData()).toEqual({
        edptName: 'Accounts',
        edptCreatedOn: expect.any(Date),
        edptCreatedBy: USER_ID,
        edptCode: 'ACC',
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'employee departments',
        screenName: 'Employee Department Master',
        pk: DEPT_ID,
        displayName: 'Accounts',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
      });
      expect(audit.logEntityChange.mock.calls[0][1]).toBe(prisma);
    });

    it('stamps the default actor when no user is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save({ edptName: 'Accounts' });

      expect(createdData().edptCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('stores blank optional text as null and skips the code check for it', async () => {
      await service.save({ edptName: 'Accounts', edptCode: '  ', edptAlias: '', edptRemarks: null });

      expect(createdData()).toMatchObject({ edptCode: null, edptAlias: null, edptRemarks: null });
      // Only the name was checked for a duplicate.
      expect(prisma.employeeDepartment.findFirst).toHaveBeenCalledTimes(1);
    });

    it('writes edptIsActive only when it is sent', async () => {
      await service.save({ edptName: 'Accounts', edptIsActive: false });

      expect(createdData().edptIsActive).toBe(false);
    });

    it('refuses a blank name', async () => {
      const refusal = await refusalOf(service.save({ edptName: '   ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'edptName', code: EmployeeDepartmentMasterErrorCode.NAME_REQUIRED }],
        },
      });
      expect(prisma.employeeDepartment.create).not.toHaveBeenCalled();
    });

    it('refuses a name another live department holds, compared case-insensitively', async () => {
      storedRow(null, { edptId: 'other' });

      const refusal = await refusalOf(service.save({ edptName: 'accounts' }));

      expect(prisma.employeeDepartment.findFirst).toHaveBeenCalledWith({
        where: { edptIsDeleted: false, edptName: { equals: 'accounts', mode: 'insensitive' } },
        select: { edptId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'edptName', code: EmployeeDepartmentMasterErrorCode.NAME_DUPLICATE }],
        },
      });
      expect(prisma.employeeDepartment.create).not.toHaveBeenCalled();
    });

    it('refuses a code another live department holds', async () => {
      prisma.employeeDepartment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ edptId: 'other' });

      const refusal = await refusalOf(service.save({ edptName: 'Accounts', edptCode: 'acc' }));

      expect(prisma.employeeDepartment.findFirst).toHaveBeenLastCalledWith({
        where: { edptIsDeleted: false, edptCode: { equals: 'acc', mode: 'insensitive' } },
        select: { edptId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'edptCode', code: EmployeeDepartmentMasterErrorCode.CODE_DUPLICATE }],
        },
      });
    });
  });

  describe('save — update (edptId present)', () => {
    it('refuses an id that names no live department', async () => {
      const refusal = await refusalOf(service.save({ edptId: DEPT_ID, edptName: 'Accounts' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'edptId', code: EmployeeDepartmentMasterErrorCode.NOT_FOUND }] },
      });
      expect(prisma.employeeDepartment.update).not.toHaveBeenCalled();
    });

    it('checks name and code against every department but itself', async () => {
      storedRow(departmentRow());

      await service.save({ edptId: DEPT_ID, edptName: 'Finance', edptCode: 'FIN' });

      const checks = prisma.employeeDepartment.findFirst.mock.calls
        .map(([args]) => args as FindFirstArgs)
        .filter((args) => args.select);
      expect(checks.map((args) => args.where)).toEqual([
        {
          edptIsDeleted: false,
          edptName: { equals: 'Finance', mode: 'insensitive' },
          edptId: { not: DEPT_ID },
        },
        {
          edptIsDeleted: false,
          edptCode: { equals: 'FIN', mode: 'insensitive' },
          edptId: { not: DEPT_ID },
        },
      ]);
    });

    it('writes the name, the sent fields and the modified stamp, and audits before and after', async () => {
      storedRow(departmentRow());

      const payload = await service.save({
        edptId: DEPT_ID,
        edptName: ' Finance ',
        edptRemarks: ' moved ',
      });

      expect(updatedCall()).toEqual({
        where: { edptId: DEPT_ID },
        data: {
          edptName: 'Finance',
          edptModifiedOn: expect.any(Date),
          edptModifiedBy: USER_ID,
          edptRemarks: 'moved',
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: DEPT_ID,
        originalRecord: expect.objectContaining({ edptName: 'Accounts' }),
        modifiedRecord: payload,
      });
      expect(payload).toMatchObject({ edptName: 'Finance', edptCreatedOn: STAMP.toISOString() });
    });
  });

  describe('getById', () => {
    it('returns the live department with ISO dates', async () => {
      prisma.employeeDepartment.findFirst.mockResolvedValue(
        departmentRow({ edptSyncDate: new Date('2026-10-02T00:00:00.000Z') }),
      );

      await expect(service.getById(DEPT_ID)).resolves.toEqual({
        edptId: DEPT_ID,
        edptName: 'Accounts',
        edptCode: 'ACC',
        edptAlias: null,
        edptRemarks: null,
        edptIsActive: true,
        edptIsDeleted: false,
        edptSyncDate: '2026-10-02T00:00:00.000Z',
        edptCreatedOn: STAMP.toISOString(),
        edptCreatedBy: USER_ID,
        edptModifiedOn: STAMP.toISOString(),
        edptModifiedBy: USER_ID,
      });
      expect(prisma.employeeDepartment.findFirst).toHaveBeenCalledWith({
        where: { edptId: DEPT_ID, edptIsDeleted: false },
      });
    });

    it('refuses an id with no live department', async () => {
      const refusal = await refusalOf(service.getById(DEPT_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              code: EmployeeDepartmentMasterErrorCode.NOT_FOUND,
              message: `No active employee department found with id ${DEPT_ID}`,
            },
          ],
        },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live department', async () => {
      const refusal = await refusalOf(service.softDelete(DEPT_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.employeeMaster.count).not.toHaveBeenCalled();
    });

    it('refuses while live employees are still in the department', async () => {
      prisma.employeeDepartment.findFirst.mockResolvedValue(departmentRow());
      prisma.employeeMaster.count.mockResolvedValue(3);

      const refusal = await refusalOf(service.softDelete(DEPT_ID));

      expect(prisma.employeeMaster.count).toHaveBeenCalledWith({
        where: { empDepartmentId: DEPT_ID, empIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'edptId',
              code: EmployeeDepartmentMasterErrorCode.IN_USE,
              message: `Employee department ${DEPT_ID} is used by 3 employee(s).`,
            },
          ],
        },
      });
      expect(prisma.employeeDepartment.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.employeeDepartment.findFirst.mockResolvedValue(departmentRow());
      prisma.employeeDepartment.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(DEPT_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the department deleted and inactive, and audits it as a cancel', async () => {
      prisma.employeeDepartment.findFirst.mockResolvedValue(departmentRow());

      await expect(service.softDelete(DEPT_ID)).resolves.toEqual({
        edptId: DEPT_ID,
        deleted: true,
      });
      expect(prisma.employeeDepartment.updateMany).toHaveBeenCalledWith({
        where: { edptId: DEPT_ID, edptIsDeleted: false },
        data: {
          edptIsDeleted: true,
          edptIsActive: false,
          edptModifiedOn: expect.any(Date),
          edptModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Accounts',
        originalRecord: expect.objectContaining({ edptIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ edptIsDeleted: true, edptIsActive: false }),
      });
    });
  });
});
