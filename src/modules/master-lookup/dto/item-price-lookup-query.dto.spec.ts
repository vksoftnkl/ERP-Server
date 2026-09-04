import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FREIGHT_TYPES, LOADING_TYPES } from '../master-lookup.constants';
import { ItemPriceLookupQueryDto } from './item-price-lookup-query.dto';
/**
 * `loading_type` and `freight_type` are the closed-set params on the lookup, and
 * the screen has no way to discover their values other than the rejection
 * message — so the sets and the messages are asserted here, not just "it failed".
 */
describe('ItemPriceLookupQueryDto charge modes', () => {
  const ITEM_ID = '0198c8a1-0000-7000-8000-000000000001';
  const build = (overrides: Record<string, unknown>) =>
    plainToInstance(ItemPriceLookupQueryDto, { item_id: ITEM_ID, price_level: 1, ...overrides });

  describe('loading_type', () => {
    const validate = (loading_type?: unknown) => validateSync(build({ loading_type }));
    it.each(LOADING_TYPES)('accepts %s', (loadingType) => {
      expect(validate(loadingType)).toHaveLength(0);
    });
    it('accepts the value in any case, so AUTO is not a 400', () => {
      const dto = build({ loading_type: ' AUTO ' });
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

  describe('freight_type', () => {
    const validate = (freight_type?: unknown) => validateSync(build({ freight_type }));
    it.each(FREIGHT_TYPES)('accepts %s', (freightType) => {
      expect(validate(freightType)).toHaveLength(0);
    });
    it('accepts the value in any case, so ITEM_BASIS is not a 400', () => {
      const dto = build({ freight_type: ' ITEM_BASIS ' });
      expect(validateSync(dto)).toHaveLength(0);
      expect(dto.freight_type).toBe('item_basis');
    });
    it('accepts an omitted freight_type — the lookup reads it as manual', () => {
      expect(validate(undefined)).toHaveLength(0);
    });
    it('rejects an unknown freight_type and names the allowed values', () => {
      const errors = validate('xyz');
      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toContain(
        'freight_type must be one of: manual, item_basis',
      );
    });
    it("rejects 'auto', which loading_type has but freight has no distance for", () => {
      expect(validate('auto')).toHaveLength(1);
    });
  });
});
