import { CACHE_TTL_METADATA } from '@nestjs/cache-manager';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SellingPriceBulkController } from './selling-price-bulk.controller';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import type { PurchasePriceStepService } from './purchase-price-step.service';
import type { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import type { SellingPriceRow, SellingPriceSaveResult } from './types/selling-price-bulk.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';

const ROW = { lineNo: 1, itemId: ITEM_ID } as SellingPriceRow;
const SAVED: SellingPriceSaveResult = {
  saved: 2,
  effectiveFrom: '2026-06-15',
  rows: [],
  masterRowsSaved: 0,
  noStock: [],
  needsConfirm: false,
  problems: [],
  belowCostPolicy: 'warning',
};

describe('SellingPriceBulkController', () => {
  let service: {
    listPriceLines: jest.Mock;
    listBuckets: jest.Mock;
    saveBulk: jest.Mock;
    buildSaveMessage: jest.Mock;
    backToAllBranches: jest.Mock;
  };
  let controller: SellingPriceBulkController;
  let step: { purchaseLines: jest.Mock; saveFromPurchase: jest.Mock };

  beforeEach(() => {
    service = {
      listPriceLines: jest.fn(),
      listBuckets: jest.fn(),
      backToAllBranches: jest.fn(),
      saveBulk: jest.fn().mockResolvedValue(SAVED),
      buildSaveMessage: jest.fn().mockReturnValue('2 prices saved.'),
    };
    step = { purchaseLines: jest.fn(), saveFromPurchase: jest.fn().mockResolvedValue(SAVED) };
    controller = new SellingPriceBulkController(
      service as unknown as SellingPriceBulkService,
      step as unknown as PurchasePriceStepService,
    );
  });

  // ── P2: the purchase view and its save ───────────────────────────────────
  it('GET price-bulk/purchase-lines wraps the view, naming the bill, its items and lines', async () => {
    const view = { bill: { refno: 'PUR/1' }, items: [ROW, ROW], meta: { items: 1, lines: 2 } };
    step.purchaseLines.mockResolvedValue(view);
    const q = { companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: '2026-2027', piId: ITEM_ID };
    await expect(controller.purchaseLines(q)).resolves.toEqual({ success: true, message: 'PUR/1: 1 item, 2 lines', data: view });
    expect(step.purchaseLines).toHaveBeenCalledWith(q);
  });

  it('POST price-bulk with fromPurchase goes through the purchase step; without it, P1 exactly', async () => {
    const dto = { companyId: COMPANY_ID, branchId: BRANCH_ID, rows: [], fromPurchase: { piId: ITEM_ID, accYear: '2026-2027' } } as unknown as SaveSellingPriceBulkDto;
    await controller.saveBulk(dto);
    expect(step.saveFromPurchase).toHaveBeenCalledWith(dto);
    expect(service.saveBulk).not.toHaveBeenCalled();
    const plain = { companyId: COMPANY_ID, branchId: BRANCH_ID, rows: [] } as unknown as SaveSellingPriceBulkDto;
    await controller.saveBulk(plain);
    expect(service.saveBulk).toHaveBeenCalledWith(plain);
  });

  // ── GET price-bulk (P1: the lines of a page of items) ─────────────────────
  it.each([
    [[ROW], 1, '1 item, 1 line loaded'],
    [[ROW, ROW, ROW], 2, '2 items, 3 lines loaded'],
    [[], 0, '0 items, 0 lines loaded'],
  ])('wraps a page of %#, counting its items and lines', async (items, count, message) => {
    const page = { items, meta: { limit: 200, offset: 0, count, lines: items.length } };
    service.listPriceLines.mockResolvedValue(page);
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID };

    await expect(controller.listPrices(query)).resolves.toEqual({
      success: true,
      message,
      data: page,
    });
    expect(service.listPriceLines).toHaveBeenCalledWith(query);
  });

  // ── POST price-bulk/back-to-all-branches (P1 §7.3) ────────────────────────
  it('sends a line back to all branches and says how many own rows went', async () => {
    const answer = {
      removed: 2,
      removedIds: ['a', 'b'],
      nowPricedBy: { lineKind: 'MRP', branchId: null, ipmId: 'c', prices: [505, 530, 0, 0] },
    };
    service.backToAllBranches.mockResolvedValue(answer);
    const dto = { companyId: COMPANY_ID, branchId: BRANCH_ID, ipmId: ITEM_ID };

    await expect(controller.backToAllBranches(dto)).resolves.toEqual({
      success: true,
      message: '2 own price lines removed — the branch reads the All branches price again',
      data: answer,
    });
    expect(service.backToAllBranches).toHaveBeenCalledWith(dto);
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
    for (const route of ['listPrices', 'listBuckets', 'saveBulk', 'backToAllBranches'] as const) {
      expect(
        // Only reflected on, never called.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Reflect.getMetadata(CACHE_TTL_METADATA, SellingPriceBulkController.prototype[route]),
      ).toBeUndefined();
    }
  });
});
