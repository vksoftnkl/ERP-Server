import { ValidationPipe } from '@nestjs/common';
import { SaveQuotationDto } from './save-quotation.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (payload: Record<string, unknown>): Promise<SaveQuotationDto> =>
  validationPipe.transform(
    {
      sqCompanyId: COMPANY_ID,
      sqBranchId: BRANCH_ID,
      sqAccYear: '2026-2027',
      sqPriceLevel: 1,
      sqCustName: 'Acme Traders',
      sqUserId: USER_ID,
      ...payload,
    },
    {
      type: 'body',
      metatype: SaveQuotationDto,
    },
  ) as Promise<SaveQuotationDto>;

// sq_freight_calc_type / sq_loading_calc_type are stored lower case, unlike the
// cd_method / chg_method columns they snapshot, so the DTO normalizes the case
// on the way in rather than trusting whatever the client typed.
describe('SaveQuotationDto — charge calc types are stored lower case', () => {
  it('lower-cases an uppercase value', async () => {
    const result = await transform({
      sqFreightCalcType: 'FIXED',
      sqLoadingCalcType: 'ITEM_BASIS',
    });

    expect(result.sqFreightCalcType).toBe('fixed');
    expect(result.sqLoadingCalcType).toBe('item_basis');
  });

  it('lower-cases mixed case and trims surrounding whitespace', async () => {
    const result = await transform({
      sqFreightCalcType: '  Net_Qty  ',
      sqLoadingCalcType: 'Percent',
    });

    expect(result.sqFreightCalcType).toBe('net_qty');
    expect(result.sqLoadingCalcType).toBe('percent');
  });

  it('leaves an already lower-case value alone', async () => {
    const result = await transform({ sqFreightCalcType: 'qty' });

    expect(result.sqFreightCalcType).toBe('qty');
  });

  it('folds null and the empty string to null, and leaves an omitted value undefined', async () => {
    const cleared = await transform({ sqFreightCalcType: null, sqLoadingCalcType: '' });
    expect(cleared.sqFreightCalcType).toBeNull();
    expect(cleared.sqLoadingCalcType).toBeNull();

    const untouched = await transform({});
    expect(untouched.sqFreightCalcType).toBeUndefined();
    expect(untouched.sqLoadingCalcType).toBeUndefined();
  });
});
