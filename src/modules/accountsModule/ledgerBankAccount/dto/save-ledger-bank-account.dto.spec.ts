import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveLedgerBankAccountDto } from './save-ledger-bank-account.dto';

const LBA_ID = '019c6f6c-be87-7a11-8905-36092c46d101';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46d103';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d104';
const BODY = {
  lbaLedgerId: LEDGER_ID,
  lbaAccountHolder: 'Acme Industries Pvt Ltd',
  lbaBankName: 'HDFC Bank',
  lbaAccountNo: '50100123456789',
};

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

describe('SaveLedgerBankAccountDto (through the house pipe)', () => {
  it('accepts an account naming only its ledger, holder, bank and number', async () => {
    await expect(refusedFields(BODY, SaveLedgerBankAccountDto)).resolves.toEqual([]);
  });

  it('accepts every field at its length limit', async () => {
    await expect(
      refusedFields(
        {
          lbaId: LBA_ID,
          lbaCompanyId: COMPANY_ID,
          lbaLedgerId: LEDGER_ID,
          lbaAccountHolder: 'H'.repeat(200),
          lbaBankName: 'B'.repeat(200),
          lbaBranchName: 'R'.repeat(200),
          lbaAccountNo: '9'.repeat(50),
          lbaIfscCode: 'HDFC0001234',
          lbaMicrCode: '5'.repeat(15),
          lbaAccountType: 'CURRENT',
          lbaUpiId: 'U'.repeat(100),
          lbaChequeName: 'C'.repeat(200),
          lbaIsDefault: true,
          lbaIsActive: true,
          lbaRemarks: 'M'.repeat(250),
        },
        SaveLedgerBankAccountDto,
      ),
    ).resolves.toEqual([]);
  });

  it('upper-cases the IFSC code and account type', async () => {
    const dto = await validateDto(
      { ...BODY, lbaIfscCode: ' hdfc0001234 ', lbaAccountType: 'current' },
      SaveLedgerBankAccountDto,
    );

    expect(dto).toMatchObject({ lbaIfscCode: 'HDFC0001234', lbaAccountType: 'CURRENT' });
  });

  it('trims the required text', async () => {
    const dto = await validateDto(
      { ...BODY, lbaAccountHolder: '  Acme ', lbaAccountNo: ' 123 ' },
      SaveLedgerBankAccountDto,
    );

    expect(dto).toMatchObject({ lbaAccountHolder: 'Acme', lbaAccountNo: '123' });
  });

  it('lets the optional text fields be cleared with null', async () => {
    await expect(
      refusedFields(
        { ...BODY, lbaCompanyId: null, lbaIfscCode: null, lbaUpiId: null, lbaRemarks: null },
        SaveLedgerBankAccountDto,
      ),
    ).resolves.toEqual([]);
  });

  it.each([
    ['no ledger', { ...BODY, lbaLedgerId: undefined }, 'lbaLedgerId'],
    ['a ledger that is not a uuid', { ...BODY, lbaLedgerId: 'ledger-1' }, 'lbaLedgerId'],
    ['a company that is not a uuid', { ...BODY, lbaCompanyId: 'company-1' }, 'lbaCompanyId'],
    ['a blank holder', { ...BODY, lbaAccountHolder: '  ' }, 'lbaAccountHolder'],
    ['a bank name over 200 characters', { ...BODY, lbaBankName: 'B'.repeat(201) }, 'lbaBankName'],
    [
      'an account number over 50 characters',
      { ...BODY, lbaAccountNo: '9'.repeat(51) },
      'lbaAccountNo',
    ],
    ['an IFSC code short of 11 characters', { ...BODY, lbaIfscCode: 'HDFC000' }, 'lbaIfscCode'],
    ['an IFSC code over 11 characters', { ...BODY, lbaIfscCode: 'HDFC00012345' }, 'lbaIfscCode'],
    ['a MICR code over 15 characters', { ...BODY, lbaMicrCode: '5'.repeat(16) }, 'lbaMicrCode'],
    ['a UPI id over 100 characters', { ...BODY, lbaUpiId: 'U'.repeat(101) }, 'lbaUpiId'],
    ['remarks over 250 characters', { ...BODY, lbaRemarks: 'M'.repeat(251) }, 'lbaRemarks'],
    ['a key the account does not have', { ...BODY, lbaSwiftCode: 'HDFCINBB' }, 'lbaSwiftCode'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveLedgerBankAccountDto)).resolves.toEqual([field]);
  });
});
