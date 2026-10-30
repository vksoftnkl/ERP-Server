import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveLedgerShippingAddressDto } from './save-ledger-shipping-address.dto';

const SAA_ID = '019c6f6c-be87-7a11-8905-36092c46f301';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f302';
const BODY = { saaLedgerId: LEDGER_ID, saaGstin: '29ABCDE1234F1Z5' };

/** The fields the house pipe refused; [] when it let the body through. */
async function refusedFields<T extends object>(
  value: unknown,
  metatype: Type<T>,
): Promise<string[]> {
  try {
    await validateDto(value, metatype);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('SaveLedgerShippingAddressDto (through the house pipe)', () => {
  it('accepts an address naming only its ledger and GSTIN', async () => {
    await expect(refusedFields(BODY, SaveLedgerShippingAddressDto)).resolves.toEqual([]);
  });

  it('accepts a full address', async () => {
    await expect(
      refusedFields(
        {
          ...BODY,
          saaId: SAA_ID,
          saaCompanyId: null,
          saaBranchId: null,
          saaAddrType: 'BOTH',
          saaIsDefault: true,
          saaSort: 0,
          saaTradeName: 'T'.repeat(200),
          saaContactName: 'C'.repeat(150),
          saaAddr1: 'A'.repeat(250),
          saaLocation: 'L'.repeat(200),
          saaPin: '560001',
          saaStateCode: '29',
          saaStateName: 'Karnataka',
          saaCountryCode: 'IN',
          saaDistanceKm: 0,
          saaPhone: '9'.repeat(20),
          saaEmail: 'ship@acme.in',
          saaSyncedOn: '2026-10-03T09:00:00Z',
          saaIsActive: true,
          saaRemarks: null,
        },
        SaveLedgerShippingAddressDto,
      ),
    ).resolves.toEqual([]);
  });

  it('upper-cases the address type, GSTIN and country', async () => {
    const dto = await validateDto(
      { ...BODY, saaAddrType: ' bill_to ', saaGstin: '29abcde1234f1z5', saaCountryCode: 'in' },
      SaveLedgerShippingAddressDto,
    );

    expect(dto).toMatchObject({
      saaAddrType: 'BILL_TO',
      saaGstin: '29ABCDE1234F1Z5',
      saaCountryCode: 'IN',
    });
  });

  it('reads the sync time as a Date', async () => {
    const dto = await validateDto(
      { ...BODY, saaSyncedOn: '2026-10-03T09:00:00Z' },
      SaveLedgerShippingAddressDto,
    );

    expect(dto.saaSyncedOn).toEqual(new Date('2026-10-03T09:00:00.000Z'));
  });

  it.each([
    ['no ledger', { saaGstin: BODY.saaGstin }, 'saaLedgerId'],
    ['no GSTIN', { saaLedgerId: LEDGER_ID }, 'saaGstin'],
    ['a blank GSTIN', { ...BODY, saaGstin: '   ' }, 'saaGstin'],
    ['an address type outside the three', { ...BODY, saaAddrType: 'DELIVERY' }, 'saaAddrType'],
    ['a negative sort', { ...BODY, saaSort: -1 }, 'saaSort'],
    ['a negative distance', { ...BODY, saaDistanceKm: -5 }, 'saaDistanceKm'],
    ['a state code of one letter', { ...BODY, saaStateCode: '2' }, 'saaStateCode'],
    ['a country code of three letters', { ...BODY, saaCountryCode: 'IND' }, 'saaCountryCode'],
    ['a PIN over 10 characters', { ...BODY, saaPin: '1'.repeat(11) }, 'saaPin'],
    ['an email that is not one', { ...BODY, saaEmail: 'ship-at-acme' }, 'saaEmail'],
    ['a company that is not a uuid', { ...BODY, saaCompanyId: 'acme' }, 'saaCompanyId'],
    ['a key the address does not have', { ...BODY, saaCity: 'Bengaluru' }, 'saaCity'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveLedgerShippingAddressDto)).resolves.toEqual([field]);
  });
});
