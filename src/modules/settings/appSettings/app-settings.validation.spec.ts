import {
  isCastableToDataType,
  isScopeWithinMax,
  toAllowedValues,
  validateSettingValue,
} from './app-settings.validation';
import { AppSettingDataType, AppSettingScope } from './types/app-settings-api.types';

// These are the rules fn_asv_check_scope enforces in the database, restated in
// TypeScript so the API can name the offending field. The point of the suite is
// that the restatement stays FAITHFUL: anything accepted here must survive the
// cast fn_app_settings performs, because that cast runs for every caller.
describe('isCastableToDataType', () => {
  it.each([
    ['true', AppSettingDataType.BOOL],
    ['FALSE', AppSettingDataType.BOOL],
    ['t', AppSettingDataType.BOOL],
    ['1', AppSettingDataType.BOOL],
    ['on', AppSettingDataType.BOOL],
    ['-42', AppSettingDataType.INT],
    ['0', AppSettingDataType.INT],
    ['12.5', AppSettingDataType.DECIMAL],
    ['.5', AppSettingDataType.DECIMAL],
    ['-1e3', AppSettingDataType.DECIMAL],
    ['019cc7fc-3547-74a6-b65b-179b9db989a6', AppSettingDataType.UUID],
    ['2026-04-01', AppSettingDataType.DATE],
    ['{"a":[1,2]}', AppSettingDataType.JSON],
    ['[]', AppSettingDataType.JSON],
    ['anything at all', AppSettingDataType.TEXT],
  ])('accepts %s as %s', (value, dataType) => {
    expect(isCastableToDataType(value, dataType)).toBe(true);
  });

  it.each([
    ['yes please', AppSettingDataType.BOOL],
    ['2', AppSettingDataType.BOOL],
    ['12.5', AppSettingDataType.INT],
    ['abc', AppSettingDataType.INT],
    ['', AppSettingDataType.DECIMAL],
    ['1,5', AppSettingDataType.DECIMAL],
    ['not-a-uuid', AppSettingDataType.UUID],
    ['01/04/2026', AppSettingDataType.DATE],
    ['2026-13-45', AppSettingDataType.DATE],
    ['{a:1}', AppSettingDataType.JSON],
  ])('refuses %s as %s', (value, dataType) => {
    expect(isCastableToDataType(value, dataType)).toBe(false);
  });
});

describe('validateSettingValue', () => {
  const decimalRule = {
    asdKey: 'sales.max_discount_percent',
    asdDataType: AppSettingDataType.DECIMAL,
    asdAllowedValues: null,
    asdMinValue: 0,
    asdMaxValue: 100,
  };

  // null is the deliberate blank, not a missing value: the resolver drops the
  // key rather than falling back to the layer above.
  it('always accepts null and undefined', () => {
    expect(validateSettingValue(null, decimalRule, 'asvValue')).toEqual([]);
    expect(validateSettingValue(undefined, decimalRule, 'asvValue')).toEqual([]);
  });

  it('accepts a value inside the range', () => {
    expect(validateSettingValue('40', decimalRule, 'asvValue')).toEqual([]);
  });

  it.each([
    ['-1', 'below the minimum'],
    ['150', 'above the maximum'],
  ])('refuses %s', (value, reason) => {
    const [detail] = validateSettingValue(value, decimalRule, 'asvValue');
    expect(detail.field).toBe('asvValue');
    expect(detail.message).toContain(reason);
  });

  // The bounds are inclusive, the same way the DB compares them.
  it.each(['0', '100'])('accepts the boundary %s', (value) => {
    expect(validateSettingValue(value, decimalRule, 'asvValue')).toEqual([]);
  });

  it('reports the cast failure alone, without also complaining about the range', () => {
    const details = validateSettingValue('abc', decimalRule, 'asvValue');
    expect(details).toHaveLength(1);
    expect(details[0].message).toContain('not a valid DECIMAL');
  });

  it('enforces the allowed list', () => {
    const rule = {
      asdKey: 'accounts.credit_limit_check',
      asdDataType: AppSettingDataType.TEXT,
      asdAllowedValues: ['OFF', 'WARN', 'BLOCK'],
      asdMinValue: null,
      asdMaxValue: null,
    };
    expect(validateSettingValue('WARN', rule, 'asvValue')).toEqual([]);
    const [detail] = validateSettingValue('MAYBE', rule, 'asvValue');
    expect(detail.message).toContain('not one of the allowed values');
  });

  // The DB applies min/max to the numeric types only; a bound left on a TEXT row
  // must not start silently rejecting values.
  it('ignores the range on non-numeric types', () => {
    const rule = {
      asdKey: 'system.date_format',
      asdDataType: AppSettingDataType.TEXT,
      asdAllowedValues: null,
      asdMinValue: 0,
      asdMaxValue: 1,
    };
    expect(validateSettingValue('dd-MM-yyyy', rule, 'asvValue')).toEqual([]);
  });
});

describe('toAllowedValues', () => {
  it('keeps the string members', () => {
    expect(toAllowedValues(['OFF', 'WARN'])).toEqual(['OFF', 'WARN']);
  });

  // Membership is tested with `@> to_jsonb(asv_value)` — a JSON string — so a
  // non-string member could never match any value.
  it('drops members no value could ever match', () => {
    expect(toAllowedValues(['OFF', 1, null, { a: 1 }])).toEqual(['OFF']);
    expect(toAllowedValues([1, 2])).toBeNull();
  });

  it('treats anything that is not an array as no restriction', () => {
    expect(toAllowedValues(null)).toBeNull();
    expect(toAllowedValues(undefined)).toBeNull();
    expect(toAllowedValues('OFF')).toBeNull();
    expect(toAllowedValues([])).toBeNull();
  });
});

describe('isScopeWithinMax', () => {
  it('allows the limit itself and everything shallower', () => {
    expect(isScopeWithinMax(AppSettingScope.GLOBAL, AppSettingScope.BRANCH)).toBe(true);
    expect(isScopeWithinMax(AppSettingScope.COMPANY, AppSettingScope.BRANCH)).toBe(true);
    expect(isScopeWithinMax(AppSettingScope.BRANCH, AppSettingScope.BRANCH)).toBe(true);
  });

  it('refuses anything deeper', () => {
    expect(isScopeWithinMax(AppSettingScope.DEVICE, AppSettingScope.BRANCH)).toBe(false);
    expect(isScopeWithinMax(AppSettingScope.USER, AppSettingScope.BRANCH)).toBe(false);
    expect(isScopeWithinMax(AppSettingScope.COMPANY, AppSettingScope.GLOBAL)).toBe(false);
  });
});
