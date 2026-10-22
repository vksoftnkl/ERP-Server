import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { MAX_SAVE_ROWS, SaveSellingPriceBulkDto } from './save-selling-price-bulk.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const IPM_ID = '01000000-0000-7000-8000-000000000041';

const row = (overrides: Record<string, unknown> = {}) => ({
  itemId: ITEM_ID,
  uomId: UOM_ID,
  levels: [{ level: 1, price: 118 }],
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) => ({
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  scope: 'BRANCH',
  rows: [row()],
  ...overrides,
});

/** Every failing property, nested ones as a dotted path (rows.0.levels.0.level). */
const failedPaths = (plain: object): string[] => {
  const walk = (errors: ValidationError[], prefix: string): string[] =>
    errors.flatMap((error) => {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      return error.children?.length ? walk(error.children, path) : [path];
    });
  return walk(validateSync(plainToInstance(SaveSellingPriceBulkDto, plain)), '');
};

describe('SaveSellingPriceBulkDto', () => {
  it('accepts a minimal save', () => {
    expect(failedPaths(body())).toEqual([]);
  });

  it('accepts a full row: echoed bucket, scope and id, all four levels, min and round-off', () => {
    expect(
      failedPaths(
        body({
          scope: 'CHAIN',
          confirmed: true,
          userId: '01000000-0000-7000-8000-0000000000a1',
          rows: [
            row({
              lineNo: 3,
              bucketId: IPM_ID,
              priceScope: 'CHAIN',
              mrp: 120,
              salePrice: null,
              minPrice: 100,
              roundOff: -0.5,
              levels: [
                { level: 1, price: 118, priceWot: 100, markupPerc: 18 },
                { level: 2, price: 115 },
                { level: 3, price: 112 },
                { level: 4, price: 0 },
              ],
            }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it.each([
    ['no company', { companyId: undefined }, 'companyId'],
    ['a branch that is not a uuid', { branchId: 'main' }, 'branchId'],
    ['a scope outside BRANCH / CHAIN', { scope: 'COMPANY' }, 'scope'],
    ['no rows at all', { rows: [] }, 'rows'],
    ['rows that are not an array', { rows: 'all' }, 'rows'],
    ['a confirmed flag that is not a boolean', { confirmed: 'yes' }, 'confirmed'],
    ['a user that is not a uuid', { userId: 'admin' }, 'userId'],
  ])('refuses %s', (_label, overrides, path) => {
    expect(failedPaths(body(overrides))).toEqual([path]);
  });

  it(`refuses more than ${MAX_SAVE_ROWS} rows in one save — a screen-full, not a catalogue`, () => {
    expect(failedPaths(body({ rows: Array.from({ length: MAX_SAVE_ROWS }, () => row()) }))).toEqual(
      [],
    );
    expect(
      failedPaths(body({ rows: Array.from({ length: MAX_SAVE_ROWS + 1 }, () => row()) })),
    ).toEqual(['rows']);
  });

  it.each([
    ['an item that is not a uuid', { itemId: 'salt' }, 'rows.0.itemId'],
    ['a unit that is not a uuid', { uomId: 'pcs' }, 'rows.0.uomId'],
    ['a price row id that is not a uuid', { bucketId: 'ipm-1' }, 'rows.0.bucketId'],
    ['a loaded scope outside BRANCH / CHAIN', { priceScope: 'GLOBAL' }, 'rows.0.priceScope'],
    ['a negative MRP', { mrp: -1 }, 'rows.0.mrp'],
    ['a negative sale price', { salePrice: -1 }, 'rows.0.salePrice'],
    ['a negative min price', { minPrice: -1 }, 'rows.0.minPrice'],
    ['a negative line number', { lineNo: -1 }, 'rows.0.lineNo'],
    ['no levels', { levels: [] }, 'rows.0.levels'],
    ['a level below 1', { levels: [{ level: 0, price: 1 }] }, 'rows.0.levels.0.level'],
    ['a level above 4', { levels: [{ level: 5, price: 1 }] }, 'rows.0.levels.0.level'],
    ['a negative price', { levels: [{ level: 1, price: -1 }] }, 'rows.0.levels.0.price'],
    ['a level with no price', { levels: [{ level: 1 }] }, 'rows.0.levels.0.price'],
  ])('refuses a row with %s', (_label, overrides, path) => {
    expect(failedPaths(body({ rows: [row(overrides)] }))).toEqual([path]);
  });

  it('lets a row leave its loaded scope, bucket and min price null', () => {
    expect(
      failedPaths(
        body({ rows: [row({ priceScope: null, bucketId: null, mrp: null, minPrice: null })] }),
      ),
    ).toEqual([]);
  });
});
