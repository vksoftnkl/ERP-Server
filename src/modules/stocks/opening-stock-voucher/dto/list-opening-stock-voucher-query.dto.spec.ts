import { BadRequestException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import {
  GetOpeningStockVoucherQueryDto,
  OpeningStockItemLookupQueryDto,
  OpeningStockReportQueryDto,
  OpeningStockVoucherRefQueryDto,
} from './list-opening-stock-voucher-query.dto';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const UOM_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const SCOPE = { companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: '2026-2027' };

const pipe = createHouseValidationPipe();
const run = <T extends object>(metatype: Type<T>, value: object) =>
  pipe.transform(value, { type: 'query', metatype }) as Promise<T>;

const refusedFields = async (metatype: Type<object>, value: object): Promise<string[]> => {
  const error = await run(metatype, value).then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof BadRequestException)) return [];
  return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map((e) => e.field);
};

describe('GetOpeningStockVoucherQueryDto', () => {
  it('loads one document: scope plus svhId', async () => {
    await expect(
      run(GetOpeningStockVoucherQueryDto, { ...SCOPE, svhId: SVH_ID }),
    ).resolves.toMatchObject({ ...SCOPE, svhId: SVH_ID });
  });

  // An absent svhId used to switch the route to a list; now it is a 400.
  it('refuses a request with no svhId instead of listing', async () => {
    await expect(refusedFields(GetOpeningStockVoucherQueryDto, SCOPE)).resolves.toEqual(['svhId']);
  });

  it('refuses the old list filters by name', async () => {
    await expect(
      refusedFields(GetOpeningStockVoucherQueryDto, {
        ...SCOPE,
        svhId: SVH_ID,
        status: 'DRAFT',
        limit: '20',
      }),
    ).resolves.toEqual(['status', 'limit']);
  });

  it('requires company, branch and a YYYY-YYYY year on every read', async () => {
    await expect(refusedFields(GetOpeningStockVoucherQueryDto, { svhId: SVH_ID })).resolves.toEqual(
      expect.arrayContaining(['companyId', 'branchId', 'accYear']),
    );
    await expect(
      refusedFields(GetOpeningStockVoucherQueryDto, { ...SCOPE, svhId: SVH_ID, accYear: '26-27' }),
    ).resolves.toEqual(['accYear']);
  });
});

describe('OpeningStockVoucherRefQueryDto', () => {
  it('names exactly one document', async () => {
    await expect(refusedFields(OpeningStockVoucherRefQueryDto, SCOPE)).resolves.toEqual(['svhId']);
    await expect(
      run(OpeningStockVoucherRefQueryDto, { ...SCOPE, svhId: SVH_ID }),
    ).resolves.toMatchObject({ svhId: SVH_ID });
  });
});

describe('OpeningStockReportQueryDto', () => {
  it('turns the paging strings into numbers', async () => {
    await expect(
      run(OpeningStockReportQueryDto, { ...SCOPE, limit: '50', offset: '0' }),
    ).resolves.toMatchObject({ limit: 50, offset: 0 });
  });

  it('leaves the paging out when it is not sent', async () => {
    const dto = await run(OpeningStockReportQueryDto, SCOPE);

    expect(dto.limit).toBeUndefined();
    expect(dto.offset).toBeUndefined();
  });

  it.each([
    ['a limit of 0', { limit: '0' }, 'limit'],
    ['a limit over 1000', { limit: '1001' }, 'limit'],
    ['a negative offset', { offset: '-1' }, 'offset'],
  ])('refuses %s', async (_label, overrides, field) => {
    await expect(
      refusedFields(OpeningStockReportQueryDto, { ...SCOPE, ...overrides }),
    ).resolves.toEqual([field]);
  });
});

describe('OpeningStockItemLookupQueryDto', () => {
  const LOOKUP = { itemId: ITEM_ID, onDate: '2026-04-01' };

  it('needs only the item and the document date', async () => {
    await expect(run(OpeningStockItemLookupQueryDto, LOOKUP)).resolves.toMatchObject(LOOKUP);
  });

  it('takes the document scope and an iuc_id when sent, and an empty scope as none', async () => {
    await expect(
      run(OpeningStockItemLookupQueryDto, {
        ...LOOKUP,
        companyId: COMPANY_ID,
        branchId: '',
        uomId: UOM_ID,
      }),
    ).resolves.toMatchObject({ companyId: COMPANY_ID, branchId: null, uomId: UOM_ID });
  });

  // No default to today: a back-dated opening must be keyed under the policy of its own date.
  it('requires the document date, as yyyy-MM-dd', async () => {
    await expect(
      refusedFields(OpeningStockItemLookupQueryDto, { itemId: ITEM_ID }),
    ).resolves.toEqual(['onDate']);
    await expect(
      refusedFields(OpeningStockItemLookupQueryDto, { itemId: ITEM_ID, onDate: '01/04/2026' }),
    ).resolves.toEqual(['onDate']);
  });

  it('requires the item, as a uuid', async () => {
    await expect(
      refusedFields(OpeningStockItemLookupQueryDto, { onDate: '2026-04-01', itemId: 'MILK' }),
    ).resolves.toEqual(['itemId']);
  });
});
