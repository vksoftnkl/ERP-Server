import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { CreateMobileBillDto, MobileBillOptionsQueryDto } from './mobile-bill.dto';

const UUID = '019c6f6c-be87-7a11-8905-36092c46e101';
const PHONE_UUID = '3b241101-e2bb-4255-8caf-4136c566a962'; // a v4, as phones make them
const BILL = {
  sbClientUuid: PHONE_UUID,
  deviceUid: 'phone-1',
  sbCompanyId: UUID,
  sbCustId: UUID,
  sbCustName: 'Sri Velan Agencies',
  sbPriceLevel: 1,
  sbBillDate: '2026-11-17',
  sbBillDatetime: '2026-11-17T10:42:00+05:30',
  sbUsrRefno: 'A1B2/2627/00001',
  sbBillType: 'CREDIT',
  sbTotItems: 1,
  sbGrossAmt: 100,
  sbTaxableAmt: 100,
  sbCgstAmt: 9,
  sbSgstAmt: 9,
  sbTaxAmt: 18,
  sbBillAmt: 118,
  sbRemarks: 'van sale',
  items: [
    {
      sbiItemId: UUID,
      sbiItemUnitId: UUID,
      sbiGodownId: UUID,
      sbiBillQty: 2,
      sbiNetQty: 2,
      sbiRate: 50,
      sbiTaxableAmt: 100,
      sbiNetAmt: 118,
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

describe('CreateMobileBillDto', () => {
  it('takes the desktop sb* / sbi* payload with the client uuid and the phone uid', async () => {
    await expect(refusals(BILL, CreateMobileBillDto)).resolves.toEqual([]);
  });

  it.each([
    ['sbId', UUID],
    ['sbBranchId', UUID],
    ['sbTenantId', UUID],
    ['sbAccYear', '2026-2027'],
    ['sbSessionId', UUID],
    ['sbCounterId', UUID],
    ['sbDeviceType', 'POS'],
    ['sbDeviceId', 'x'],
    ['sbBillSlno', 5],
    ['sbBillRefno', 'bil00005'],
    ['sbBillMode', 'POS'],
    ['sbStatus', 'POSTED'],
    ['post', true],
    ['tenders', []],
    ['charges', []],
    ['adjustments', []],
    ['sbPostedVoucherId', UUID],
    ['sbDocRegisterId', UUID],
    ['sbCreatedBy', 'x'],
    ['sbModifiedBy', 'x'],
    ['sbUserId', UUID],
    ['sbSrcDocId', UUID],
  ])('refuses the server-filled %s', async (key, value) => {
    const errors = await refusals({ ...BILL, [key]: value }, CreateMobileBillDto);
    expect(errors).toContainEqual(
      expect.objectContaining({ field: key, code: 'VALIDATION_WHITELIST' }),
    );
  });

  it.each([
    ['sbiId', UUID],
    ['sbiBillId', UUID],
    ['sbiCompanyId', UUID],
    ['sbiBranchId', UUID],
    ['sbiTenantId', UUID],
    ['sbiAccYear', '2026-2027'],
    ['sbiSrcDocId', UUID],
    ['sbiSrcItemId', UUID],
    ['sbiCreatedBy', 'x'],
  ])('refuses the line key %s', async (key, value) => {
    const errors = await refusals(
      { ...BILL, items: [{ ...BILL.items[0], [key]: value }] },
      CreateMobileBillDto,
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ field: `items.0.${key}`, code: 'VALIDATION_WHITELIST' }),
    );
  });

  it('needs the client uuid, the phone uid, at least one line and a godown on every line', async () => {
    const { sbClientUuid: _u, deviceUid: _d, ...bare } = BILL;
    void _u;
    void _d;
    const fields = (await refusals({ ...bare, items: [] }, CreateMobileBillDto)).map(
      (e) => e.field,
    );
    expect(fields).toEqual(expect.arrayContaining(['sbClientUuid', 'deviceUid', 'items']));

    const { sbiGodownId: _g, ...noGodown } = BILL.items[0];
    void _g;
    const lineFields = (await refusals({ ...BILL, items: [noGodown] }, CreateMobileBillDto)).map(
      (e) => e.field,
    );
    expect(lineFields).toEqual(['items.0.sbiGodownId']);
  });

  it('a phone bill is CREDIT: omitted is fine, credit in any case is fine, CASH is refused', async () => {
    const { sbBillType: _t, ...noType } = BILL;
    void _t;
    await expect(refusals(noType, CreateMobileBillDto)).resolves.toEqual([]);
    await expect(refusals({ ...BILL, sbBillType: 'credit' }, CreateMobileBillDto)).resolves.toEqual(
      [],
    );
    const errors = await refusals({ ...BILL, sbBillType: 'CASH' }, CreateMobileBillDto);
    expect(errors).toEqual([
      expect.objectContaining({ field: 'sbBillType', code: 'VALIDATION_IS_IN' }),
    ]);
  });

  it('keeps the desktop choices a phone may make: voucher type, delivery mode, overrides', async () => {
    await expect(
      refusals(
        { ...BILL, sbVchrTypeId: 3, sbDeliveryMode: 'instant', overrides: ['SALES_CREDIT_LIMIT'] },
        CreateMobileBillDto,
      ),
    ).resolves.toEqual([]);
  });
});

describe('MobileBillOptionsQueryDto', () => {
  it('needs the company and the phone uid', async () => {
    await expect(
      refusals({ companyId: UUID, deviceUid: 'phone-1' }, MobileBillOptionsQueryDto),
    ).resolves.toEqual([]);
    const fields = (await refusals({}, MobileBillOptionsQueryDto)).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['companyId', 'deviceUid']));
  });
});
