import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { CreateMobileReceiptDto, MobileReceiptOptionsQueryDto } from './mobile-receipt.dto';

const UUID = '019c6f6c-be87-7a11-8905-36092c46e101';
const PHONE_UUID = '3b241101-e2bb-4255-8caf-4136c566a962';
const RECEIPT = {
  avhClientUuid: PHONE_UUID,
  deviceUid: 'phone-1',
  avhCompanyId: UUID,
  avhPartyId: UUID,
  avhVoucherDate: '2026-11-17',
  avhUsrRefno: 'A1B2/RC/2627/00001',
  avhRemarks: 'collected at the shop',
  tenders: [
    { tdTenderId: UUID, tdTenderTypeId: 1, tdAmount: 500 },
    {
      tdTenderId: UUID,
      tdTenderTypeId: 5,
      tdAmount: 1500,
      tdRefNo: '445123',
      tdBankName: 'KVB',
      tdInstrumentDate: '2026-11-20',
      cheque: { drawerName: 'Sri Velan Agencies' },
    },
  ],
};
const pipe = createHouseValidationPipe();

async function refusals(
  plain: object,
  metatype: new () => object,
): Promise<{ field: string; code: string }[]> {
  try {
    await pipe.transform(plain, { type: 'body', metatype });
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { errors: { field: string; code: string }[] }).errors;
  }
}

describe('CreateMobileReceiptDto', () => {
  it('takes the money, the party, the refs and the client uuid; the date is optional', async () => {
    await expect(refusals(RECEIPT, CreateMobileReceiptDto)).resolves.toEqual([]);
    const { avhVoucherDate: _d, avhUsrRefno: _r, avhRemarks: _m, ...bare } = RECEIPT;
    void _d;
    void _r;
    void _m;
    await expect(refusals(bare, CreateMobileReceiptDto)).resolves.toEqual([]);
  });

  it.each([
    ['avhVoucherId', UUID],
    ['avhBranchId', UUID],
    ['avhAccYear', '2026-2027'],
    ['avhTenantId', UUID],
    ['avhDeviceType', 'MOBILE'],
    ['avhDeviceId', 'x'],
    ['avhSessionId', UUID],
    ['avhUserId', UUID],
    ['avhEmployeeId', [UUID]],
    ['avhDocRefno', 'x'],
    ['otherLines', []],
    ['allocations', []],
    ['creditsApplied', []],
    ['otherLineBills', []],
    ['onAccount', 0],
    ['post', true],
    ['replace', true],
  ])('refuses the server-filled %s', async (key, value) => {
    const errors = await refusals({ ...RECEIPT, [key]: value }, CreateMobileReceiptDto);
    expect(errors).toContainEqual(
      expect.objectContaining({ field: key, code: 'VALIDATION_WHITELIST' }),
    );
  });

  it.each([
    ['tdId', UUID],
    ['tdRowNo', 1],
    ['tdTenderLedgerId', UUID],
    ['tdMdrAmt', 1],
    ['tdSurchargeAmt', 1],
    ['tdReceivedAmt', 500],
  ])('refuses the tender key %s', async (key, value) => {
    const errors = await refusals(
      { ...RECEIPT, tenders: [{ ...RECEIPT.tenders[0], [key]: value }] },
      CreateMobileReceiptDto,
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ field: `tenders.0.${key}`, code: 'VALIDATION_WHITELIST' }),
    );
  });

  it('needs the client uuid, the phone uid, the party and at least one instrument', async () => {
    const { avhClientUuid: _u, deviceUid: _d, avhPartyId: _p, ...bare } = RECEIPT;
    void _u;
    void _d;
    void _p;
    const fields = (await refusals({ ...bare, tenders: [] }, CreateMobileReceiptDto)).map(
      (e) => e.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining(['avhClientUuid', 'deviceUid', 'avhPartyId', 'tenders']),
    );
    const missing = await refusals({ ...RECEIPT, tenders: undefined }, CreateMobileReceiptDto);
    expect(missing).toContainEqual(
      expect.objectContaining({ field: 'tenders', code: 'VALIDATION_IS_ARRAY' }),
    );
  });

  it('an instrument needs its tender, type and amount', async () => {
    const fields = (await refusals({ ...RECEIPT, tenders: [{}] }, CreateMobileReceiptDto)).map(
      (e) => e.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        'tenders.0.tdTenderId',
        'tenders.0.tdTenderTypeId',
        'tenders.0.tdAmount',
      ]),
    );
  });
});

describe('MobileReceiptOptionsQueryDto', () => {
  it('needs the company and the phone uid', async () => {
    await expect(
      refusals({ companyId: UUID, deviceUid: 'phone-1' }, MobileReceiptOptionsQueryDto),
    ).resolves.toEqual([]);
    const fields = (await refusals({}, MobileReceiptOptionsQueryDto)).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['companyId', 'deviceUid']));
  });
});
