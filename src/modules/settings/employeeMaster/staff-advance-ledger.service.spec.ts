import { ConflictException, HttpException } from '@nestjs/common';
import { EmployeeMaster, Prisma } from '@prisma/client';
import { LedLedgerType } from '../../accountsModule/accountLedgerMasters/types/account-ledger-master-enum';
import {
  STAFF_ADVANCE_GROUP_NAME,
  StaffAdvanceLedgerService,
  staffAdvanceLedgerNames,
} from './staff-advance-ledger.service';
import { EmployeeMasterErrorCode } from './types/employee-master-error-codes';

const EMP_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e303';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e304';
const NEW_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e305';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e306';
const SUB_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e307';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const employeeRow = (overrides: Partial<EmployeeMaster> = {}): EmployeeMaster => ({
  empId: EMP_ID,
  empCompanyId: COMPANY_ID,
  empBranchId: null,
  empCode: null,
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
  empSalaryAmount: new Prisma.Decimal(0),
  empBataAmount: new Prisma.Decimal(0),
  empKmBataAmount: new Prisma.Decimal(0),
  empPanNo: null,
  empAadharNo: null,
  empPfNo: null,
  empEsiNo: null,
  empLoanLedgerId: null,
  empPhotoUrl: null,
  empPhoto: null,
  empRemarks: null,
  empIsActive: true,
  empIsDeleted: false,
  empSyncDate: null,
  empCreatedOn: STAMP,
  empCreatedBy: null,
  empModifiedOn: STAMP,
  empModifiedBy: null,
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

describe('staffAdvanceLedgerNames', () => {
  it('names the ledger after the employee', () => {
    expect(staffAdvanceLedgerNames('  Ravi Kumar ', null)).toEqual(['Ravi Kumar - Staff Advance']);
  });

  it('offers the code-qualified name second when the employee has a code', () => {
    expect(staffAdvanceLedgerNames('Ravi Kumar', ' E01 ')).toEqual([
      'Ravi Kumar - Staff Advance',
      'Ravi Kumar - Staff Advance (E01)',
    ]);
  });

  it('treats a blank code as no code', () => {
    expect(staffAdvanceLedgerNames('Ravi Kumar', '   ')).toEqual(['Ravi Kumar - Staff Advance']);
  });

  it('cuts a long name so the whole fits the 200-character ledger name', () => {
    const [plain, coded] = staffAdvanceLedgerNames(`${'A'.repeat(195)} ${'B'.repeat(20)}`, 'E01');

    expect(plain).toHaveLength(200);
    expect(plain.endsWith(' - Staff Advance')).toBe(true);
    expect(coded).toHaveLength(200);
    expect(coded.endsWith(' - Staff Advance (E01)')).toBe(true);
  });

  it('drops the space a cut leaves at the end of the name', () => {
    // 184 characters fit before the 16-character suffix; here the 184th is a space.
    const [name] = staffAdvanceLedgerNames(`${'A'.repeat(183)} ${'B'.repeat(30)}`, null);

    expect(name).toBe(`${'A'.repeat(183)} - Staff Advance`);
    expect(name).toHaveLength(199);
    const [cut] = staffAdvanceLedgerNames(`${'A'.repeat(184)} ${'B'.repeat(30)}`, null);
    expect(cut).toBe(`${'A'.repeat(184)} - Staff Advance`);
  });
});

type TxMock = {
  accLedgerMaster: { findFirst: jest.Mock; updateMany: jest.Mock };
  accGroupMaster: { findFirst: jest.Mock };
  employeeMaster: { findFirst: jest.Mock; update: jest.Mock };
  $queryRaw: jest.Mock;
};

