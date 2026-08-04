import { ValidationPipe } from '@nestjs/common';
import { SaveBillDto } from './save-bill.dto';

const COMPANY_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH_ID = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const CUST_ID = '019f659c-3942-7237-89b0-c4899603dd7a';
const USER_ID = '019e441b-6e48-7918-b246-b857ffb35db1';
const SALESMAN_ID = '019e441b-6e48-7918-b246-b857ffb35d01';
const LOADMAN_ID = '019e441b-6e48-7918-b246-b857ffb35d02';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (payload: Record<string, unknown>): Promise<SaveBillDto> =>
  validationPipe.transform(
    {
      sbCompanyId: COMPANY_ID,
      sbBranchId: BRANCH_ID,
      sbAccYear: '2026-2027',
      sbDeviceType: 'Desktop',
      sbDeviceId: '44c01ccc-a162-8314-34b0-1dbf2f5c7bab',
      sbPriceLevel: 1,
      sbCustId: CUST_ID,
      sbCustName: 'Karthik',
      sbUserId: USER_ID,
      ...payload,
    },
    {
      type: 'body',
      metatype: SaveBillDto,
    },
  ) as Promise<SaveBillDto>;

// sbSalesmanId / sbLoadmanId / sbPackedId are uuid[] columns, and a Prisma
// scalar list has no nullable form: a `null` reaching tx.saleBill.create() makes
// the data fall through to the checked input variant, which then fails on the
// unrelated-looking "Argument `customer` is missing". The DTO is the choke
// point that keeps null out.
describe('SaveBillDto — uuid[] fields never carry null', () => {
  it('clears an explicit null to an empty array', async () => {
    const result = await transform({
      sbSalesmanId: null,
      sbLoadmanId: null,
      sbPackedId: null,
    });

    expect(result.sbSalesmanId).toEqual([]);
    expect(result.sbLoadmanId).toEqual([]);
    expect(result.sbPackedId).toEqual([]);
  });

  it('clears an empty string to an empty array', async () => {
    const result = await transform({ sbSalesmanId: '' });

    expect(result.sbSalesmanId).toEqual([]);
  });

  it('leaves an omitted field undefined, so the column is untouched', async () => {
    const result = await transform({});

    expect(result.sbSalesmanId).toBeUndefined();
    expect(result.sbLoadmanId).toBeUndefined();
    expect(result.sbPackedId).toBeUndefined();
  });

  it('keeps an array as-is and splits a comma-separated string', async () => {
    const result = await transform({
      sbSalesmanId: [SALESMAN_ID],
      sbLoadmanId: `${SALESMAN_ID}, ${LOADMAN_ID}`,
    });

    expect(result.sbSalesmanId).toEqual([SALESMAN_ID]);
    expect(result.sbLoadmanId).toEqual([SALESMAN_ID, LOADMAN_ID]);
  });

  it('still rejects a non-uuid entry', async () => {
    await expect(transform({ sbSalesmanId: ['not-a-uuid'] })).rejects.toThrow();
  });
});
