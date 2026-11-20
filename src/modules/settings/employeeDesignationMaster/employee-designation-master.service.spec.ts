import { HttpException } from '@nestjs/common';
import { EmployeeDesignation, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { EmployeeDesignationMasterService } from './employee-designation-master.service';
import { EmployeeDesignationMasterErrorCode } from './types/employee-designation-master-error-codes';

const DESIG_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const designationRow = (overrides: Partial<EmployeeDesignation> = {}): EmployeeDesignation => ({
  edId: DESIG_ID,
  edName: 'Cashier',
  edCode: 'CSH',
  edIsDefault: false,
  edRemarks: null,
  edIsActive: true,
  edIsDeleted: false,
  edSyncDate: null,
  edCreatedOn: STAMP,
  edCreatedBy: USER_ID,
  edModifiedOn: STAMP,
  edModifiedBy: USER_ID,
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
  employeeDesignation: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  employeeMaster: { count: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

/** What Prisma throws when a write breaks a unique index. */
const uniqueViolation = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });

describe('EmployeeDesignationMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let service: EmployeeDesignationMasterService;

  /** The stored row for an existence read; nothing for a duplicate check (it selects). */
  const storedRow = (row: EmployeeDesignation | null, clash: object | null = null) =>
    prisma.employeeDesignation.findFirst.mockImplementation(async (args: FindFirstArgs) =>
      args.select ? clash : row,
    );

  beforeEach(() => {
    prisma = {
      employeeDesignation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: Partial<EmployeeDesignation> }) =>
          designationRow(data),
        ),
        update: jest.fn(async ({ data }: { data: Partial<EmployeeDesignation> }) =>
          designationRow(data),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employeeMaster: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new EmployeeDesignationMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      { getUserId: jest.fn().mockReturnValue(USER_ID) } as never,
    );
  });

  const createdData = () =>
    (prisma.employeeDesignation.create.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create (no edId)', () => {
    it('trims the name and code, stamps the request user and audits the new designation', async () => {
      const payload = await service.save({ edName: ' Cashier ', edCode: ' CSH ' });

      expect(createdData()).toEqual({
        edName: 'Cashier',
        edCreatedOn: expect.any(Date),
        edCreatedBy: USER_ID,
        edCode: 'CSH',
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'employee designations',
        screenName: 'Employee Designation Master',
        pk: DESIG_ID,
        displayName: 'Cashier',
        originalRecord: null,
        modifiedRecord: payload,
      });
    });

    it.each([true, false])(
      'ignores edIsDefault %p: Default Designation is gone (HR review step 5, H6)',
      async (edIsDefault) => {
        const payload = await service.save({ edName: 'Cashier', edCode: 'CSH', edIsDefault });

        expect(prisma.employeeDesignation.updateMany).not.toHaveBeenCalled();
        expect(createdData()).not.toHaveProperty('edIsDefault');
        expect(payload).not.toHaveProperty('edIsDefault');
      },
    );

    it('makes a blank code from the whole name, under the code lock, and skips the code check', async () => {
      await service.save({ edName: 'Sales Manager', edCode: '', edRemarks: '  ' });

      expect(createdData()).toMatchObject({ edCode: 'SALESMANAGER', edRemarks: null });
      expect(prisma.employeeDesignation.findMany).toHaveBeenCalledWith({
        where: { edIsDeleted: false, edCode: { startsWith: 'SALESMANAGER', mode: 'insensitive' } },
        select: { edCode: true },
      });
      // Only the name was checked for a duplicate.
      expect(prisma.employeeDesignation.findFirst).toHaveBeenCalledTimes(1);
      const [sql, ...keys] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(sql.join('?')).toContain(
        'pg_advisory_xact_lock(hashtext(?::text), hashtext(?::text))',
      );
      expect(keys).toEqual(['public.employee_designations', 'ed_code']);
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.employeeDesignation.findMany.mock.invocationCallOrder[0],
      );
    });

    it('keeps the driver list working: Driver becomes DRIVER, a second one DRIVER2', async () => {
      prisma.employeeDesignation.findMany.mockResolvedValue([{ edCode: 'driver' }]);

      await service.save({ edName: 'Driver' });

      expect(createdData().edCode).toBe('DRIVER2');
    });

    it('leaves the code empty when the name holds no letter or digit', async () => {
      await service.save({ edName: '--' });

      expect(createdData()).not.toHaveProperty('edCode');
      expect(prisma.employeeDesignation.findMany).not.toHaveBeenCalled();
    });

    it('answers a race onto ux_ed_code as DESIGNATION_CODE_DUPLICATE on edCode', async () => {
      prisma.employeeDesignation.create.mockRejectedValue(uniqueViolation('ux_ed_code'));

      const refusal = await refusalOf(service.save({ edName: 'Driver' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'edCode', code: EmployeeDesignationMasterErrorCode.CODE_DUPLICATE }],
        },
      });
    });

    it('answers a unique violation it cannot place as DESIGNATION_DUPLICATE', async () => {
      prisma.employeeDesignation.create.mockRejectedValue(uniqueViolation(['led_code']));

      const refusal = await refusalOf(service.save({ edName: 'Driver' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: EmployeeDesignationMasterErrorCode.DUPLICATE }] },
      });
    });

    it('refuses a blank name', async () => {
      const refusal = await refusalOf(service.save({ edName: ' ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'edName', code: EmployeeDesignationMasterErrorCode.NAME_REQUIRED }],
        },
      });
    });

    it('refuses a name another live designation holds', async () => {
      storedRow(null, { edId: 'other' });

      const refusal = await refusalOf(service.save({ edName: 'cashier', edIsDefault: true }));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'edName', code: EmployeeDesignationMasterErrorCode.NAME_DUPLICATE }],
        },
      });
      // Refused before the default moved.
      expect(prisma.employeeDesignation.updateMany).not.toHaveBeenCalled();
      expect(prisma.employeeDesignation.create).not.toHaveBeenCalled();
    });

    it('refuses a code another live designation holds', async () => {
      prisma.employeeDesignation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ edId: 'other' });

      const refusal = await refusalOf(service.save({ edName: 'Cashier', edCode: 'csh' }));

      expect(prisma.employeeDesignation.findFirst).toHaveBeenLastCalledWith({
        where: { edIsDeleted: false, edCode: { equals: 'csh', mode: 'insensitive' } },
        select: { edId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'edCode', code: EmployeeDesignationMasterErrorCode.CODE_DUPLICATE }],
        },
      });
    });
  });

  describe('save — update (edId present)', () => {
    it('refuses an id that names no live designation', async () => {
      const refusal = await refusalOf(service.save({ edId: DESIG_ID, edName: 'Cashier' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'edId', code: EmployeeDesignationMasterErrorCode.NOT_FOUND }] },
      });
      expect(prisma.employeeDesignation.update).not.toHaveBeenCalled();
    });

    it('ignores edIsDefault and never makes a code on an edit', async () => {
      storedRow(designationRow());

      await service.save({ edId: DESIG_ID, edName: 'Cashier', edCode: '', edIsDefault: true });

      expect(prisma.employeeDesignation.updateMany).not.toHaveBeenCalled();
      expect(prisma.employeeDesignation.findMany).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      const { data } = prisma.employeeDesignation.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.edCode).toBeNull();
      expect(data).not.toHaveProperty('edIsDefault');
    });

    it('checks name and code against every designation but itself, then writes and audits', async () => {
      storedRow(designationRow());

      const payload = await service.save({ edId: DESIG_ID, edName: 'Head Cashier', edCode: 'HC' });

      // A typed code is checked under the code lock.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const checks = prisma.employeeDesignation.findFirst.mock.calls
        .map(([args]) => args as FindFirstArgs)
        .filter((args) => args.select)
        .map((args) => args.where);
      expect(checks).toEqual([
        {
          edIsDeleted: false,
          edName: { equals: 'Head Cashier', mode: 'insensitive' },
          edId: { not: DESIG_ID },
        },
        {
          edIsDeleted: false,
          edCode: { equals: 'HC', mode: 'insensitive' },
          edId: { not: DESIG_ID },
        },
      ]);
      expect(prisma.employeeDesignation.update).toHaveBeenCalledWith({
        where: { edId: DESIG_ID },
        data: {
          edName: 'Head Cashier',
          edModifiedOn: expect.any(Date),
          edModifiedBy: USER_ID,
          edCode: 'HC',
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ edName: 'Cashier' }),
        modifiedRecord: payload,
      });
    });
  });

  describe('getById', () => {
    it('returns the live designation', async () => {
      prisma.employeeDesignation.findFirst.mockResolvedValue(designationRow({ edIsDefault: true }));

      const payload = await service.getById(DESIG_ID);

      expect(payload).toMatchObject({
        edId: DESIG_ID,
        edSyncDate: null,
        edModifiedOn: STAMP.toISOString(),
      });
      expect(payload).not.toHaveProperty('edIsDefault');
    });

    it('refuses an id with no live designation', async () => {
      const refusal = await refusalOf(service.getById(DESIG_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: EmployeeDesignationMasterErrorCode.NOT_FOUND }] },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses while live employees still hold the designation', async () => {
      prisma.employeeDesignation.findFirst.mockResolvedValue(designationRow());
      prisma.employeeMaster.count.mockResolvedValue(2);

      const refusal = await refusalOf(service.softDelete(DESIG_ID));

      expect(prisma.employeeMaster.count).toHaveBeenCalledWith({
        where: { empDesignationId: DESIG_ID, empIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'edId',
              code: EmployeeDesignationMasterErrorCode.IN_USE,
              message: `Employee designation ${DESIG_ID} is used by 2 employee(s).`,
            },
          ],
        },
      });
      expect(prisma.employeeDesignation.updateMany).not.toHaveBeenCalled();
    });

    it('refuses an id with no live designation', async () => {
      const refusal = await refusalOf(service.softDelete(DESIG_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.employeeDesignation.findFirst.mockResolvedValue(designationRow());
      prisma.employeeDesignation.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(DESIG_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks it deleted and inactive (the default flag is left alone), and audits it as a cancel', async () => {
      prisma.employeeDesignation.findFirst.mockResolvedValue(designationRow({ edIsDefault: true }));

      await expect(service.softDelete(DESIG_ID)).resolves.toEqual({
        edId: DESIG_ID,
        deleted: true,
      });
      expect(prisma.employeeDesignation.updateMany).toHaveBeenCalledWith({
        where: { edId: DESIG_ID, edIsDeleted: false },
        data: {
          edIsDeleted: true,
          edIsActive: false,
          edModifiedOn: expect.any(Date),
          edModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Cashier',
        originalRecord: expect.objectContaining({ edIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ edIsDeleted: true, edIsActive: false }),
      });
    });
  });
});
