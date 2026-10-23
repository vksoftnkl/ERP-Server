import { HttpException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { ListItemCustRateQueryDto } from './list-item-cust-rate-query.dto';
import { SaveItemCustRateDto } from './save-item-cust-rate.dto';

const RATE_ID = '019c6f6c-be87-7a11-8905-36092c46c101';
const CUSTOMER_ID = '019c6f6c-be87-7a11-8905-36092c46c102';
const UNIT_RATE_ID = '019c6f6c-be87-7a11-8905-36092c46c103';
const BODY = { csr_customer_id: CUSTOMER_ID, csr_unit_rate_id: UNIT_RATE_ID };
const pipe = createHouseValidationPipe();

const transform = <T extends object>(value: unknown, metatype: Type<T>, type: 'body' | 'query') =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

/** The fields the house pipe refused; [] when it let the value through. */
async function refusedFields<T extends object>(
  value: unknown,
  metatype: Type<T>,
  type: 'body' | 'query' = 'body',
): Promise<string[]> {
  try {
    await transform(value, metatype, type);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('SaveItemCustRateDto (through the house pipe)', () => {
  it('accepts a rate naming only its customer and unit rate', async () => {
    await expect(refusedFields(BODY, SaveItemCustRateDto)).resolves.toEqual([]);
  });

  it('accepts every field', async () => {
    await expect(
      refusedFields(
        {
          ...BODY,
          csr_id: RATE_ID,
          csr_branch_id: null,
          csr_rate_type: 'FIXED',
          csr_item_rate: 125.5,
          csr_disc_perc: 2.5,
          csr_disc_qty: 0,
          csr_price_level: 'A',
          csr_valid_from: '2026-10-01',
          csr_valid_to: null,
          csr_priority: 1,
          csr_is_active: true,
          csr_created_by: 'importer',
          csr_modified_by: null,
          csr_uploaded_at: '2026-10-01T10:00:00Z',
          csr_uploaded_by: 'importer',
          csr_remarks: 'R'.repeat(250),
        },
        SaveItemCustRateDto,
      ),
    ).resolves.toEqual([]);
  });

  it('upper-cases and trims the price level', async () => {
    const dto = await transform({ ...BODY, csr_price_level: ' b ' }, SaveItemCustRateDto, 'body');

    expect(dto.csr_price_level).toBe('B');
  });

  it('reads numeric strings as numbers', async () => {
    const dto = await transform(
      { ...BODY, csr_item_rate: '12.5', csr_priority: '2' },
      SaveItemCustRateDto,
      'body',
    );

    expect(dto).toMatchObject({ csr_item_rate: 12.5, csr_priority: 2 });
  });

  // OptionalQueryBoolean reads the raw value, so the string "false" stays false.
  it.each([
    ['false', false],
    ['true', true],
    [false, false],
  ])('reads csr_is_active %p as %p', async (csr_is_active, expected) => {
    const dto = await transform({ ...BODY, csr_is_active }, SaveItemCustRateDto, 'body');

    expect(dto.csr_is_active).toBe(expected);
  });

  it.each([
    ['no customer', { csr_unit_rate_id: UNIT_RATE_ID }, 'csr_customer_id'],
    ['a customer that is not a uuid', { ...BODY, csr_customer_id: 'c-1' }, 'csr_customer_id'],
    ['no unit rate', { csr_customer_id: CUSTOMER_ID }, 'csr_unit_rate_id'],
    ['a branch that is not a uuid', { ...BODY, csr_branch_id: 'main' }, 'csr_branch_id'],
    ['a rate type over 20 characters', { ...BODY, csr_rate_type: 'R'.repeat(21) }, 'csr_rate_type'],
    ['a rate that is not a number', { ...BODY, csr_item_rate: 'cheap' }, 'csr_item_rate'],
    ['a price level outside A-D', { ...BODY, csr_price_level: 'e' }, 'csr_price_level'],
    ['a price level of two letters', { ...BODY, csr_price_level: 'AB' }, 'csr_price_level'],
    [
      'a valid-from that is not a date',
      { ...BODY, csr_valid_from: '31/12/2026' },
      'csr_valid_from',
    ],
    ['a fractional priority', { ...BODY, csr_priority: 1.5 }, 'csr_priority'],
    ['remarks over 250 characters', { ...BODY, csr_remarks: 'R'.repeat(251) }, 'csr_remarks'],
    ['a key the rate does not have', { ...BODY, csr_item_id: RATE_ID }, 'csr_item_id'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveItemCustRateDto)).resolves.toEqual([field]);
  });
});

describe('ListItemCustRateQueryDto (through the house pipe)', () => {
  it('accepts every filter', async () => {
    await expect(
      refusedFields(
        {
          search: 'fixed',
          page: '2',
          limit: '50',
          csr_customer_id: CUSTOMER_ID,
          csr_unit_rate_id: UNIT_RATE_ID,
          csr_rate_type: 'FIXED',
          csr_price_level: 'a',
          csr_is_active: 'false',
        },
        ListItemCustRateQueryDto,
        'query',
      ),
    ).resolves.toEqual([]);
  });

  it('upper-cases the price level and reads the active flag from the query string', async () => {
    const dto = await transform(
      { csr_price_level: 'a', csr_is_active: 'false' },
      ListItemCustRateQueryDto,
      'query',
    );

    expect(dto).toMatchObject({ csr_price_level: 'A', csr_is_active: false });
  });

  it.each([
    ['a search over 120 characters', { search: 's'.repeat(121) }, 'search'],
    ['a customer that is not a uuid', { csr_customer_id: 'c-1' }, 'csr_customer_id'],
    ['a price level over 1 character', { csr_price_level: 'AB' }, 'csr_price_level'],
    ['a limit over 100', { limit: '101' }, 'limit'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query, ListItemCustRateQueryDto, 'query')).resolves.toEqual([field]);
  });
});
