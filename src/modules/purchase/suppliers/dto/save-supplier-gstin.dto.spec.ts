import { HttpException } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { PARTY_GSTIN_PATTERN } from 'src/common/party/party-gstin';
import { CUSTOMER_GSTIN_PATTERN } from 'src/modules/sales/customer/dto/save-customer.dto';
import { SaveSupplierDto } from './save-supplier.dto';

/**
 * supGstNo takes the customer's GSTIN check (src/common/party/party-gstin.ts): a supplier edit
 * syncs to the customer of the same party, so a shape the customer refuses must not get in here.
 */
const BODY = {
  supGroupId: '019c6f6c-be87-7a11-8905-36092c46f503',
  supPurchaseType: 'LOCAL',
  supName: 'Sri Ganesh Mills',
  supStateName: 'Tamil Nadu',
  supStateCode: '33',
  supGstType: 'REGULAR',
};

async function refusal(supGstNo: unknown): Promise<string | null> {
  try {
    await validateDto({ ...BODY, supGstNo }, SaveSupplierDto);
    return null;
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    const d = (error.getResponse() as { errors: Array<{ field: string; code: string }> }).errors;
    return d.map((e) => `${e.field} ${e.code}`).join(',');
  }
}

describe('SaveSupplierDto supGstNo (same check as cusGstNo)', () => {
  it('the supplier and the customer share one pattern', () => {
    expect(CUSTOMER_GSTIN_PATTERN).toBe(PARTY_GSTIN_PATTERN);
  });

  it.each([
    ['NORMAL', '33ABCDE1234F1Z5'],
    ['TDS_DEDUCTOR', '33CHEN12345A1D5'],
    ['UIN', '0101USA12345UNZ'],
    ['OIDAR', '9901USA12345OS7'],
    ['NRTP', '3301USA12345NR7'],
  ])('accepts a %s GSTIN', async (_kind, gstin) => {
    await expect(refusal(gstin)).resolves.toBeNull();
  });

  it.each([
    ['15 letters', 'ABCDEFGHIJKLMNO'],
    ['a bad 14th character', '33ABCDE1234F1X5'],
    ['too short', '33ABCDE1234F1Z'],
    ['too long', '33ABCDE1234F1Z55'],
    ['a number', 123456789012345],
  ])('refuses %s with VALIDATION_IS_GSTIN (or the type check)', async (_what, gstin) => {
    const r = await refusal(gstin);
    expect(r).toMatch(/^supGstNo VALIDATION_/);
  });

  it('refuses a shape with VALIDATION_IS_GSTIN', async () => {
    await expect(refusal('ABCDEFGHIJKLMNO')).resolves.toBe('supGstNo VALIDATION_IS_GSTIN');
  });

  it('trims and upper-cases before the check', async () => {
    const dto = await validateDto({ ...BODY, supGstNo: '  33abcde1234f1z5 ' }, SaveSupplierDto);
    expect(dto.supGstNo).toBe('33ABCDE1234F1Z5');
  });

  it('blank is a clear (null), not checked; left out stays left out', async () => {
    expect((await validateDto({ ...BODY, supGstNo: '   ' }, SaveSupplierDto)).supGstNo).toBeNull();
    expect((await validateDto({ ...BODY, supGstNo: null }, SaveSupplierDto)).supGstNo).toBeNull();
    expect((await validateDto({ ...BODY }, SaveSupplierDto)).supGstNo).toBeUndefined();
  });
});
