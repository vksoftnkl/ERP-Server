import { LABEL_COST_CODE_KEY, keyRuleErrors, normalizeKeyedValue } from './app-settings.validation';

describe('inventory.label_cost_code — the cost-code letters key rule (sticker printing S-P1, S1)', () => {
  const field = 'data[0].asvValue';
  it('ten different letters pass, upper-cased', () => {
    expect(keyRuleErrors(LABEL_COST_CODE_KEY, 'BLACKHORSE', field)).toEqual([]);
    expect(normalizeKeyedValue(LABEL_COST_CODE_KEY, ' blackhorse ')).toBe('BLACKHORSE');
    expect(keyRuleErrors(LABEL_COST_CODE_KEY, 'blackhorse', field)).toEqual([]);
  });
  it('a repeated letter, too few, digits → APP_SETTING_COST_CODE_INVALID on the entry', () => {
    for (const bad of ['BLACKHORSB', 'ABC', 'BLACKH0RSE', 'BLACKHORSEX']) {
      expect(keyRuleErrors(LABEL_COST_CODE_KEY, bad, field)).toEqual([
        expect.objectContaining({ code: 'APP_SETTING_COST_CODE_INVALID', field }),
      ]);
    }
  });
  it('null (the blank) is legal, and other keys are untouched', () => {
    expect(keyRuleErrors(LABEL_COST_CODE_KEY, null, field)).toEqual([]);
    expect(keyRuleErrors('stock.auto_batch_no', 'ABC', field)).toEqual([]);
    expect(normalizeKeyedValue('company.name_note', ' mixed Case ')).toBe(' mixed Case ');
  });
});
