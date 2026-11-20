import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import {
  CreateMobileReceiptDto,
  MobileOpenBillsQueryDto,
  MobileReceiptOptionsQueryDto,
  MobileReceiptStatusQueryDto,
} from './mobile-receipt.dto';

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

  it("takes the phone's settlement, the picked branch and the shop's own number and date", async () => {
    await expect(
      refusals(
        {
          ...RECEIPT,
          avhBranchId: UUID,
          avhDocRefno: 'SHOP/77',
          avhDocDate: '2026-11-17',
          allocations: [
            { billId: UUID, billAccYear: '2026-2027', amount: 117.6, discount: 0, roundoff: 0.4 },
            { billId: PHONE_UUID, billAccYear: '2026-2027', amount: 50 },
          ],
          creditsApplied: [{ billId: UUID, billAccYear: '2026-2027', amount: 100 }],
          onAccount: 0,
        },
        CreateMobileReceiptDto,
      ),
    ).resolves.toEqual([]);
  });

  it.each([
    ['avhVoucherId', UUID],
    ['avhAccYear', '2026-2027'],
    ['avhTenantId', UUID],
    ['avhDeviceType', 'MOBILE'],
    ['avhDeviceId', 'x'],
    ['avhSessionId', UUID],
    ['avhUserId', UUID],
    ['avhEmployeeId', [UUID]],
    ['otherLines', []],
    ['otherLineBills', []],
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

  it.each([
    ['writeoff', 5],
    ['writeoffApprovedBy', UUID],
  ])('a phone may not write off: allocations[].%s is refused', async (key, value) => {
    const errors = await refusals(
      {
        ...RECEIPT,
        allocations: [{ billId: UUID, billAccYear: '2026-2027', amount: 10, [key]: value }],
      },
      CreateMobileReceiptDto,
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: `allocations.0.${key}`,
        code: 'VALIDATION_WHITELIST',
      }),
    );
  });

  it('an allocation needs its bill, year and a non-negative amount; a credit too', async () => {
    const fields = (
      await refusals(
        {
          ...RECEIPT,
          allocations: [{ amount: -1, discount: -2 }],
          creditsApplied: [{}],
          onAccount: -5,
          avhBranchId: 'not-a-uuid',
        },
        CreateMobileReceiptDto,
      )
    ).map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'allocations.0.billId',
        'allocations.0.billAccYear',
        'allocations.0.amount',
        'allocations.0.discount',
        'creditsApplied.0.billId',
        'creditsApplied.0.amount',
        'onAccount',
        'avhBranchId',
      ]),
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

describe('MobileOpenBillsQueryDto', () => {
  it('withCredits is an optional query boolean ("false" stays false)', async () => {
    await expect(
      refusals({ companyId: UUID, withCredits: 'true' }, MobileOpenBillsQueryDto),
    ).resolves.toEqual([]);
    const pipeOut = (await pipe.transform(
      { companyId: UUID, withCredits: 'false' },
      { type: 'query', metatype: MobileOpenBillsQueryDto },
    )) as MobileOpenBillsQueryDto;
    expect(pipeOut.withCredits).toBe(false);
  });
});

describe('MobileReceiptStatusQueryDto', () => {
  it('needs the company and the phone; since is an ISO instant', async () => {
    await expect(
      refusals(
        { companyId: UUID, deviceUid: 'phone-1', since: '2026-11-19T07:47:10.249Z', page: 2 },
        MobileReceiptStatusQueryDto,
      ),
    ).resolves.toEqual([]);
    const fields = (await refusals({ since: 'yesterday' }, MobileReceiptStatusQueryDto)).map(
      (e) => e.field,
    );
    expect(fields).toEqual(expect.arrayContaining(['companyId', 'deviceUid', 'since']));
  });
});
