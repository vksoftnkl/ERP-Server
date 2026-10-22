import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListSellingPriceQueryDto, MAX_PRICE_GRID_LIMIT } from './list-selling-price-query.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ID = '01000000-0000-7000-8000-000000000001';

const BASE = { companyId: COMPANY_ID, branchId: BRANCH_ID };

const parse = (plain: object) => plainToInstance(ListSellingPriceQueryDto, { ...BASE, ...plain });
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('ListSellingPriceQueryDto', () => {
  it('needs only the company and the branch', () => {
    expect(erroredFields({})).toEqual([]);
    expect(
      validateSync(plainToInstance(ListSellingPriceQueryDto, {})).map((error) => error.property),
    ).toEqual(['companyId', 'branchId']);
  });

  it('takes every filter as a uuid, and the query strings as typed values', () => {
    const dto = parse({
      itemGroupId: ID,
      itemBrandId: ID,
      itemSectionId: ID,
      supplierId: ID,
      itemId: ID,
      itemCategoryId: ID,
      trackPresetId: ID,
      taxId: ID,
      search: '  tata salt ',
      activeOnly: 'false',
      limit: '50',
      offset: '100',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ search: 'tata salt', activeOnly: false, limit: 50, offset: 100 });
  });

  it.each([
    ['a filter id that is not a uuid', { itemGroupId: 'grocery' }, 'itemGroupId'],
    ['a preset id that is not a uuid', { trackPresetId: 'PHARMA' }, 'trackPresetId'],
    ['a search over 100 characters', { search: 's'.repeat(101) }, 'search'],
    ['a limit of 0', { limit: '0' }, 'limit'],
    [`a limit over ${MAX_PRICE_GRID_LIMIT}`, { limit: String(MAX_PRICE_GRID_LIMIT + 1) }, 'limit'],
    ['a negative offset', { offset: '-1' }, 'offset'],
  ])('refuses %s', (_label, plain, field) => {
    expect(erroredFields(plain)).toEqual([field]);
  });

  it(`accepts a limit of exactly ${MAX_PRICE_GRID_LIMIT}`, () => {
    expect(erroredFields({ limit: String(MAX_PRICE_GRID_LIMIT) })).toEqual([]);
  });
});
