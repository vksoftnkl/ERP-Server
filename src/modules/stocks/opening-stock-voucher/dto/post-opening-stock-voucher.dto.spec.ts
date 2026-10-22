import { BadRequestException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import {
  CancelOpeningStockVoucherDto,
  PostOpeningStockVoucherDto,
} from './post-opening-stock-voucher.dto';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const BODY = { svhId: SVH_ID, accYear: '2026-2027', companyId: COMPANY_ID, branchId: BRANCH_ID };

const pipe = createHouseValidationPipe();
const run = <T extends object>(metatype: Type<T>, value: object) =>
  pipe.transform(value, { type: 'body', metatype }) as Promise<T>;

/** The field paths the house pipe refused, in order. */
const refusedFields = async (metatype: Type<object>, value: object): Promise<string[]> => {
  const error = await run(metatype, value).then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof BadRequestException)) return [];
  return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map((e) => e.field);
};

describe('PostOpeningStockVoucherDto', () => {
  it('accepts the four scope fields, with or without a user', async () => {
    await expect(run(PostOpeningStockVoucherDto, BODY)).resolves.toMatchObject(BODY);
    await expect(
      run(PostOpeningStockVoucherDto, { ...BODY, userId: USER_ID }),
    ).resolves.toMatchObject({ userId: USER_ID });
  });

  it('trims the year before matching it', async () => {
    await expect(
      run(PostOpeningStockVoucherDto, { ...BODY, accYear: ' 2026-2027 ' }),
    ).resolves.toMatchObject({ accYear: '2026-2027' });
  });

  it('requires every scope field', async () => {
    await expect(refusedFields(PostOpeningStockVoucherDto, {})).resolves.toEqual(
      expect.arrayContaining(['svhId', 'accYear', 'companyId', 'branchId']),
    );
  });

  it.each([
    ['a year that is not YYYY-YYYY', { accYear: '2026-27' }, 'accYear'],
    ['an id that is not a uuid', { svhId: 'opening-1' }, 'svhId'],
    ['a user that is not a uuid', { userId: 'admin' }, 'userId'],
    ['a field the route does not take', { status: 'POSTED' }, 'status'],
  ])('refuses %s', async (_label, overrides, field) => {
    await expect(
      refusedFields(PostOpeningStockVoucherDto, { ...BODY, ...overrides }),
    ).resolves.toEqual([field]);
  });
});

describe('CancelOpeningStockVoucherDto', () => {
  it('requires a reason, even on a draft', async () => {
    await expect(refusedFields(CancelOpeningStockVoucherDto, BODY)).resolves.toEqual(['reason']);
  });

  it('accepts a reason up to 250 characters, trimmed', async () => {
    await expect(
      run(CancelOpeningStockVoucherDto, { ...BODY, reason: '  wrong godown  ' }),
    ).resolves.toMatchObject({ reason: 'wrong godown' });
    await expect(
      refusedFields(CancelOpeningStockVoucherDto, { ...BODY, reason: 'r'.repeat(251) }),
    ).resolves.toEqual(['reason']);
  });
});
