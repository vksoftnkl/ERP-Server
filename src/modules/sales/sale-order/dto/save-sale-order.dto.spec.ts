import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CancelSaleOrderDto } from './sale-order-lifecycle.dto';
import { SaveSaleOrderDto } from './save-sale-order.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a702';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a703';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46a704';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46a705';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a706';
const SALESMAN_A = '019c6f6c-be87-7a11-8905-36092c46a707';
const SALESMAN_B = '019c6f6c-be87-7a11-8905-36092c46a708';

const REQUIRED = {
  soCompanyId: COMPANY_ID,
  soBranchId: BRANCH_ID,
  soAccYear: '2026-2027',
  soDeviceId: DEVICE_ID,
  soPriceLevel: 1,
  soCustId: CUST_ID,
  soCustName: 'Ravi Stores',
  soUserId: USER_ID,
};

const build = (plain: object) => plainToInstance(SaveSaleOrderDto, { ...REQUIRED, ...plain });
const erroredFields = (plain: object): string[] =>
  validateSync(build(plain)).map((error) => error.property);

/**
 * soSalesmanId / soPackedId are uuid[] columns, and a Prisma scalar list has no
 * nullable form: a null there surfaces as the misleading "Argument `customer`
 * is missing". The DTO's own transform is what keeps a cleared list an array.
 */
describe('SaveSaleOrderDto — the uuid[] columns', () => {
  it.each(['soSalesmanId', 'soPackedId'] as const)(
    'clears %s to an empty array, never null, when sent as null or blank',
    (field) => {
      expect(build({ [field]: null })[field]).toEqual([]);
      expect(build({ [field]: '' })[field]).toEqual([]);
      expect(erroredFields({ [field]: null })).toEqual([]);
    },
  );

  it('leaves an omitted list undefined, so an update keeps the stored one', () => {
    expect(build({}).soSalesmanId).toBeUndefined();
    expect(erroredFields({})).toEqual([]);
  });

  it('splits a comma-separated string and trims each id', () => {
    expect(build({ soSalesmanId: ` ${SALESMAN_A} ,${SALESMAN_B},, ` }).soSalesmanId).toEqual([
      SALESMAN_A,
      SALESMAN_B,
    ]);
  });

  it('trims the ids of an array', () => {
    expect(build({ soPackedId: [` ${SALESMAN_A} `, SALESMAN_B] }).soPackedId).toEqual([
      SALESMAN_A,
      SALESMAN_B,
    ]);
    expect(erroredFields({ soPackedId: [` ${SALESMAN_A} `] })).toEqual([]);
  });

  it('refuses an entry that is not a uuid', () => {
    expect(erroredFields({ soSalesmanId: [SALESMAN_A, 'ravi'] })).toEqual(['soSalesmanId']);
    expect(erroredFields({ soSalesmanId: 'ravi' })).toEqual(['soSalesmanId']);
  });

  it('refuses a value that is neither a list nor a string', () => {
    expect(erroredFields({ soSalesmanId: 42 })).toEqual(['soSalesmanId']);
  });
});

describe('SaveSaleOrderDto — nested arrays', () => {
  it('validates each line, charge and tender as its own DTO', () => {
    const errors = validateSync(
      build({
        items: [{ soiItemId: 'not-a-uuid', soiItemUnitId: SALESMAN_A }],
        charges: [{ cdAmount: 'lots' }],
        tenders: [{ tdTenderId: 'cash' }],
      }),
    );

    expect(errors.map((error) => error.property)).toEqual(['items', 'charges', 'tenders']);
    expect(errors[0].children?.[0].children?.map((child) => child.property)).toContain('soiItemId');
  });

  it('refuses an items value that is not an array', () => {
    expect(erroredFields({ items: { soiItemId: SALESMAN_A } })).toContain('items');
  });
});

describe('CancelSaleOrderDto', () => {
  const KEYS = {
    soId: '019c6f6c-be87-7a11-8905-36092c46a701',
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soAccYear: '2026-2027',
  };

  it('requires a reason, and a blank one is no reason', () => {
    const fields = (plain: object) =>
      validateSync(plainToInstance(CancelSaleOrderDto, { ...KEYS, ...plain })).map(
        (error) => error.property,
      );

    expect(fields({})).toEqual(['reason']);
    expect(fields({ reason: '   ' })).toEqual(['reason']);
    expect(fields({ reason: 'Customer withdrew' })).toEqual([]);
  });
});