describe('StaffAdvanceLedgerService', () => {
  let tx: TxMock;
  let ledgers: {
    createLedgerWithinTx: jest.Mock;
    updateLedgerWithinTx: jest.Mock;
    findLedgerOwners: jest.Mock;
  };
  let service: StaffAdvanceLedgerService;

  beforeEach(() => {
    tx = {
      accLedgerMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accGroupMaster: { findFirst: jest.fn().mockResolvedValue({ accGroupId: GROUP_ID }) },
      employeeMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(async ({ data }: { data: Partial<EmployeeMaster> }) => employeeRow(data)),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    ledgers = {
      createLedgerWithinTx: jest.fn().mockResolvedValue({ ledId: NEW_LEDGER_ID }),
      updateLedgerWithinTx: jest.fn().mockResolvedValue({}),
      findLedgerOwners: jest.fn().mockResolvedValue([]),
    };
    service = new StaffAdvanceLedgerService(ledgers as never);
  });

  const settle = (
    record: EmployeeMaster,
    previous: EmployeeMaster | null,
    requestedId: string | null | undefined,
  ) => service.settle(tx as never, record, previous, requestedId);

  const createdLedger = () =>
    ledgers.createLedgerWithinTx.mock.calls[0][0] as Record<string, unknown>;

  describe('settle — no ledger asked for', () => {
    it('creates "<name> - Staff Advance" for an employee without one, and points the employee at it', async () => {
      const result = await settle(employeeRow(), null, undefined);

      expect(tx.accGroupMaster.findFirst).toHaveBeenCalledWith({
        where: {
          accGroupName: STAFF_ADVANCE_GROUP_NAME,
          accGroupCompanyId: null,
          accGroupIsDeleted: false,
        },
        select: { accGroupId: true },
      });
      expect(createdLedger()).toEqual({
        ledGroupId: GROUP_ID,
        ledName: 'Ravi Kumar - Staff Advance',
        ledCompanyId: COMPANY_ID,
        ledBranchId: null,
        ledLedgerType: LedLedgerType.PARTY,
        ledIsBillByBill: false,
        ledCategory: 'GENERAL',
      });
      expect(ledgers.createLedgerWithinTx.mock.calls[0][1]).toBe(tx);
      expect(tx.employeeMaster.update).toHaveBeenCalledWith({
        where: { empId: EMP_ID },
        data: { empLoanLedgerId: NEW_LEDGER_ID },
      });
      expect(result.empLoanLedgerId).toBe(NEW_LEDGER_ID);
    });

    it('treats a null request the same as an absent one', async () => {
      await settle(employeeRow(), null, null);

      expect(ledgers.createLedgerWithinTx).toHaveBeenCalledTimes(1);
    });

    it('copies the contact details once, trimmed and cut to the ledger widths', async () => {
      await settle(
        employeeRow({
          empMobile1: ' 98400 12345 ',
          empMobile2: '   ',
          empEmail: 'ravi@example.com',
          empAddr1: '12 Main Road',
          empCity: 'Chennai',
          empState: 'Tamil Nadu',
          empPincode: '600001-EXTRA',
          empPanNo: 'ABCDE1234F',
        }),
        null,
        undefined,
      );

      expect(createdLedger()).toMatchObject({
        ledPhone1: '98400 12345',
        ledEmail: 'ravi@example.com',
        ledAddr1: '12 Main Road',
        ledCity: 'Chennai',
        ledStateName: 'Tamil Nadu',
        ledPin: '600001-EXT',
        ledPanNo: 'ABCDE1234F',
      });
      expect(createdLedger()).not.toHaveProperty('ledPhone2');
      expect(createdLedger()).not.toHaveProperty('ledAddr2');
    });

    it('looks for a free name among live ledgers of the company or shared, and the per-company key', async () => {
      await settle(employeeRow(), null, undefined);

      expect(tx.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              ledIsDeleted: false,
              ledName: { equals: 'Ravi Kumar - Staff Advance', mode: 'insensitive' },
              OR: [{ ledCompanyId: COMPANY_ID }, { ledCompanyId: null }],
            },
            { ledCompanyId: COMPANY_ID, ledName: 'Ravi Kumar - Staff Advance' },
          ],
        },
        select: { ledId: true },
      });
    });

    it('falls back to the code-qualified name when the plain one is taken', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce({ ledId: 'taken' });

      await settle(employeeRow({ empCode: 'E01' }), null, undefined);

      expect(createdLedger().ledName).toBe('Ravi Kumar - Staff Advance (E01)');
    });

    it('refuses on empName, suggesting a code, when the only name is taken', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValue({ ledId: 'taken' });

      const refusal = await refusalOf(settle(employeeRow(), null, undefined));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'empName',
              code: EmployeeMasterErrorCode.LEDGER_NAME_DUPLICATE,
              message:
                'Ledger "Ravi Kumar - Staff Advance" already exists. Give the employee a code, or pick an existing ledger in empLoanLedgerId.',
            },
          ],
        },
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('refuses with the code-qualified name when both names are taken', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValue({ ledId: 'taken' });

      const refusal = await refusalOf(settle(employeeRow({ empCode: 'E01' }), null, undefined));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              message:
                'Ledger "Ravi Kumar - Staff Advance (E01)" already exists. Pick an existing ledger in empLoanLedgerId.',
            },
          ],
        },
      });
    });

    it('refuses when the shared staff advance group is missing', async () => {
      tx.accGroupMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(settle(employeeRow(), null, undefined));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'empLoanLedgerId', code: EmployeeMasterErrorCode.LEDGER_GROUP_MISSING },
          ],
        },
      });
    });

    it('keeps the current ledger while it is live and visible to the company, writing nothing', async () => {
      const record = employeeRow({ empLoanLedgerId: LEDGER_ID });
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce({ ledId: LEDGER_ID });

      await expect(settle(record, null, undefined)).resolves.toBe(record);

      expect(tx.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: {
          ledId: LEDGER_ID,
          ledIsDeleted: false,
          OR: [{ ledCompanyId: null }, { ledCompanyId: COMPANY_ID }],
        },
        select: { ledId: true },
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
      expect(tx.employeeMaster.update).not.toHaveBeenCalled();
    });

    it('creates a new ledger when the current one is gone or belongs elsewhere', async () => {
      // The lookup finds nothing: deleted, or another company's.
      const result = await settle(employeeRow({ empLoanLedgerId: LEDGER_ID }), null, undefined);

      expect(ledgers.createLedgerWithinTx).toHaveBeenCalledTimes(1);
      expect(result.empLoanLedgerId).toBe(NEW_LEDGER_ID);
    });
  });

  describe('settle — a ledger handed in (empLoanLedgerId)', () => {
    const pickable = (overrides: object = {}) => ({
      ledName: 'Ravi Advance (Tally)',
      ledGroupId: GROUP_ID,
      ledCompanyId: COMPANY_ID,
      ...overrides,
    });

    it('refuses a ledger that is not live', async () => {
      const refusal = await refusalOf(settle(employeeRow(), null, LEDGER_ID));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Invalid staff advance ledger',
          errors: [{ field: 'empLoanLedgerId', code: EmployeeMasterErrorCode.LEDGER_NOT_FOUND }],
        },
      });
    });

    it('takes a ledger straight in the staff advance group without walking the tree', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(pickable());

      const result = await settle(employeeRow(), null, LEDGER_ID);

      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(result.empLoanLedgerId).toBe(LEDGER_ID);
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('takes a ledger in a sub-group of the staff advance group', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(pickable({ ledGroupId: SUB_GROUP_ID }));
      tx.$queryRaw.mockResolvedValueOnce([{ found: true }]);

      await expect(settle(employeeRow(), null, LEDGER_ID)).resolves.toMatchObject({
        empLoanLedgerId: LEDGER_ID,
      });
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([SUB_GROUP_ID, 24, GROUP_ID]);
    });

    it('refuses a ledger outside the staff advance group', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(pickable({ ledGroupId: SUB_GROUP_ID }));
      tx.$queryRaw.mockResolvedValueOnce([{ found: false }]);

      const refusal = await refusalOf(settle(employeeRow(), null, LEDGER_ID));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: EmployeeMasterErrorCode.LEDGER_WRONG_GROUP }] },
      });
    });

    it("refuses another company's ledger", async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(
        pickable({ ledCompanyId: OTHER_COMPANY_ID }),
      );

      const refusal = await refusalOf(settle(employeeRow(), null, LEDGER_ID));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: EmployeeMasterErrorCode.LEDGER_OTHER_COMPANY }] },
      });
    });

    it('takes a shared ledger (no company)', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(pickable({ ledCompanyId: null }));

      await expect(settle(employeeRow(), null, LEDGER_ID)).resolves.toMatchObject({
        empLoanLedgerId: LEDGER_ID,
      });
    });

    it('refuses a ledger another live employee already holds', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(pickable());
      tx.employeeMaster.findFirst.mockResolvedValue({ empName: 'Suresh' });

      const refusal = await refusalOf(settle(employeeRow(), null, LEDGER_ID));

      expect(tx.employeeMaster.findFirst).toHaveBeenCalledWith({
        where: { empLoanLedgerId: LEDGER_ID, empIsDeleted: false, NOT: { empId: EMP_ID } },
        select: { empName: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'empLoanLedgerId',
              code: EmployeeMasterErrorCode.LEDGER_TAKEN,
              message:
                'Ledger "Ravi Advance (Tally)" is already the staff advance ledger of employee "Suresh"',
            },
          ],
        },
      });
    });

    it('writes nothing when the employee already points at the ledger handed in', async () => {
      const record = employeeRow({ empLoanLedgerId: LEDGER_ID });
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce(pickable());

      await expect(settle(record, null, LEDGER_ID)).resolves.toBe(record);
      expect(tx.employeeMaster.update).not.toHaveBeenCalled();
    });
  });

  describe('settle — the generated name follows a rename', () => {
    const previous = employeeRow({ empLoanLedgerId: LEDGER_ID });
    const renamed = employeeRow({ empLoanLedgerId: LEDGER_ID, empName: 'Ravi K' });

    /** settle's own visibility lookup, then followRename's ledger read, then the free-name check. */
    const ledgerReads = (followed: object | null) =>
      tx.accLedgerMaster.findFirst
        .mockResolvedValueOnce({ ledId: LEDGER_ID })
        .mockResolvedValueOnce(followed)
        .mockResolvedValueOnce(null);

    it('renames a ledger that still carries the old generated name', async () => {
      ledgerReads({ ledName: 'ravi kumar - staff advance', ledGroupId: GROUP_ID });

      await expect(settle(renamed, previous, undefined)).resolves.toBe(renamed);

      expect(ledgers.updateLedgerWithinTx).toHaveBeenCalledWith(
        { ledId: LEDGER_ID, ledGroupId: GROUP_ID, ledName: 'Ravi K - Staff Advance' },
        tx,
      );
      // The free-name check leaves the ledger itself out.
      expect(tx.accLedgerMaster.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ledId: { not: LEDGER_ID } }) as object,
        }),
      );
    });

    it('leaves a ledger renamed by hand alone', async () => {
      ledgerReads({ ledName: 'Ravi - Advances', ledGroupId: GROUP_ID });

      await settle(renamed, previous, undefined);

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('does nothing when the name did not change', async () => {
      ledgerReads({ ledName: 'Ravi Kumar - Staff Advance', ledGroupId: GROUP_ID });

      await settle(employeeRow({ empLoanLedgerId: LEDGER_ID }), previous, undefined);

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('does nothing for a ledger that has gone', async () => {
      ledgerReads(null);

      await settle(renamed, previous, undefined);

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('turns a ledger-save name clash into a 409 on empName', async () => {
      ledgerReads({ ledName: 'Ravi Kumar - Staff Advance', ledGroupId: GROUP_ID });
      ledgers.updateLedgerWithinTx.mockRejectedValue(new ConflictException('taken'));

      const refusal = await refusalOf(settle(renamed, previous, undefined));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'empName', code: EmployeeMasterErrorCode.LEDGER_NAME_DUPLICATE }],
        },
      });
    });

    it('rethrows any other ledger-save failure untouched', async () => {
      ledgerReads({ ledName: 'Ravi Kumar - Staff Advance', ledGroupId: GROUP_ID });
      const failure = new Error('connection reset');
      ledgers.updateLedgerWithinTx.mockRejectedValue(failure);

      await expect(settle(renamed, previous, undefined)).rejects.toBe(failure);
    });

    it('does not follow a rename when the employee moves to another ledger', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValueOnce({
        ledName: 'Ravi Advance (Tally)',
        ledGroupId: GROUP_ID,
        ledCompanyId: COMPANY_ID,
      });

      await settle(renamed, previous, NEW_LEDGER_ID);

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
      expect(tx.employeeMaster.update).toHaveBeenCalledWith({
        where: { empId: EMP_ID },
        data: { empLoanLedgerId: NEW_LEDGER_ID },
      });
    });
  });

  describe('liveLedgerOf', () => {
    it('answers null without a query for an employee with no ledger', async () => {
      await expect(service.liveLedgerOf(tx as never, employeeRow())).resolves.toBeNull();
      expect(tx.accLedgerMaster.findFirst).not.toHaveBeenCalled();
    });

    it('reads the live ledger the employee points at', async () => {
      tx.accLedgerMaster.findFirst.mockResolvedValue({ ledId: LEDGER_ID, ledName: 'X' });

      await expect(
        service.liveLedgerOf(tx as never, employeeRow({ empLoanLedgerId: LEDGER_ID })),
      ).resolves.toEqual({ ledId: LEDGER_ID, ledName: 'X' });
      expect(tx.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: { ledId: LEDGER_ID, ledIsDeleted: false },
        select: { ledId: true, ledName: true },
      });
    });
  });

  describe('balances / ensureSettled', () => {
    const ledger = { ledId: LEDGER_ID, ledName: 'Ravi Kumar - Staff Advance' };

    it('reads the balance per company for the ledger and drops the zero ones', async () => {
      tx.$queryRaw.mockResolvedValue([
        { company_id: COMPANY_ID, balance: '1500.00' },
        { company_id: OTHER_COMPANY_ID, balance: '0.00' },
      ]);

      const rows = await service.balances(tx as never, LEDGER_ID);

      expect(rows).toEqual([{ companyId: COMPANY_ID, balance: new Prisma.Decimal('1500') }]);
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([LEDGER_ID, LEDGER_ID]);
    });

    it('lets a zero-balance ledger go', async () => {
      tx.$queryRaw.mockResolvedValue([{ company_id: COMPANY_ID, balance: '0' }]);

      await expect(
        service.ensureSettled(tx as never, employeeRow(), ledger),
      ).resolves.toBeUndefined();
    });

    it('refuses with 409 EMP_LEDGER_HAS_BALANCE, showing each balance as Dr or Cr', async () => {
      tx.$queryRaw.mockResolvedValue([
        { company_id: COMPANY_ID, balance: '1500' },
        { company_id: OTHER_COMPANY_ID, balance: '-200.5' },
      ]);

      const refusal = await refusalOf(service.ensureSettled(tx as never, employeeRow(), ledger));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Staff advance ledger has a balance',
          errors: [
            {
              field: 'empId',
              code: 'EMP_LEDGER_HAS_BALANCE',
              message:
                'Employee "Ravi Kumar" cannot be deleted while the staff advance ledger "Ravi Kumar - Staff Advance" has a balance (1500.00 Dr, 200.50 Cr). Settle it first.',
            },
          ],
        },
      });
    });
  });

  describe('retire', () => {
    const ledger = { ledId: LEDGER_ID, ledName: 'Ravi Kumar - Staff Advance' };

    it('keeps a ledger something else still owns', async () => {
      ledgers.findLedgerOwners.mockResolvedValue([{ kind: 'CUSTOMER' }]);

      await expect(service.retire(tx as never, ledger, 'u1', STAMP)).resolves.toBe(false);
      expect(ledgers.findLedgerOwners).toHaveBeenCalledWith(tx, LEDGER_ID, ledger.ledName);
      expect(tx.accLedgerMaster.updateMany).not.toHaveBeenCalled();
    });

    it('soft-deletes an ownerless ledger', async () => {
      await expect(service.retire(tx as never, ledger, 'u1', STAMP)).resolves.toBe(true);
      expect(tx.accLedgerMaster.updateMany).toHaveBeenCalledWith({
        where: { ledId: LEDGER_ID, ledIsDeleted: false },
        data: { ledIsDeleted: true, ledIsActive: false, ledModifiedOn: STAMP, ledModifiedBy: 'u1' },
      });
    });

    it('answers false when the ledger was already gone', async () => {
      tx.accLedgerMaster.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.retire(tx as never, ledger, 'u1', STAMP)).resolves.toBe(false);
    });
  });
});
