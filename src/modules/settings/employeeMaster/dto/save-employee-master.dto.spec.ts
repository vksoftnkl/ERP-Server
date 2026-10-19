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

  it('reads a commission sent as text, and clears it with null or an empty string', () => {
    expect(dtoOf({ empCommissionValue: '2.5' }).empCommissionValue).toBe(2.5);
    expect(dtoOf({ empCommissionValue: '' }).empCommissionValue).toBeNull();
    expect(dtoOf({ empCommissionValue: null }).empCommissionValue).toBeNull();
    expect(erroredFields({ empCommissionValue: null })).toEqual([]);
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
