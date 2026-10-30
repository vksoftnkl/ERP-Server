import { HttpException } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { GenerateCountSheetQueryDto } from './list-physical-stock-voucher-query.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b601';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b602';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b603';
const BRAND_ID = '019c6f6c-be87-7a11-8905-36092c46b604';
const CATEGORY_ID = '019c6f6c-be87-7a11-8905-36092c46b605';
const SECTION_ID = '019c6f6c-be87-7a11-8905-36092c46b606';

/** The fields the house ValidationPipe refused, or [] when it let the value through. */
async function refusedFields(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map((e) => e.field);
  }
}

describe('GenerateCountSheetQueryDto', () => {
  const sheet = (query: Record<string, unknown>) =>
    validateDto({ companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID, ...query }, GenerateCountSheetQueryDto, {
      type: 'query',
    });

  it('notes 157 — takes brand, category and section ids and negativeOnly from a query string', async () => {
    const query = await sheet({
      itemBrandId: BRAND_ID,
      itemCategoryId: CATEGORY_ID,
      itemSectionId: SECTION_ID,
      negativeOnly: 'true',
    });

    expect(query).toMatchObject({
      itemBrandId: BRAND_ID,
      itemCategoryId: CATEGORY_ID,
      itemSectionId: SECTION_ID,
      negativeOnly: true,
    });
  });

  it('leaves every one of them out when not sent', async () => {
    const query = await sheet({});

    expect(query.itemBrandId).toBeUndefined();
    expect(query.itemCategoryId).toBeUndefined();
    expect(query.itemSectionId).toBeUndefined();
    expect(query.negativeOnly).toBeUndefined();
  });

  it('refuses an id that is not a uuid, naming the field', async () => {
    await expect(refusedFields(sheet({ itemBrandId: 'nike' }))).resolves.toEqual(['itemBrandId']);
    await expect(refusedFields(sheet({ itemSectionId: '12' }))).resolves.toEqual(['itemSectionId']);
  });
});
