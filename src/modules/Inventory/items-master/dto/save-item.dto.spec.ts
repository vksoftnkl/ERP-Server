import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { SaveItemCompositeDto } from './save-item-composite.dto';

/**
 * The item payload through the house ValidationPipe, as main.ts runs it —
 * enableImplicitConversion included, which is what turned the string "false"
 * into true (notes 137).
 */
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46aa03';
const pipe = createHouseValidationPipe();
const parse = (body: Record<string, unknown>) =>
  pipe.transform(
    { item_name_en: 'Widget', item_group_id: GROUP_ID, ...body },
    { type: 'body', metatype: SaveItemCompositeDto },
  ) as Promise<SaveItemCompositeDto>;
const codesOf = async (body: Record<string, unknown>) => {
  const error = await parse(body).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  const response = (error as BadRequestException).getResponse() as {
    errors: Array<{ field: string; code: string }>;
  };
  return response.errors.map((e) => `${e.field}:${e.code}`);
};

describe('SaveItemDto (notes 137)', () => {
  it('A2. null clears item_company_id (a shared item); omitted leaves it undefined', async () => {
    expect((await parse({ item_company_id: null })).item_company_id).toBeNull();
    expect((await parse({ item_company_id: '' })).item_company_id).toBeNull();
    expect((await parse({})).item_company_id).toBeUndefined();
  });

  it('A2. null clears the expiry / intimate days and the sort order', async () => {
    const dto = await parse({
      item_expiry_days: null,
      item_intimate_before_days: null,
      item_sort_order: null,
    });
    expect(dto.item_expiry_days).toBeNull();
    expect(dto.item_intimate_before_days).toBeNull();
    expect(dto.item_sort_order).toBeNull();
  });

  it('A3. null on a yes/no field reads as "not sent", never a null for the NOT NULL column', async () => {
    const dto = await parse({
      item_is_active: null,
      item_allow_sales: null,
      unit_conversions: [{ iuc_unit_id: GROUP_ID, iuc_is_base_unit: null }],
      prices: [{ ipm_uc_unit_id: GROUP_ID, ipm_profit_type: 'By %', ipm_is_active: null }],
      reorders: [{ ir_is_active: null }],
    });
    expect(dto.item_is_active).toBeUndefined();
    expect(dto.item_allow_sales).toBeUndefined();
    expect(dto.unit_conversions?.[0].iuc_is_base_unit).toBeUndefined();
    expect(dto.prices?.[0].ipm_is_active).toBeUndefined();
    expect(dto.reorders?.[0].ir_is_active).toBeUndefined();
  });

  it('D8. the string "false" stays false (implicit conversion made it true)', async () => {
    const dto = await parse({ item_is_active: 'false', item_allow_sales: 'true' });
    expect(dto.item_is_active).toBe(false);
    expect(dto.item_allow_sales).toBe(true);
  });

  it('D8. a value that is no yes/no is refused, not coerced', async () => {
    expect(await codesOf({ item_is_active: 'maybe' })).toEqual([
      'item_is_active:VALIDATION_IS_BOOLEAN',
    ]);
  });

  it('D5. negative expiry / intimate days, reorder levels and unit weight are refused', async () => {
    expect(
      await codesOf({
        item_expiry_days: -1,
        item_intimate_before_days: -2,
        reorders: [{ ir_min_level: -1, ir_reorder_days: -3 }],
        unit_conversions: [{ iuc_unit_id: GROUP_ID, iuc_uom_weight: -0.5 }],
      }),
    ).toEqual(
      expect.arrayContaining([
        'item_expiry_days:VALIDATION_MIN',
        'item_intimate_before_days:VALIDATION_MIN',
        'reorders.0.ir_min_level:VALIDATION_MIN',
        'reorders.0.ir_reorder_days:VALIDATION_MIN',
        'unit_conversions.0.iuc_uom_weight:VALIDATION_MIN',
      ]),
    );
  });

  it('D6. an HSN code holds digits only', async () => {
    expect(await codesOf({ item_hsn_code: '1006 30' })).toEqual([
      'item_hsn_code:VALIDATION_MATCHES',
    ]);
    expect((await parse({ item_hsn_code: '10063010' })).item_hsn_code).toBe('10063010');
    expect((await parse({ item_hsn_code: '' })).item_hsn_code).toBeNull();
  });
});
