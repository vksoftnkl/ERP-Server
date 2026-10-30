import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ImportOpeningStockVoucherDto } from './import-opening-stock-voucher.dto';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const BODY = { svhId: SVH_ID, accYear: '2026-2027', companyId: COMPANY_ID, branchId: BRANCH_ID };

const parse = (plain: object) => plainToInstance(ImportOpeningStockVoucherDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('ImportOpeningStockVoucherDto', () => {
  it('accepts the form fields that travel beside the CSV part', () => {
    expect(erroredFields(BODY)).toEqual([]);
    expect(parse({ ...BODY, accYear: ' 2026-2027 ' }).accYear).toBe('2026-2027');
  });

  // An import replaces a draft's lines; it never creates the document.
  it('requires the draft it replaces, and its scope', () => {
    expect(erroredFields({})).toEqual(['svhId', 'accYear', 'companyId', 'branchId']);
  });

  it.each([
    ['a year that is not YYYY-YYYY', { accYear: '2026' }, 'accYear'],
    ['a draft id that is not a uuid', { svhId: 'draft-1' }, 'svhId'],
    ['a user that is not a uuid', { userId: 'clerk' }, 'userId'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(erroredFields({ ...BODY, ...overrides })).toEqual([field]);
  });
});
