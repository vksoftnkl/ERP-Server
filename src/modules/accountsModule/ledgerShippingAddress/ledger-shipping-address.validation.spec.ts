import { HttpException } from '@nestjs/common';
import {
  assertSaaAddrType,
  assertSaaGstin,
  assertSaaPin,
  assertSaaStateCode,
} from './ledger-shipping-address.validation';
import { LedgerShippingAddressErrorCode } from './types/ledger-shipping-address-error-codes';

/** The single refusal a guard threw, as field + code. */
const refusalOf = (guard: () => unknown): { field: string; code: string } => {
  try {
    guard();
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    expect(error.getStatus()).toBe(400);
    const [detail] = (error.getResponse() as { errors: Array<{ field: string; code: string }> })
      .errors;
    return { field: detail.field, code: detail.code };
  }
  throw new Error('expected the guard to refuse');
};

describe('ledger-shipping-address.validation', () => {
  describe('assertSaaAddrType', () => {
    it.each([
      ['SHIP_TO', 'SHIP_TO'],
      [' bill_to ', 'BILL_TO'],
      ['both', 'BOTH'],
    ])('reads %p as %s', (value, expected) => {
      expect(assertSaaAddrType(value)).toBe(expected);
    });

    it.each([['DELIVERY'], [''], ['SHIPTO']])('refuses %p', (value) => {
      expect(refusalOf(() => assertSaaAddrType(value))).toEqual({
        field: 'saaAddrType',
        code: LedgerShippingAddressErrorCode.ADDR_TYPE_INVALID,
      });
    });
  });

  describe('assertSaaStateCode', () => {
    it.each([[null], [undefined], ['29'], ['07']])('lets %p through', (value) => {
      expect(() => assertSaaStateCode(value)).not.toThrow();
    });

    it.each([['2'], ['290'], ['KA'], ['2A']])('refuses %p', (value) => {
      expect(refusalOf(() => assertSaaStateCode(value))).toEqual({
        field: 'saaStateCode',
        code: LedgerShippingAddressErrorCode.STATE_CODE_INVALID,
      });
    });
  });

  describe('assertSaaPin', () => {
    it.each([
      ['no PIN', null, 'IN'],
      ['a 6-digit Indian PIN', '560001', 'IN'],
      ['an Indian PIN with no country (defaults to IN)', '560001', undefined],
      ['any PIN abroad', 'SW1A 1AA', 'GB'],
      ['any PIN abroad, lower-cased country', 'DXB-01', ' ae '],
    ])('lets %s through', (_label, pin, country) => {
      expect(() => assertSaaPin(pin, country)).not.toThrow();
    });

    it.each([
      ['5 digits', '56000', 'IN'],
      ['7 digits', '5600011', 'IN'],
      ['letters', '56000A', 'in'],
      ['a short PIN with no country', '5600', null],
    ])('refuses an Indian PIN of %s', (_label, pin, country) => {
      expect(refusalOf(() => assertSaaPin(pin, country))).toEqual({
        field: 'saaPin',
        code: LedgerShippingAddressErrorCode.PIN_INVALID,
      });
    });
  });

  describe('assertSaaGstin', () => {
    it('trims and upper-cases a valid GSTIN', () => {
      expect(assertSaaGstin(' 29abcde1234f1z5 ')).toBe('29ABCDE1234F1Z5');
    });

    it.each([[null], [undefined], ['   ']])('refuses %p as missing', (value) => {
      expect(refusalOf(() => assertSaaGstin(value))).toEqual({
        field: 'saaGstin',
        code: LedgerShippingAddressErrorCode.GSTIN_REQUIRED,
      });
    });

    it.each([
      ['14 characters', '29ABCDE1234F1Z'],
      ['16 characters', '29ABCDE1234F1Z55'],
      ['no Z in the 14th place', '29ABCDE1234F1X5'],
      ['a 0 in the 13th place', '29ABCDE1234F0Z5'],
      ['letters for the state code', 'KAABCDE1234F1Z5'],
    ])('refuses a GSTIN with %s', (_label, value) => {
      expect(refusalOf(() => assertSaaGstin(value))).toEqual({
        field: 'saaGstin',
        code: LedgerShippingAddressErrorCode.GSTIN_INVALID,
      });
    });
  });
});
