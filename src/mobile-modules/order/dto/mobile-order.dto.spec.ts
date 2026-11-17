import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { CreateMobileVisitDto } from '../../visit/dto/mobile-visit.dto';
import { CreateMobileOrderDto } from './mobile-order.dto';

const UUID = '019c6f6c-be87-7a11-8905-36092c46e101';
const PHONE_UUID = '3b241101-e2bb-4255-8caf-4136c566a962'; // a v4, as phones make them
const ORDER = {
  soClientUuid: PHONE_UUID,
  deviceUid: 'phone-1',
  soCompanyId: UUID,
  soCustId: UUID,
  soCustName: 'Sri Velan Agencies',
  soPriceLevel: 1,
  items: [{ soiItemId: UUID, soiItemUnitId: UUID, soiOrderQty: 2 }],
};
const VISIT = {
  cvClientUuid: PHONE_UUID,
  cvCompanyId: UUID,
  deviceUid: 'phone-1',
  cvCustId: UUID,
  cvSalesmanId: UUID,
  cvReasonCode: 'noOrder',
  cvVisitAt: '2026-11-16T10:42:00+05:30',
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

describe('CreateMobileOrderDto', () => {
  it('takes the desktop so* / soi* payload with the client uuid and the phone uid', async () => {
    await expect(refusals(ORDER, CreateMobileOrderDto)).resolves.toEqual([]);
  });

  it.each(['soBranchId', 'soAccYear', 'soDeviceId', 'soOrderRefno', 'soStatus', 'post', 'tenders'])(
    'refuses the server-filled %s',
    async (key) => {
      const errors = await refusals(
        { ...ORDER, [key]: key === 'post' ? true : 'x' },
        CreateMobileOrderDto,
      );
      expect(errors).toContainEqual(expect.objectContaining({ code: 'VALIDATION_WHITELIST' }));
    },
  );

  it('refuses a line scope key', async () => {
    const errors = await refusals(
      { ...ORDER, items: [{ ...ORDER.items[0], soiBranchId: UUID }] },
      CreateMobileOrderDto,
    );
    expect(errors).toContainEqual(expect.objectContaining({ code: 'VALIDATION_WHITELIST' }));
  });

  it('needs the client uuid, the phone uid and at least one line', async () => {
    const { soClientUuid: _u, deviceUid: _d, ...bare } = ORDER;
    void _u;
    void _d;
    const fields = (await refusals({ ...bare, items: [] }, CreateMobileOrderDto)).map(
      (e) => e.field,
    );
    expect(fields).toEqual(expect.arrayContaining(['soClientUuid', 'deviceUid', 'items']));
  });

  it('soUserId is optional', async () => {
    await expect(refusals({ ...ORDER, soUserId: UUID }, CreateMobileOrderDto)).resolves.toEqual([]);
  });
});

describe('CreateMobileVisitDto', () => {
  it('takes a check-in, with or without a position', async () => {
    await expect(refusals(VISIT, CreateMobileVisitDto)).resolves.toEqual([]);
    await expect(
      refusals(
        { ...VISIT, cvLatitude: 11.1, cvLongitude: 77.3, cvGpsAccuracy: 5 },
        CreateMobileVisitDto,
      ),
    ).resolves.toEqual([]);
  });

  it('refuses an unknown reason, an out-of-range position and a time with no date', async () => {
    const fields = (
      await refusals(
        { ...VISIT, cvReasonCode: 'closed', cvLatitude: 91, cvLongitude: 0, cvVisitAt: '10:42' },
        CreateMobileVisitDto,
      )
    ).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['cvReasonCode', 'cvLatitude', 'cvVisitAt']));
  });
});
