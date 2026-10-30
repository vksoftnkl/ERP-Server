import { ledgerGstFieldsOf, normalizePartyGstType, resolvePartyGstType } from './party-gst-type';

describe('party GST type (party rules D2)', () => {
  it.each([
    ['Regular', 'REGULAR'],
    [' unregistered ', 'UNREGISTERED'],
    ['Un-Registered', 'UNREGISTERED'],
    ['composition', 'COMPOSITION'],
    [' sez ', 'SEZ'],
    ['SEZ Unit', 'SEZ'],
    ['Overseas', 'OVERSEAS'],
    ['', null],
    [null, null],
    ['test', 'INVALID'],
  ])('normalises %p to %p', (raw, code) => {
    expect(normalizePartyGstType(raw)).toBe(code);
  });

  it('maps each code to the ledger pair', () => {
    expect(ledgerGstFieldsOf('SEZ')).toEqual({ ledGstPartyRegType: 'REGULAR', ledIsSez: true });
    expect(ledgerGstFieldsOf('OVERSEAS')).toEqual({ ledGstPartyRegType: 'UNREGISTERED', ledIsSez: false });
    expect(ledgerGstFieldsOf('COMPOSITION')).toEqual({ ledGstPartyRegType: 'COMPOSITION', ledIsSez: false });
  });

  const G = '33ABCDE1234F1Z5';
  it.each([
    [{ rawType: null, gstin: null, stateCode: '33' }, { type: 'UNREGISTERED' }],
    [{ rawType: 'Regular', gstin: G, stateCode: '33' }, { type: 'REGULAR' }],
    [{ rawType: 'Overseas', gstin: null, stateCode: '96' }, { type: 'OVERSEAS' }],
    [{ rawType: 'x', gstin: null, stateCode: '33' }, { refusal: { kind: 'TYPE_INVALID' } }],
    [{ rawType: '', gstin: G, stateCode: '33' }, { refusal: { kind: 'TYPE_REQUIRED' } }],
    [{ rawType: 'SEZ', gstin: null, stateCode: '33' }, { refusal: { kind: 'GSTIN_REQUIRED' } }],
    [{ rawType: 'UNREGISTERED', gstin: G, stateCode: '33' }, { refusal: { kind: 'GSTIN_NOT_ALLOWED' } }],
    [{ rawType: 'OVERSEAS', gstin: G, stateCode: '96' }, { refusal: { kind: 'GSTIN_NOT_ALLOWED' } }],
    [{ rawType: 'OVERSEAS', gstin: null, stateCode: '33' }, { refusal: { kind: 'OVERSEAS_STATE' } }],
    [{ rawType: 'REGULAR', gstin: G, stateCode: '29' }, { refusal: { kind: 'GSTIN_STATE_MISMATCH', gstinState: '33' } }],
    [{ rawType: 'REGULAR', gstin: '0717UNO00157UN5', stateCode: '29' }, { type: 'REGULAR' }],
  ])('resolves %p', (input, expected) => {
    expect(resolvePartyGstType(input)).toMatchObject(expected);
  });
});
