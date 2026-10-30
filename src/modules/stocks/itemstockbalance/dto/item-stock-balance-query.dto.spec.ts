import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GetBulkItemStockListQueryDto } from './get-bulk-item-stock-list-query.dto';
import { GetItemBatchStockOptionsQueryDto } from './get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './get-item-stock-balance-query.dto';

const ID = '019c6f6c-be87-7a11-8905-36092c46b101';

const errorsOf = <T extends object>(cls: new () => T, plain: object): string[] =>
  validateSync(plainToInstance(cls, plain)).map((error) => error.property);

// ── GET /get ────────────────────────────────────────────────────────────────
describe('GetItemStockBalanceQueryDto', () => {
  const SCOPE = {
    isb_acc_year: '2026-2027',
    isb_company_id: ID,
    isb_branch_id: ID,
    isb_godown_id: ID,
    isb_item_id: ID,
    isb_unit_id: ID,
  };

  it('accepts the scope alone, and requires all of it', () => {
    expect(errorsOf(GetItemStockBalanceQueryDto, SCOPE)).toEqual([]);
    expect(errorsOf(GetItemStockBalanceQueryDto, {})).toEqual(Object.keys(SCOPE));
  });

  it('trims the scope and drops a blank bucket', () => {
    const dto = plainToInstance(GetItemStockBalanceQueryDto, {
      ...SCOPE,
      isb_acc_year: ' 2026-2027 ',
      isb_unit_id: ` ${ID} `,
      isb_stock_bucket: '   ',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ isb_acc_year: '2026-2027', isb_unit_id: ID });
    expect(dto.isb_stock_bucket).toBeUndefined();
  });

  it.each([
    ['an acc year over 9 characters', { isb_acc_year: '2026-20277' }, 'isb_acc_year'],
    ['an acc year that is not text', { isb_acc_year: 2026 }, 'isb_acc_year'],
    ['a scope id that is not a uuid', { isb_item_id: 'item-1' }, 'isb_item_id'],
    ['a bucket over 20 characters', { isb_stock_bucket: 'b'.repeat(21) }, 'isb_stock_bucket'],
    ['a bucket that is not text', { isb_stock_bucket: 5 }, 'isb_stock_bucket'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(errorsOf(GetItemStockBalanceQueryDto, { ...SCOPE, ...overrides })).toEqual([field]);
  });
});

// ── GET /batch-options ──────────────────────────────────────────────────────
describe('GetItemBatchStockOptionsQueryDto', () => {
  const SCOPE = {
    ibs_acc_year: '2026-2027',
    ibs_company_id: ID,
    ibs_branch_id: ID,
    ibs_godown_id: ID,
    ibs_item_id: ID,
    ibs_unit_id: ID,
  };

  it('accepts the scope alone, and requires all of it', () => {
    expect(errorsOf(GetItemBatchStockOptionsQueryDto, SCOPE)).toEqual([]);
    expect(errorsOf(GetItemBatchStockOptionsQueryDto, {})).toEqual(Object.keys(SCOPE));
  });

  it('trims the search and limit and drops blank ones', () => {
    const dto = plainToInstance(GetItemBatchStockOptionsQueryDto, {
      ...SCOPE,
      ibs_company_id: ` ${ID} `,
      search: ' B-001 ',
      limit: ' 20 ',
      ibs_stock_bucket: '',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ ibs_company_id: ID, search: 'B-001', limit: '20' });
    expect(dto.ibs_stock_bucket).toBeUndefined();
    expect(
      plainToInstance(GetItemBatchStockOptionsQueryDto, { ...SCOPE, search: '  ', limit: null }),
    ).toMatchObject({ search: undefined, limit: undefined });
  });

  it.each([
    ['a limit over 3 characters', { limit: '1000' }, 'limit'],
    ['a search over 100 characters', { search: 's'.repeat(101) }, 'search'],
    ['a search that is not text', { search: 42 }, 'search'],
    ['a bucket over 20 characters', { ibs_stock_bucket: 'b'.repeat(21) }, 'ibs_stock_bucket'],
    ['a godown id that is not a uuid', { ibs_godown_id: 'main' }, 'ibs_godown_id'],
    ['an acc year that is not text', { ibs_acc_year: 2026 }, 'ibs_acc_year'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(errorsOf(GetItemBatchStockOptionsQueryDto, { ...SCOPE, ...overrides })).toEqual([field]);
  });
});

// ── GET /bulk-list ──────────────────────────────────────────────────────────
describe('GetBulkItemStockListQueryDto', () => {
  const SCOPE = { isb_acc_year: '2026-2027', isb_company_id: ID, isb_branch_id: ID };

  it('needs only the year, company and branch', () => {
    expect(errorsOf(GetBulkItemStockListQueryDto, SCOPE)).toEqual([]);
    expect(errorsOf(GetBulkItemStockListQueryDto, {})).toEqual(Object.keys(SCOPE));
  });

  it('accepts every filter, trimmed', () => {
    const dto = plainToInstance(GetBulkItemStockListQueryDto, {
      ...SCOPE,
      isb_branch_id: ` ${ID} `,
      isb_godown_id: ` ${ID} `,
      item_group_id: ID,
      item_brand_id: ID,
      item_section_id: ID,
      item_category_id: ID,
      stock_type: ' NEGATIVE ',
      isb_stock_bucket: 'SALEABLE',
      limit: '200',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ isb_branch_id: ID, isb_godown_id: ID, stock_type: 'NEGATIVE' });
  });

  it.each(['ALL', 'NEGATIVE', 'ZERO'])('accepts the stock type %s', (stockType) => {
    expect(errorsOf(GetBulkItemStockListQueryDto, { ...SCOPE, stock_type: stockType })).toEqual([]);
  });

  it('drops blank optional filters', () => {
    const dto = plainToInstance(GetBulkItemStockListQueryDto, {
      ...SCOPE,
      item_group_id: '',
      stock_type: '  ',
      limit: null,
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({
      item_group_id: undefined,
      stock_type: undefined,
      limit: undefined,
    });
  });

  it.each([
    ['a stock type it does not know', { stock_type: 'POSITIVE' }, 'stock_type'],
    ['a stock type in lower case', { stock_type: 'zero' }, 'stock_type'],
    ['an item filter that is not a uuid', { item_brand_id: 'brand-1' }, 'item_brand_id'],
    ['a godown that is not a uuid', { isb_godown_id: 'main' }, 'isb_godown_id'],
    ['a bucket over 20 characters', { isb_stock_bucket: 'b'.repeat(21) }, 'isb_stock_bucket'],
    ['a limit that is not text', { limit: 5 }, 'limit'],
    ['a company that is not text', { isb_company_id: 7 }, 'isb_company_id'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(errorsOf(GetBulkItemStockListQueryDto, { ...SCOPE, ...overrides })).toEqual([field]);
  });
});
