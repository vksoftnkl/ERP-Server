import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveEmployeeMasterDto } from './save-employee-master.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e402';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e406';

const dtoOf = (plain: object) =>
  plainToInstance(SaveEmployeeMasterDto, { empName: 'Ravi', empSalaryType: 'MONTHLY', ...plain });
const erroredFields = (plain: object): string[] =>
  validateSync(dtoOf(plain)).map((error) => error.property);

describe('SaveEmployeeMasterDto', () => {
  it('accepts the minimum an employee needs', () => {
    expect(erroredFields({ empCompanyId: COMPANY_ID })).toEqual([]);
  });

  it('trims the name and salary type', () => {
    const dto = dtoOf({ empName: '  Ravi  ', empSalaryType: ' DAILY ' });

    expect(dto.empName).toBe('Ravi');
    expect(dto.empSalaryType).toBe('DAILY');
  });

  it('requires a name and a salary type, refusing blanks', () => {
    expect(erroredFields({ empName: '   ', empSalaryType: '' })).toEqual([
      'empName',
      'empSalaryType',
    ]);
  });

  it('refuses a salary type longer than 10 characters', () => {
    expect(erroredFields({ empSalaryType: 'FORTNIGHTLY' })).toEqual(['empSalaryType']);
  });

  it('reads amounts sent as text', () => {
    const dto = dtoOf({ empSalaryAmount: ' 15000.50 ', empBataAmount: '0', empKmBataAmount: 2 });

    expect(dto.empSalaryAmount).toBe(15000.5);
    expect(dto.empBataAmount).toBe(0);
    expect(dto.empKmBataAmount).toBe(2);
    expect(validateSync(dto)).toEqual([]);
  });

  it('leaves an empty amount out rather than writing zero', () => {
    expect(dtoOf({ empSalaryAmount: '' }).empSalaryAmount).toBeUndefined();
  });

  it('refuses negative amounts', () => {
    expect(
      erroredFields({ empSalaryAmount: -1, empBataAmount: '-5', empCommissionValue: -0.5 }),
    ).toEqual(['empCommissionValue', 'empSalaryAmount', 'empBataAmount']);
  });

  it('keeps a commission as text (Decimal rule), and clears it with null or an empty string', () => {
    expect(dtoOf({ empCommissionValue: ' 2.5 ' }).empCommissionValue).toBe('2.5');
    expect(dtoOf({ empCommissionValue: 2.25 }).empCommissionValue).toBe('2.25');
    expect(dtoOf({ empCommissionValue: '' }).empCommissionValue).toBeNull();
    expect(dtoOf({ empCommissionValue: null }).empCommissionValue).toBeNull();
    expect(erroredFields({ empCommissionValue: null })).toEqual([]);
    expect(erroredFields({ empCommissionValue: '123456789.125' })).toEqual([]);
  });

  it.each(['1.2345', '1234567890', 'abc', '1e3'])(
    'refuses a commission that is not a plain figure of numeric(12,3) (%p)',
    (empCommissionValue) => {
      expect(erroredFields({ empCommissionValue })).toEqual(['empCommissionValue']);
    },
  );

  describe('the fixed lists (HR review step 5)', () => {
    it.each([
      [undefined, undefined],
      [null, 'Working'],
      ['  ', 'Working'],
      ['working', 'Working'],
      ['RESIGNED', 'Resigned'],
    ])('reads status %p as %p', (empStatus, read) => {
      const dto = dtoOf({ empStatus });

      expect(dto.empStatus).toBe(read);
      expect(validateSync(dto)).toEqual([]);
    });

    it('refuses a status other than Working / Resigned with VALIDATION_IS_IN', () => {
      const [error] = validateSync(dtoOf({ empStatus: 'On Leave' }));

      expect(error.property).toBe('empStatus');
      expect(Object.keys(error.constraints ?? {})).toEqual(['isIn']);
    });

    it.each([
      ['permanent', 'Permanent'],
      ['CONTRACT', 'Contract'],
      ['daily wage', 'Daily Wage'],
      ['Daily-Wage', 'Daily Wage'],
      ['apprentice', 'Apprentice'],
      ['', null],
      [null, null],
    ])('reads employment type %p as %p', (empEmploymentType, read) => {
      const dto = dtoOf({ empEmploymentType });

      expect(dto.empEmploymentType).toBe(read);
      expect(validateSync(dto)).toEqual([]);
    });

    it.each([
      ['percent', 'Percent'],
      ['AMOUNT', 'Amount'],
      ['', null],
    ])('reads commission type %p as %p', (empCommissionType, read) => {
      const dto = dtoOf({ empCommissionType });

      expect(dto.empCommissionType).toBe(read);
      expect(validateSync(dto)).toEqual([]);
    });

    it('refuses an employment or commission type off the list', () => {
      expect(erroredFields({ empEmploymentType: 'Casual', empCommissionType: '%' })).toEqual([
        'empEmploymentType',
        'empCommissionType',
      ]);
    });
  });

  describe('the bank IFSC', () => {
    it('is upper-cased and checked as 4 letters, a 0 and 6 letters or digits', () => {
      const dto = dtoOf({ empBankIfsc: ' sbin0001234 ' });

      expect(dto.empBankIfsc).toBe('SBIN0001234');
      expect(validateSync(dto)).toEqual([]);
    });

    it.each(['SBIN001234', 'SBIN1001234', '1BIN0001234', 'SBIN00012345'])(
      'refuses %p with the isIfsc constraint (VALIDATION_IS_IFSC)',
      (empBankIfsc) => {
        const errors = validateSync(dtoOf({ empBankIfsc }));

        expect(errors.map((error) => error.property)).toEqual(['empBankIfsc']);
        expect(Object.keys(errors[0].constraints ?? {})).toContain('isIfsc');
      },
    );

    it('reads a blank IFSC as null (cleared)', () => {
      expect(dtoOf({ empBankIfsc: '  ' }).empBankIfsc).toBeNull();
      expect(erroredFields({ empBankIfsc: '' })).toEqual([]);
    });
  });

  it('accepts the new bank, UAN and emergency contact fields', () => {
    expect(
      erroredFields({
        empUanNo: '100200300400',
        empBankName: 'State Bank of India',
        empBankAccountNo: '00112233445566',
        empEmergencyContactName: 'Lakshmi',
        empEmergencyContactPhone: '9840012345',
      }),
    ).toEqual([]);
  });

  it('accepts no company (the server fills the logged-in one on create)', () => {
    expect(erroredFields({})).toEqual([]);
    expect(erroredFields({ empCompanyId: null })).toEqual([]);
  });

  it('refuses ids that are not uuids', () => {
    expect(
      erroredFields({ empCompanyId: 'company-1', empLoanLedgerId: 'ledger-1', empId: 'x' }),
    ).toEqual(['empId', 'empCompanyId', 'empLoanLedgerId']);
  });

  it('takes a uuid ledger, or null to keep the current one', () => {
    expect(erroredFields({ empLoanLedgerId: LEDGER_ID })).toEqual([]);
    expect(erroredFields({ empLoanLedgerId: null })).toEqual([]);
  });

  it('refuses a malformed email', () => {
    expect(erroredFields({ empEmail: 'ravi-at-example' })).toEqual(['empEmail']);
    expect(erroredFields({ empEmail: 'ravi@example.com' })).toEqual([]);
  });

  it('reads date strings as dates', () => {
    const dto = dtoOf({ empJoinedOn: '2026-04-01' });

    expect(dto.empJoinedOn).toBeInstanceOf(Date);
    expect(validateSync(dto)).toEqual([]);
  });
});
