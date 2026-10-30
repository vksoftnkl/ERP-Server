import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveItemTaxHistoryDto } from './save-item-tax-history.dto';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46ab02';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46ab03';
const BODY = { ith_item_id: ITEM_ID, ith_tax_id: TAX_ID, ith_effective_from: '2026-04-01' };

const parse = (plain: object) => plainToInstance(SaveItemTaxHistoryDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(parse(plain)).map((error) => error.property);

describe('SaveItemTaxHistoryDto', () => {
  it('accepts the three required fields alone', () => {
    expect(erroredFields(BODY)).toEqual([]);
  });

  it('requires the item, the tax and the start date', () => {
    expect(erroredFields({})).toEqual(['ith_item_id', 'ith_tax_id', 'ith_effective_from']);
  });

  it('trims the ids and the start date before checking them', () => {
    const dto = parse({
      ith_item_id: ` ${ITEM_ID} `,
      ith_tax_id: ` ${TAX_ID} `,
      ith_effective_from: ' 2026-04-01 ',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject(BODY);
  });

  it.each([
    ['an item id that is not a uuid', { ith_item_id: 'item-1' }, 'ith_item_id'],
    ['a tax id that is not a uuid', { ith_tax_id: 'gst-18' }, 'ith_tax_id'],
    [
      'a start date that is not a date string',
      { ith_effective_from: 'April' },
      'ith_effective_from',
    ],
    ['an ith_id that is not a uuid', { ith_id: 'row-1' }, 'ith_id'],
    ['a reason over 250 characters', { ith_reason: 'r'.repeat(251) }, 'ith_reason'],
    ['a creator over 100 characters', { ith_created_by: 'c'.repeat(101) }, 'ith_created_by'],
  ])('refuses %s', (_label, overrides, field) => {
    expect(erroredFields({ ...BODY, ...overrides })).toEqual([field]);
  });

  // ith_effective_to is only a nullable string here; the service checks it is a date.
  it('lets the end date and reason be null, and a blank one become null', () => {
    expect(erroredFields({ ...BODY, ith_effective_to: null, ith_reason: null })).toEqual([]);
    expect(parse({ ...BODY, ith_effective_to: '  ' }).ith_effective_to).toBeNull();
  });
});
