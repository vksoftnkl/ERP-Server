import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LOADING_TYPES } from '../master-lookup.constants';
import { ItemPriceLookupQueryDto } from './item-price-lookup-query.dto';
/**
 * `loading_type` is the only closed-set param on the lookup, and the screen has
 * no way to discover its values other than the rejection message — so the set
 * and the message are asserted here, not just "it failed".
 */
describe('ItemPriceLookupQueryDto loading_type', () => {
  const ITEM_ID = '0198c8a1-0000-7000-8000-000000000001';
  const validate = (loading_type?: unknown) =>
    validateSync(
      plainToInstance(ItemPriceLookupQueryDto, { item_id: ITEM_ID, price_level: 1, loading_type }),
    );
  it.each(LOADING_TYPES)('accepts %s', (loadingType) => {
    expect(validate(loadingType)).toHaveLength(0);
  });
  it('accepts the value in any case, so AUTO is not a 400', () => {
    const dto = plainToInstance(ItemPriceLookupQueryDto, {
      item_id: ITEM_ID,
      price_level: 1,
      loading_type: ' AUTO ',
    });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.loading_type).toBe('auto');
  });
  it('accepts an omitted loading_type — the lookup reads it as manual', () => {
    expect(validate(undefined)).toHaveLength(0);
  });
  it('rejects an unknown loading_type and names the allowed values', () => {
    const errors = validate('xyz');
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      'loading_type must be one of: manual, item_basis, auto',
    );
  });
});