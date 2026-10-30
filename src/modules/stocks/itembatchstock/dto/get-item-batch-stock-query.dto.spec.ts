import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GetItemBatchStockQueryDto } from './get-item-batch-stock-query.dto';

const ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const SCOPE = {
  ibs_acc_year: '2026-2027',
  ibs_company_id: ID,
  ibs_branch_id: ID,
  ibs_godown_id: ID,
  ibs_item_id: ID,
  ibs_unit_id: ID,
};

const parse = (plain: object) => plainToInstance(GetItemBatchStockQueryDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('GetItemBatchStockQueryDto', () => {
  it('accepts the scope alone', () => {
    expect(erroredFields(SCOPE)).toEqual([]);
  });

  it('requires every part of the scope', () => {
    expect(erroredFields({})).toEqual([
      'ibs_acc_year',
      'ibs_company_id',
      'ibs_branch_id',
      'ibs_godown_id',
      'ibs_item_id',
      'ibs_unit_id',
    ]);
  });

  it('trims the scope, and drops a blank optional filter', () => {
    const dto = parse({
      ...SCOPE,
      ibs_acc_year: ' 2026-2027 ',
      ibs_item_id: ` ${ID} `,
      ibs_batch_id: '  ',
      ibs_stock_bucket: '',
      search: null,
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ ibs_acc_year: '2026-2027', ibs_item_id: ID });
    expect(dto.ibs_batch_id).toBeUndefined();
    expect(dto.ibs_stock_bucket).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it.each([
    ['1', true],
    ['yes', true],
    [' ON ', true],
    ['true', true],
    ['0', false],
    ['no', false],
    ['off', false],
    ['FALSE', false],
  ])('reads %p as %p for the flags', (text, flag) => {
    const dto = parse({ ...SCOPE, ibs_is_active: text, ibs_is_deleted: text });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.ibs_is_active).toBe(flag);
    expect(dto.ibs_is_deleted).toBe(flag);
  });

  it('keeps a real boolean, and refuses a value of the wrong type', () => {
    expect(parse({ ...SCOPE, ibs_is_active: false }).ibs_is_active).toBe(false);
    expect(
      erroredFields({ ...SCOPE, ibs_acc_year: 2026, ibs_stock_bucket: 7, ibs_is_deleted: 2 }),
    ).toEqual(['ibs_acc_year', 'ibs_stock_bucket', 'ibs_is_deleted']);
  });

  it.each([
    ['an acc year over 9 characters', { ibs_acc_year: '2026-20277' }, 'ibs_acc_year'],
    ['a scope id that is not a uuid', { ibs_godown_id: 'main' }, 'ibs_godown_id'],
    ['a batch id that is not a uuid', { ibs_batch_id: 'B-001' }, 'ibs_batch_id'],
    ['a bucket over 20 characters', { ibs_stock_bucket: 'b'.repeat(21) }, 'ibs_stock_bucket'],
    ['a flag that is not a yes or a no', { ibs_is_active: 'maybe' }, 'ibs_is_active'],
    ['a search over 100 characters', { search: 's'.repeat(101) }, 'search'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(erroredFields({ ...SCOPE, ...overrides })).toEqual([field]);
  });
});
