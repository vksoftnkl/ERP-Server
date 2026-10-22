import { CACHE_TTL_METADATA } from '@nestjs/cache-manager';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SellingPriceBulkController } from './selling-price-bulk.controller';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import type { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import type { SellingPriceRow, SellingPriceSaveResult } from './types/selling-price-bulk.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';

const ROW = { lineNo: 1, itemId: ITEM_ID } as SellingPriceRow;
const SAVED: SellingPriceSaveResult = {
  saved: 2,
  masterRowsSaved: 0,
  noStock: [],
  needsConfirm: false,
  problems: [],
  belowCostPolicy: 'warning',
};

describe('SellingPriceBulkController', () => {
  let service: {
    listPrices: jest.Mock;
    listBuckets: jest.Mock;
    saveBulk: jest.Mock;
    buildSaveMessage: jest.Mock;
  };
  let controller: SellingPriceBulkController;

  beforeEach(() => {
    service = {
      listPrices: jest.fn(),
      listBuckets: jest.fn(),
      saveBulk: jest.fn().mockResolvedValue(SAVED),
      buildSaveMessage: jest.fn().mockReturnValue('2 prices saved.'),
    };
    controller = new SellingPriceBulkController(service as unknown as SellingPriceBulkService);
  });

  // ── GET price-bulk ────────────────────────────────────────────────────────
  it.each([
    [[ROW], '1 row loaded'],
    [[ROW, ROW, ROW], '3 rows loaded'],
    [[], '0 rows loaded'],
  ])('wraps a page of %#, counting its rows', async (items, message) => {
    const page = { items, meta: { limit: 200, offset: 0, count: items.length } };
    service.listPrices.mockResolvedValue(page);
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID };

    await expect(controller.listPrices(query)).resolves.toEqual({
      success: true,
      message,
      data: page,
    });
    expect(service.listPrices).toHaveBeenCalledWith(query);
  });

  // ── GET price-buckets/:itemId ─────────────────────────────────────────────
  it.each([
    [[ROW], '1 price row found'],
    [[ROW, ROW], '2 price rows found'],
  ])('wraps the bucket list of one item, counting its rows', async (rows, message) => {
    service.listBuckets.mockResolvedValue(rows);
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID };

    await expect(controller.listBuckets({ itemId: ITEM_ID }, query)).resolves.toEqual({
      success: true,
      message,
      data: rows,
    });
    expect(service.listBuckets).toHaveBeenCalledWith(ITEM_ID, query);
  });

  it('refuses a path itemId that is not a uuid', () => {
    const [ParamDto] = Reflect.getMetadata(
      'design:paramtypes',
      SellingPriceBulkController.prototype,
      'listBuckets',
    ) as [new () => object];

    const fieldsOf = (plain: object) =>
      validateSync(plainToInstance(ParamDto, plain)).map((error) => error.property);

    expect(fieldsOf({ itemId: ITEM_ID })).toEqual([]);
    expect(fieldsOf({ itemId: 'salt' })).toEqual(['itemId']);
    expect(fieldsOf({})).toEqual(['itemId']);
  });

  // ── POST price-bulk ───────────────────────────────────────────────────────
  it('saves and words the answer with the message the service builds from the result', async () => {
    const dto = { companyId: COMPANY_ID, branchId: BRANCH_ID } as SaveSellingPriceBulkDto;

    await expect(controller.saveBulk(dto)).resolves.toEqual({
      success: true,
      message: '2 prices saved.',
      data: SAVED,
    });
    expect(service.saveBulk).toHaveBeenCalledWith(dto);
    expect(service.buildSaveMessage).toHaveBeenCalledWith(SAVED);
  });

  // The README's trap 5: live stock beside live prices, written back — never cached.
  it('caches nothing, on the controller or on any route', () => {
    expect(Reflect.getMetadata(CACHE_TTL_METADATA, SellingPriceBulkController)).toBeUndefined();
    for (const route of ['listPrices', 'listBuckets', 'saveBulk'] as const) {
      expect(
        Reflect.getMetadata(CACHE_TTL_METADATA, SellingPriceBulkController.prototype[route]),
      ).toBeUndefined();
    }
  });
});
