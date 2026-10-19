import { BadRequestException, HttpException } from '@nestjs/common';
import { EmployeeMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { EmployeeMasterService } from './employee-master.service';
import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import { EmployeeMasterErrorCode } from './types/employee-master-error-codes';

const EMP_ID = '019c6f6c-be87-7a11-8905-36092c46e401';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e402';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e403';
const DEPT_ID = '019c6f6c-be87-7a11-8905-36092c46e404';
const DESIG_ID = '019c6f6c-be87-7a11-8905-36092c46e405';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e406';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e407';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const employeeRow = (overrides: Partial<EmployeeMaster> = {}): EmployeeMaster => ({
  empId: EMP_ID,
  empCompanyId: COMPANY_ID,
  empBranchId: null,
  empCode: 'E01',
  empName: 'Ravi Kumar',
  empAlias: null,
  empMobile1: null,
  empMobile2: null,
  empEmail: null,
  empAddr1: null,
  empAddr2: null,
  empAddr3: null,
  empCity: null,
  empDistrict: null,
  empState: null,
  empPincode: null,
  empGender: null,
  empMaritalStatus: null,
  empBloodGroup: null,
  empDob: null,
  empDepartmentId: null,
  empDesignationId: null,
  empEmploymentType: null,
  empStatus: null,
  empJoinedOn: null,
  empProbationEndOn: null,
  empConfirmationOn: null,
  empLeftOn: null,
  empShiftId: null,
  empAttConstraintId: null,
  empHolidayGroupId: null,
  empOvertimeAllowed: false,
  empHasCommission: false,
  empCommissionType: null,
  empCommissionValue: null,
  empSalaryType: 'MONTHLY',
  empSalaryAmount: new Prisma.Decimal('15000.50'),
  empBataAmount: new Prisma.Decimal(0),
  empKmBataAmount: new Prisma.Decimal('2.25'),
  empPanNo: null,
  empAadharNo: null,
  empPfNo: null,
  empEsiNo: null,
  empLoanLedgerId: LEDGER_ID,
  empPhotoUrl: null,
  empPhoto: null,
  empRemarks: null,
  empIsActive: true,
  empIsDeleted: false,
  empSyncDate: null,
  empCreatedOn: STAMP,
  empCreatedBy: USER_ID,
  empModifiedOn: STAMP,
  empModifiedBy: USER_ID,
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

type PrismaMock = {
  employeeMaster: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  company: { findFirst: jest.Mock };
  branchMaster: { findFirst: jest.Mock };
  employeeDepartment: { findFirst: jest.Mock };
  employeeDesignation: { findFirst: jest.Mock };
  accLedgerMaster: { findFirst: jest.Mock; findUniqueOrThrow: jest.Mock };
  $transaction: jest.Mock;
};

const baseDto = (overrides: Partial<SaveEmployeeMasterDto> = {}): SaveEmployeeMasterDto => ({
  empCompanyId: COMPANY_ID,
  empName: 'Ravi Kumar',
  empSalaryType: 'MONTHLY',
  ...overrides,
});

describe('EmployeeMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let ledgers: {
    settle: jest.Mock;
    liveLedgerOf: jest.Mock;
    ensureSettled: jest.Mock;
    retire: jest.Mock;
  };
  let service: EmployeeMasterService;

  beforeEach(() => {
    prisma = {
      employeeMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: Partial<EmployeeMaster> }) =>
          employeeRow({ ...data, empLoanLedgerId: null }),
        ),
        update: jest.fn(async ({ data }: { data: Partial<EmployeeMaster> }) => employeeRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      company: { findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brName: 'Main' }) },
      employeeDepartment: { findFirst: jest.fn().mockResolvedValue({ edptId: DEPT_ID }) },
      employeeDesignation: { findFirst: jest.fn().mockResolvedValue({ edId: DESIG_ID }) },
      accLedgerMaster: {
        findFirst: jest.fn().mockResolvedValue({ ledName: 'Ravi Kumar - Staff Advance' }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ledId: LEDGER_ID, ledName: 'Ravi Kumar - Staff Advance' }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    ledgers = {
      // The ledger service hands back the row pointing at its ledger.
      settle: jest.fn(async (_tx: unknown, record: EmployeeMaster) => ({
        ...record,
        empLoanLedgerId: LEDGER_ID,
      })),
      liveLedgerOf: jest.fn().mockResolvedValue(null),
      ensureSettled: jest.fn().mockResolvedValue(undefined),
      retire: jest.fn().mockResolvedValue(true),
    };
    service = new EmployeeMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
      ledgers as never,
    );
  });

  const createdData = () =>
    (prisma.employeeMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create (no empId)', () => {
    it('writes the required fields, stamps the creator and settles the staff advance ledger', async () => {
      const payload = await service.save(
        baseDto({ empName: ' Ravi Kumar ', empSalaryType: ' MONTHLY ', empCode: 'E01' }),
      );

      expect(createdData()).toEqual({
        empCompanyId: COMPANY_ID,
        empName: 'Ravi Kumar',
        empSalaryType: 'MONTHLY',
        empCreatedOn: expect.any(Date),
        empCreatedBy: USER_ID,
        empCode: 'E01',
      });
      expect(ledgers.settle).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ empId: EMP_ID, empLoanLedgerId: null }),
        null,
        undefined,
      );
      expect(payload.empLoanLedgerId).toBe(LEDGER_ID);
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'emp_master',
        screenName: 'Employee Master',
        pk: EMP_ID,
        displayName: 'Ravi Kumar',
        originalRecord: null,
        modifiedRecord: payload,
      });
    });

    it('hands the requested ledger to the ledger service instead of writing it on the row', async () => {
      await service.save(baseDto({ empLoanLedgerId: LEDGER_ID }));

      expect(createdData()).not.toHaveProperty('empLoanLedgerId');
      expect(ledgers.settle).toHaveBeenCalledWith(prisma, expect.anything(), null, LEDGER_ID);
    });

    it.each([
      ['empName', { empName: '  ' }, EmployeeMasterErrorCode.NAME_REQUIRED],
      ['empSalaryType', { empSalaryType: '' }, EmployeeMasterErrorCode.SALARY_TYPE_REQUIRED],
    ])('refuses a blank %s', async (field, overrides, code) => {
      const refusal = await refusalOf(service.save(baseDto(overrides)));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field, code, message: `${field} must not be empty` }] },
      });
      expect(prisma.employeeMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a company that is not active', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(baseDto()));

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: false },
        select: { compId: true },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'empCompanyId', code: EmployeeMasterErrorCode.COMPANY_NOT_FOUND }],
        },
      });
    });

    it('refuses a department that is not live', async () => {
      prisma.employeeDepartment.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(baseDto({ empDepartmentId: DEPT_ID })));

      expect(prisma.employeeDepartment.findFirst).toHaveBeenCalledWith({
        where: { edptId: DEPT_ID, edptIsDeleted: false },
        select: { edptId: true },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'empDepartmentId', code: EmployeeMasterErrorCode.DEPARTMENT_NOT_FOUND },
          ],
        },
      });
    });

    it('refuses a designation that is not live', async () => {
      prisma.employeeDesignation.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(baseDto({ empDesignationId: DESIG_ID })));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'empDesignationId', code: EmployeeMasterErrorCode.DESIGNATION_NOT_FOUND },
          ],
        },
      });
    });

    it('checks no company, department or designation that was not sent', async () => {
      await service.save(baseDto({ empCompanyId: null, empDepartmentId: null }));

      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.employeeDepartment.findFirst).not.toHaveBeenCalled();
      expect(prisma.employeeDesignation.findFirst).not.toHaveBeenCalled();
    });

    it('decodes a base64 photo, stripping a data: header, and answers it as base64', async () => {
      const bytes = Buffer.from('photo-bytes');

      const payload = await service.save(
        baseDto({ empPhoto: `data:image/png;base64,${bytes.toString('base64')}` }),
      );

      const stored = createdData().empPhoto as Uint8Array;
      expect(Buffer.from(stored).toString()).toBe('photo-bytes');
      expect(payload.empPhoto).toBe(bytes.toString('base64'));
    });

    it('stores a blank photo as null', async () => {
      await service.save(baseDto({ empPhoto: '   ' }));

      expect(createdData().empPhoto).toBeNull();
    });

    it.each(['not base64!', 'abc', 'data:image/png;base64'])(
      'refuses a photo that is not base64 (%s)',
      async (empPhoto) => {
        const refusal = await refusalOf(service.save(baseDto({ empPhoto })));

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'empPhoto', code: EmployeeMasterErrorCode.PHOTO_INVALID }] },
        });
        expect(prisma.employeeMaster.create).not.toHaveBeenCalled();
      },
    );

    it('answers money columns as numbers', async () => {
      const payload = await service.save(baseDto());

      expect(payload).toMatchObject({
        empSalaryAmount: 15000.5,
        empBataAmount: 0,
        empKmBataAmount: 2.25,
        empCommissionValue: null,
      });
    });
  });

  describe('save — update (empId present)', () => {
    it('refuses an id that names no live employee', async () => {
      const refusal = await refusalOf(service.save(baseDto({ empId: EMP_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'empId', code: EmployeeMasterErrorCode.NOT_FOUND }] },
      });
      expect(prisma.employeeMaster.update).not.toHaveBeenCalled();
    });

    it('writes the row, then settles the ledger against the row before the update', async () => {
      const existing = employeeRow();
      prisma.employeeMaster.findFirst.mockResolvedValue(existing);

      const payload = await service.save(
        baseDto({ empId: EMP_ID, empName: 'Ravi K', empMobile1: '98400 12345' }),
      );

      expect(prisma.employeeMaster.update).toHaveBeenCalledWith({
        where: { empId: EMP_ID },
        data: {
          empCompanyId: COMPANY_ID,
          empName: 'Ravi K',
          empSalaryType: 'MONTHLY',
          empModifiedOn: expect.any(Date),
          empModifiedBy: USER_ID,
          empMobile1: '98400 12345',
        },
      });
      expect(ledgers.settle).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ empName: 'Ravi K' }),
        existing,
        undefined,
      );
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: EMP_ID,
        originalRecord: expect.objectContaining({ empName: 'Ravi Kumar' }),
        modifiedRecord: payload,
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live employee', async () => {
      const refusal = await refusalOf(service.getById(EMP_ID));

      expect(refusal.status).toBe(404);
    });

    it('adds the company, branch, department, designation and ledger names', async () => {
      prisma.employeeMaster.findFirst.mockResolvedValue(
        employeeRow({ empBranchId: BRANCH_ID, empDepartmentId: DEPT_ID, empDesignationId: DESIG_ID }),
      );
      prisma.company.findFirst.mockResolvedValue({ compName: 'Zeta Traders' });
      prisma.employeeDepartment.findFirst.mockResolvedValue({ edptName: 'Accounts' });
      prisma.employeeDesignation.findFirst.mockResolvedValue({ edName: 'Cashier' });

      await expect(service.getById(EMP_ID)).resolves.toMatchObject({
        empId: EMP_ID,
        empCompanyName: 'Zeta Traders',
        empBranchName: 'Main',
        empDepartmentName: 'Accounts',
        empDesignationName: 'Cashier',
        empLoanLedgerName: 'Ravi Kumar - Staff Advance',
      });
      expect(prisma.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: { ledId: LEDGER_ID },
        select: { ledName: true },
      });
    });

    it('looks up nothing for links the employee does not have', async () => {
      prisma.employeeMaster.findFirst.mockResolvedValue(
        employeeRow({ empCompanyId: null, empLoanLedgerId: null }),
      );

      await expect(service.getById(EMP_ID)).resolves.toMatchObject({
        empCompanyName: null,
        empBranchName: null,
        empDepartmentName: null,
        empDesignationName: null,
        empLoanLedgerName: null,
      });
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.accLedgerMaster.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    const ledger = { ledId: LEDGER_ID, ledName: 'Ravi Kumar - Staff Advance' };

    it('refuses an id with no live employee', async () => {
      const refusal = await refusalOf(service.softDelete(EMP_ID));

      expect(refusal.status).toBe(404);
      expect(ledgers.liveLedgerOf).not.toHaveBeenCalled();
    });

    it('refuses, deleting nothing, while the staff advance ledger holds money', async () => {
      prisma.employeeMaster.findFirst.mockResolvedValue(employeeRow());
      ledgers.liveLedgerOf.mockResolvedValue(ledger);
      ledgers.ensureSettled.mockRejectedValue(new BadRequestException('has a balance'));

      await expect(service.softDelete(EMP_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.employeeMaster.updateMany).not.toHaveBeenCalled();
      expect(ledgers.retire).not.toHaveBeenCalled();
    });

    it('deletes the employee and retires its settled ledger, naming it in the audit', async () => {
      const existing = employeeRow();
      prisma.employeeMaster.findFirst.mockResolvedValue(existing);
      ledgers.liveLedgerOf.mockResolvedValue(ledger);

      await expect(service.softDelete(EMP_ID)).resolves.toEqual({ empId: EMP_ID, deleted: true });

      expect(ledgers.ensureSettled).toHaveBeenCalledWith(prisma, existing, ledger);
      expect(prisma.employeeMaster.updateMany).toHaveBeenCalledWith({
        where: { empId: EMP_ID, empIsDeleted: false },
        data: {
          empIsDeleted: true,
          empIsActive: false,
          empModifiedOn: expect.any(Date),
          empModifiedBy: USER_ID,
        },
      });
      const { data } = prisma.employeeMaster.updateMany.mock.calls[0][0] as {
        data: { empModifiedOn: Date };
      };
      expect(ledgers.retire).toHaveBeenCalledWith(prisma, ledger, USER_ID, data.empModifiedOn);
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Ravi Kumar',
        notes: 'Employee soft deleted with staff advance ledger "Ravi Kumar - Staff Advance"',
        modifiedRecord: expect.objectContaining({ empIsDeleted: true, empIsActive: false }),
      });
    });

    it('keeps the plain note when the ledger stays because something else owns it', async () => {
      prisma.employeeMaster.findFirst.mockResolvedValue(employeeRow());
      ledgers.liveLedgerOf.mockResolvedValue(ledger);
      ledgers.retire.mockResolvedValue(false);

      await service.softDelete(EMP_ID);

      expect(auditEntry().notes).toBe('Employee soft deleted');
    });

    it('deletes an employee with no live ledger without touching ledgers', async () => {
      prisma.employeeMaster.findFirst.mockResolvedValue(employeeRow({ empLoanLedgerId: null }));

      await service.softDelete(EMP_ID);

      expect(ledgers.ensureSettled).not.toHaveBeenCalled();
      expect(ledgers.retire).not.toHaveBeenCalled();
      expect(auditEntry().notes).toBe('Employee soft deleted');
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.employeeMaster.findFirst.mockResolvedValue(employeeRow());
      prisma.employeeMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(EMP_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });
  });

  describe('backfillStaffAdvanceLedgers', () => {
    const SECOND_ID = '019c6f6c-be87-7a11-8905-36092c46e408';

    it('walks only live employees without a ledger, oldest first', async () => {
      await expect(service.backfillStaffAdvanceLedgers()).resolves.toEqual({
        walked: 0,
        created: [],
        failed: [],
      });
      expect(prisma.employeeMaster.findMany).toHaveBeenCalledWith({
        where: { empIsDeleted: false, empLoanLedgerId: null },
        select: { empId: true, empName: true },
        orderBy: { empCreatedOn: 'asc' },
      });
    });

    it('gives each employee a ledger through settle, auditing the change', async () => {
      prisma.employeeMaster.findMany.mockResolvedValue([{ empId: EMP_ID, empName: 'Ravi Kumar' }]);
      prisma.employeeMaster.findFirst.mockResolvedValue(employeeRow({ empLoanLedgerId: null }));

      const report = await service.backfillStaffAdvanceLedgers();

      expect(report).toEqual({
        walked: 1,
        created: [
          {
            empId: EMP_ID,
            empName: 'Ravi Kumar',
            ledId: LEDGER_ID,
            ledName: 'Ravi Kumar - Staff Advance',
          },
        ],
        failed: [],
      });
      expect(ledgers.settle).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ empId: EMP_ID }),
        null,
        null,
      );
      expect(prisma.employeeMaster.update).toHaveBeenCalledWith({
        where: { empId: EMP_ID },
        data: { empModifiedOn: expect.any(Date), empModifiedBy: USER_ID },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        notes: 'Staff advance ledger "Ravi Kumar - Staff Advance" created (backfill, notes 95)',
      });
    });

    it('reports a failure with its refusal message and carries on with the rest', async () => {
      prisma.employeeMaster.findMany.mockResolvedValue([
        { empId: EMP_ID, empName: 'Ravi Kumar' },
        { empId: SECOND_ID, empName: 'Suresh' },
        { empId: 'gone', empName: 'Gone' },
      ]);
      prisma.employeeMaster.findFirst.mockImplementation(
        async ({ where }: { where: { empId: string } }) =>
          where.empId === 'gone' ? null : employeeRow({ empId: where.empId, empLoanLedgerId: null }),
      );
      ledgers.settle.mockImplementationOnce(() => {
        throw new BadRequestException({
          success: false,
          message: 'Staff advance ledger name already exists',
          errors: [{ field: 'empName', message: 'Ledger "Ravi Kumar - Staff Advance" already exists.' }],
        });
      });

      const report = await service.backfillStaffAdvanceLedgers();

      expect(report.walked).toBe(3);
      expect(report.created.map((row) => row.empId)).toEqual([SECOND_ID]);
      expect(report.failed).toEqual([
        {
          empId: EMP_ID,
          empName: 'Ravi Kumar',
          message: 'Ledger "Ravi Kumar - Staff Advance" already exists.',
        },
        { empId: 'gone', empName: 'Gone', message: 'No active employee found with id gone' },
      ]);
    });

    it('reports a plain error by its message', async () => {
      prisma.employeeMaster.findMany.mockResolvedValue([{ empId: EMP_ID, empName: 'Ravi Kumar' }]);
      prisma.employeeMaster.findFirst.mockResolvedValue(employeeRow());
      ledgers.settle.mockRejectedValueOnce(new Error('connection reset'));

      await expect(service.backfillStaffAdvanceLedgers()).resolves.toMatchObject({
        failed: [{ empId: EMP_ID, message: 'connection reset' }],
      });
    });
  });
});
