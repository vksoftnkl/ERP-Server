import { BadRequestException } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import {
  CreateMobileCustomerDto,
  ListMobileCustomersQueryDto,
  UpdateMobileCustomerDto,
} from './mobile-customer.dto';

const CUS_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e104';
const BODY = {
  cusName: 'Sri Velan Agencies',
  cusStateName: 'Tamil Nadu',
  cusStateCode: '33',
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusPriceLevelId: 1,
};
const pipe = createHouseValidationPipe();

async function refusals(
  plain: object,
  metatype: new () => object,
  type: 'body' | 'query' = 'body',
): Promise<{ field: string; code: string }[]> {
  try {
    await pipe.transform(plain, { type, metatype });
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { errors: { field: string; code: string }[] }).errors;
  }
}

describe('mobile customer DTOs', () => {
  it('create takes the desktop payload', async () => {
    await expect(refusals(BODY, CreateMobileCustomerDto)).resolves.toEqual([]);
  });

  it('create keeps the desktop rules (state code, e-mail)', async () => {
    const fields = (
      await refusals(
        { ...BODY, cusStateCode: 'TNX', cusEmail: 'accounts@sva' },
        CreateMobileCustomerDto,
      )
    ).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['cusStateCode', 'cusEmail']));
  });

  it('create refuses a cusId: a create never turns into an update', async () => {
    await expect(refusals({ ...BODY, cusId: CUS_ID }, CreateMobileCustomerDto)).resolves.toEqual([
      expect.objectContaining({ field: 'cusId', code: 'VALIDATION_WHITELIST' }),
    ]);
  });

  it('update needs a cusId and refuses cusLinkLedId', async () => {
    await expect(refusals({ ...BODY, cusId: CUS_ID }, UpdateMobileCustomerDto)).resolves.toEqual(
      [],
    );
    expect((await refusals(BODY, UpdateMobileCustomerDto)).map((e) => e.field)).toContain('cusId');
    expect(
      (
        await refusals({ ...BODY, cusId: CUS_ID, cusLinkLedId: CUS_ID }, UpdateMobileCustomerDto)
      ).map((e) => e.field),
    ).toContain('cusLinkLedId');
  });

  it('list coerces the paging query and checks the filter and page size', async () => {
    const parsed = (await pipe.transform(
      { search: '  sri ', filter: 'OUTSTANDING', page: '2', pageSize: '25' },
      { type: 'query', metatype: ListMobileCustomersQueryDto },
    )) as ListMobileCustomersQueryDto;
    expect(parsed).toEqual(
      expect.objectContaining({ search: 'sri', filter: 'OUTSTANDING', page: 2, pageSize: 25 }),
    );

    const fields = (
      await refusals(
        { filter: 'OVERDUE', page: '0', pageSize: '500' },
        ListMobileCustomersQueryDto,
        'query',
      )
    ).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['filter', 'page', 'pageSize']));
  });
});
