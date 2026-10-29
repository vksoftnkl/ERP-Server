import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CUSTOMER_GSTIN_PATTERN,
  CUSTOMER_GSTIN_PATTERNS,
  SaveCustomerDto,
  gstinKindOf,
} from './save-customer.dto';

const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e104';

const REQUIRED = {
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusPriceLevelId: 1,
};

const toDto = (plain: object) => plainToInstance(SaveCustomerDto, plain);
const erroredFields = (plain: object): string[] =>
  validateSync(toDto(plain)).map((error) => error.property);

describe('SaveCustomerDto', () => {
  it('accepts a plain create', () => {
    expect(
      erroredFields({
        ...REQUIRED,
        cusName: 'Ravi',
        cusStateName: 'Tamil Nadu',
        cusStateCode: '33',
      }),
    ).toEqual([]);
  });

  it('requires the state name and code on a create that makes its own ledger', () => {
    expect(erroredFields({ ...REQUIRED, cusName: 'Ravi' })).toEqual([
      'cusStateName',
      'cusStateCode',
    ]);
  });

  it('lets a link create leave the state out, since it defaults from the ledger', () => {
    expect(erroredFields({ ...REQUIRED, cusLinkLedId: LEDGER_ID })).toEqual([]);
  });

  it('still checks a state code a link create does send', () => {
    expect(erroredFields({ ...REQUIRED, cusLinkLedId: LEDGER_ID, cusStateCode: 'TNX' })).toEqual([
      'cusStateCode',
    ]);
  });

  it('requires the area, group and price level', () => {
    expect(
      erroredFields({ cusName: 'Ravi', cusStateName: 'Tamil Nadu', cusStateCode: '33' }),
    ).toEqual(['cusPriceLevelId', 'cusAreaId', 'cusGroupId']);
  });

  it('reads collection days sent as a comma list', () => {
    const dto = toDto({
      ...REQUIRED,
      cusStateName: 'Tamil Nadu',
      cusStateCode: '33',
      cusCollectionDays: '1, 4',
    });

    expect(dto.cusCollectionDays).toEqual([1, 4]);
    expect(validateSync(dto)).toEqual([]);
  });

  it('refuses a collection day that is not a whole number', () => {
    expect(
      erroredFields({
        ...REQUIRED,
        cusStateName: 'Tamil Nadu',
        cusStateCode: '33',
        cusCollectionDays: [1, 2.5],
      }),
    ).toEqual(['cusCollectionDays']);
  });

  describe('F10 rules (checked only when sent and not blank)', () => {
    const BASE = { ...REQUIRED, cusStateName: 'Tamil Nadu', cusStateCode: '33' };
    const codesOf = (plain: object) =>
      validateSync(toDto({ ...BASE, ...plain })).map((error) => [
        error.property,
        Object.keys(error.constraints ?? {}),
      ]);

    it.each([
      ['cusCreditAmtLimit', -1],
      ['cusCreditBillLimit', -1],
      ['cusCreditDays', -1],
      ['cusDiscPerc', -1],
    ])('refuses a negative %s with min', (field, value) => {
      expect(codesOf({ [field]: value })).toEqual([[field, ['min']]]);
    });

    it('lets the debit balance go negative (U2)', () => {
      expect(codesOf({ cusDebitBalance: -250.5 })).toEqual([]);
    });

    it.each([
      ['NORMAL', '33ABCDE1234F1Z5'],
      ['TDS_DEDUCTOR', '33CHEN12345A1D5'],
      ['UIN', '0717UNO00157UN5'],
      ['OIDAR', '9917USA29012OSQ'],
      ['NRTP', '3317USA29012NR5'],
    ] as const)('accepts a %s GSTIN %s, on both GSTIN fields (U1)', (kind, gstin) => {
      expect(gstinKindOf(gstin)).toBe(kind);
      expect(codesOf({ cusGstNo: gstin, cusEcommerceGstin: gstin })).toEqual([]);
    });

    it.each([
      ['NORMAL with no Z', '33ABCDE1234F1X5'],
      ['TDS deductor with a PAN, not a TAN', '33ABCDE1234F1D5'],
      ['UIN without UN / ON', '0717UNO00157XN5'],
      ['OIDAR not under 99', '9817USA29012OSQ'],
      ['NRTP 14 characters', '3317USA29012NR'],
    ])('refuses %s (%s) with isGstin', (_label, gstin) => {
      expect(gstinKindOf(gstin)).toBeNull();
      expect(codesOf({ cusGstNo: gstin })).toEqual([['cusGstNo', ['isGstin']]]);
    });

    it('exports one pattern that accepts exactly the five shapes', () => {
      expect(CUSTOMER_GSTIN_PATTERN.test('33CHEN12345A1D5')).toBe(true);
      expect(CUSTOMER_GSTIN_PATTERN.test('33ABCDE1234F1X5')).toBe(false);
      expect(Object.keys(CUSTOMER_GSTIN_PATTERNS)).toEqual([
        'NORMAL',
        'TDS_DEDUCTOR',
        'UIN',
        'OIDAR',
        'NRTP',
      ]);
    });

    it('refuses a discount over 100 with max', () => {
      expect(codesOf({ cusDiscPerc: 100.5 })).toEqual([['cusDiscPerc', ['max']]]);
      expect(codesOf({ cusDiscPerc: 100 })).toEqual([]);
    });

    it.each([
      ['cusGstNo', '33ABCDE1234F1Z', 'isGstin'],
      ['cusGstNo', '33ABCDE1234F1A5', 'isGstin'],
      ['cusEcommerceGstin', 'NOT-A-GSTIN', 'isGstin'],
      ['cusPanNo', 'ABCDE12345', 'isPan'],
      ['cusEmail', 'ravi@', 'isEmail'],
    ])('refuses %s %s with %s', (field, value, constraint) => {
      expect(codesOf({ [field]: value })).toEqual([[field, [constraint]]]);
    });

    it('upper-cases and trims a GSTIN and a PAN before checking them', () => {
      const dto = toDto({ ...BASE, cusGstNo: ' 33abcde1234f1z5 ', cusPanNo: 'abcde1234f' });

      expect(validateSync(dto)).toEqual([]);
      expect(dto.cusGstNo).toBe('33ABCDE1234F1Z5');
      expect(dto.cusPanNo).toBe('ABCDE1234F');
    });

    it('lets blank and null through as cleared, numbers included', () => {
      expect(
        codesOf({
          cusGstNo: '',
          cusEcommerceGstin: null,
          cusPanNo: '  ',
          cusEmail: '',
          cusCreditAmtLimit: null,
          cusDiscPerc: null,
          cusSortOrder: null,
        }),
      ).toEqual([]);
    });
  });

  it('refuses a cusLinkLedId that is not a uuid', () => {
    expect(erroredFields({ ...REQUIRED, cusLinkLedId: 'ledger-1' })).toContain('cusLinkLedId');
  });
});
