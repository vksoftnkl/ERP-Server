import { HttpException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { ListBatchPrefixQueryDto } from './list-batch-prefix-query.dto';
import { SaveBatchPrefixDto } from './save-batch-prefix.dto';

const PREFIX_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
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

describe('SaveBatchPrefixDto (through the house pipe)', () => {
  it('accepts a new prefix alone', async () => {
    await expect(refusedFields({ prefixUsed: 'KR' }, SaveBatchPrefixDto)).resolves.toEqual([]);
  });

  it('accepts an update with an ISO sync date', async () => {
    await expect(
      refusedFields(
        { id: PREFIX_ID, prefixUsed: 'KR', syncDate: '2026-10-03T09:00:00Z' },
        SaveBatchPrefixDto,
      ),
    ).resolves.toEqual([]);
  });

  it('trims the prefix', async () => {
    const dto = await transform({ prefixUsed: '  KR ' }, SaveBatchPrefixDto, 'body');

    expect(dto.prefixUsed).toBe('KR');
  });

  // null clears the column on update; a blank string means the same.
  it.each([[null], [''], ['   ']])('reads a sync date of %p as null', async (syncDate) => {
    const dto = await transform({ prefixUsed: 'KR', syncDate }, SaveBatchPrefixDto, 'body');

    expect(dto.syncDate).toBeNull();
  });

  it.each([
    ['no prefix', { syncDate: null }, 'prefixUsed'],
    ['a blank prefix', { prefixUsed: '   ' }, 'prefixUsed'],
    ['a sync date that is not ISO-8601', { prefixUsed: 'KR', syncDate: '03/10/2026' }, 'syncDate'],
    ['an id that is not a uuid', { id: 'prefix-1', prefixUsed: 'KR' }, 'id'],
    ['a key the prefix does not have', { prefixUsed: 'KR', createdBy: 'me' }, 'createdBy'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveBatchPrefixDto)).resolves.toEqual([field]);
  });
});

describe('ListBatchPrefixQueryDto (through the house pipe)', () => {
  it('accepts an empty query', async () => {
    await expect(refusedFields({}, ListBatchPrefixQueryDto, 'query')).resolves.toEqual([]);
  });

  it('turns query-string paging into numbers', async () => {
    const dto = await transform({ page: '2', limit: '50' }, ListBatchPrefixQueryDto, 'query');

    expect(dto).toMatchObject({ page: 2, limit: 50 });
  });

  it.each([
    ['a page of 0', { page: '0' }, 'page'],
    ['a page that is not a number', { page: 'two' }, 'page'],
    ['a fractional page', { page: '1.5' }, 'page'],
    ['a limit of 0', { limit: '0' }, 'limit'],
    ['a limit over 100', { limit: '101' }, 'limit'],
  ])('refuses %s', async (_label, query, field) => {
    await expect(refusedFields(query, ListBatchPrefixQueryDto, 'query')).resolves.toEqual([field]);
  });
});
