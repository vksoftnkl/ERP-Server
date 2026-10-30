import { readSalesSettings, SALES_SETTING_DEFAULTS, SALES_SETTING_KEYS } from './sales.settings';
import type { AppSettingEffectiveItem } from '../../settings/appSettings/types/app-settings-api.types';

const setting = (asdKey: string, value: string | null) =>
  ({ asdKey, value }) as unknown as AppSettingEffectiveItem;

describe('readSalesSettings', () => {
  it('answers every seeded default when the catalogue is empty', () => {
    expect(readSalesSettings([])).toEqual(SALES_SETTING_DEFAULTS);
  });

  it('reads valid values of every kind', () => {
    const s = readSalesSettings([
      setting(SALES_SETTING_KEYS.BACKDATE_MODE, 'REFUSE'),
      setting(SALES_SETTING_KEYS.CREDIT_LIMIT_MODE, 'OFF'),
      setting(SALES_SETTING_KEYS.ALLOW_EXCESS_TENDER, 'true'),
      setting(SALES_SETTING_KEYS.MAX_LINE_DISC_PERC, '12.5'),
      setting(SALES_SETTING_KEYS.DEFAULT_CUSTOMER_ID, '019c6f6c-be87-7a11-8905-36092c46aa01'),
      setting(SALES_SETTING_KEYS.ROUND_OFF_STEP, '0.5'),
    ]);

    expect(s).toMatchObject({
      backdateMode: 'REFUSE',
      creditLimitMode: 'OFF',
      allowExcessTender: true,
      maxLineDiscPerc: 12.5,
      defaultCustomerId: '019c6f6c-be87-7a11-8905-36092c46aa01',
      roundOffStep: 0.5,
    });
  });

  it('accepts an enum in any case and with surrounding blanks', () => {
    expect(
      readSalesSettings([setting(SALES_SETTING_KEYS.RATE_BELOW_MIN_MODE, '  allow ')])
        .rateBelowMinMode,
    ).toBe('ALLOW');
  });

  it('falls back to the default for a value outside the catalogue list', () => {
    const s = readSalesSettings([
      setting(SALES_SETTING_KEYS.CREDIT_LIMIT_MODE, 'BLOCK'),
      setting(SALES_SETTING_KEYS.TEMP_CREDIT_BLOCK_OPEN, ''),
    ]);

    expect(s.creditLimitMode).toBe(SALES_SETTING_DEFAULTS.creditLimitMode);
    expect(s.tempCreditBlockOpen).toBe(SALES_SETTING_DEFAULTS.tempCreditBlockOpen);
  });

  it.each([
    ['1', true],
    ['yes', true],
    [' TRUE ', true],
    ['0', false],
    ['no', false],
    ['False', false],
  ])('reads the boolean %p as %p', (value, expected) => {
    expect(
      readSalesSettings([setting(SALES_SETTING_KEYS.SALESMAN_MANDATORY, value)]).salesmanMandatory,
    ).toBe(expected);
  });

  it('keeps the default for a boolean it cannot read', () => {
    expect(
      readSalesSettings([setting(SALES_SETTING_KEYS.ALLOW_POSTED_AMEND, 'maybe')]).allowPostedAmend,
    ).toBe(SALES_SETTING_DEFAULTS.allowPostedAmend);
  });

  it('keeps the default for a number it cannot read, and for a null value', () => {
    const s = readSalesSettings([
      setting(SALES_SETTING_KEYS.RETURN_WINDOW_DAYS, 'thirty'),
      setting(SALES_SETTING_KEYS.TEMP_CREDIT_MAX_DAYS, null),
    ]);

    expect(s.returnWindowDays).toBe(SALES_SETTING_DEFAULTS.returnWindowDays);
    expect(s.tempCreditMaxDays).toBe(SALES_SETTING_DEFAULTS.tempCreditMaxDays);
  });

  it('reads a blank default customer as none', () => {
    expect(
      readSalesSettings([setting(SALES_SETTING_KEYS.DEFAULT_CUSTOMER_ID, '   ')]).defaultCustomerId,
    ).toBeNull();
  });
});
