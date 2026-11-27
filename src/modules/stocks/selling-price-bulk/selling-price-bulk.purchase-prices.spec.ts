import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import type { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import { PriceBucketGateway, type BucketPriceCandidate, type RowCost } from './price-bucket.gateway';
import type { ScopeResolution } from './selling-price-scope.helper';
import { PurchasePriceStepService } from './purchase-price-step.service';
import type { PurchasePriceStepGateway, StepBill, StepBillLine } from './purchase-price-step.gateway';
import type { SellingPriceLineRow } from './types/selling-price-bulk.types';

/**
 * Purchase entry P9 (2026-11-02), carried into Change Selling Price P2 (plan 2026-11-24 §4.4,
 * PurchasePriceStepService.afterPurchase replaced applyPurchasePrices): in "Update cost and
 * prices" a bill line's MSP rides with the bought unit's prices, MSP FIRST — the prices are
 * judged against the bill's MSP and both are written in the one row write, or neither is (the
 * cost still moves: COST_ONLY). An MSP equal to the stored one is no change; a line with no
 * saved MSP leaves the item's minimum alone and is judged against it.
 */
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const CO = '01000000-0000-7000-8000-0000000000c1';
const BR = '01000000-0000-7000-8000-0000000000b1';
const ITEM = '01000000-0000-7000-8000-000000000002';
const UOM = '01000000-0000-7000-8000-000000000011';
const IPM = '01000000-0000-7000-8000-000000000041';

describe('PurchasePriceStepService.afterPurchase — the line MSP (P9)', () => {
  let stored: { min: number; prices: number[]; profitType: string };
  let applied: BucketPriceCandidate[];
  let line: Partial<StepBillLine>;
  let service: PurchasePriceStepService;
  const tx = {} as Prisma.TransactionClient;

  beforeEach(() => {
    stored = { min: 0, prices: [118, 112, 0, 0], profitType: 'By User' };
    applied = [];
    line = {};
    const row = () =>
      ({
        lineNo: 1, itemId: ITEM, itemName: 'Rice 25 Kg', uomId: UOM, unitName: 'BAG', mrp: null, salePrice: null, maxPrice: 0,
        priceScope: 'CHAIN', bucketId: IPM, minPrice: stored.min, roundOff: 0, taxPerc: 0, lineKind: 'HEADLINE', lineCost: 95,
        profitType: stored.profitType, unitFactor: 1, unitSlNo: 1, trackMrp: false, trackSalePrice: false, branchId: null,
        levels: stored.prices.map((price, i) => ({ level: i + 1, price, storedMarkupPerc: null })),
      }) as unknown as SellingPriceLineRow;
    const bill: StepBill = {
      piId: 'pi', accYear: '2026-2027', refno: 'PUR/1', companyId: CO, branchId: BR, branchName: 'HO', status: 'POSTED',
      docDate: '2026-11-02', docDatetime: new Date('2026-11-02T10:00:00+05:30'), supplierInvNo: null, supplierName: null, deviceId: null, policy: null,
    };
    const gateway = {
      readBill: jest.fn(async () => bill),
      readLines: jest.fn(async (): Promise<StepBillLine[]> => [{
        piiId: 'L1', lineNo: 1, itemId: ITEM, itemName: 'Rice 25 Kg', uomId: UOM, unitName: 'BAG', factor: D(1), billedQty: D(10), freeQty: D(0),
        rate: D(100), landedCostWot: D(100), mrp: null, sells: [null, null, null, null], minPrice: null, result: null, oldPrices: null,
        portions: [{ mrp: null, salePrice: null, baseQty: D(10) }], ...line,
      }]),
      stepSettings: jest.fn(async () => ({ belowCost: 'warning', skipMrp: false, defaultLevel: 1 })),
      lockRows: jest.fn(async () => new Map([[IPM, CO]])), laterLines: jest.fn(async () => []), newerChanges: jest.fn(async () => []),
      rowTokens: jest.fn(async () => new Map()), rowFigures: jest.fn(async () => new Map()),
    };
    const priceGateway = {
      priceLevels: jest.fn(async () => [1, 2, 3, 4].map((level) => ({ level, name: `L${level}`, active: true }))),
      loadRowCosts: jest.fn(async (): Promise<RowCost[]> => [{
        itemCode: 'RICE', itemName: 'Rice 25 Kg', uomBelongs: true, trackMrp: false, trackSalePrice: false, costRate: 95, costWot: 95,
        costBasis: 'ITEM', minPrice: stored.min, unitName: 'BAG', stockCostWot: null,
      }]),
      validateRows: jest.fn((c: BucketPriceCandidate[], m: number[], o: object) => PriceBucketGateway.prototype.validateRows.call({}, c, m, o)),
      findBucketRowForUpdate: jest.fn(async () => ({ ipmId: IPM, effectiveFrom: '1900-01-01', effectiveTo: '9999-12-31' })),
      // P2 review N4 / N1 — no scheduled rows; the key locks.
      findPriceRows: jest.fn(async () => []),
      lockPriceKeys: jest.fn(async () => undefined),
    };
    const bulk = new SellingPriceBulkService(
      {} as PrismaService, {} as AuditLogService, {} as RequestContextService, {} as AppSettingValueService,
      priceGateway as unknown as PriceBucketGateway, {} as PriceMasterWriter,
    );
    jest.spyOn(bulk, 'linesOfItems').mockImplementation(async () => [row()]);
    jest.spyOn(bulk, 'resolveItemTaxRates').mockImplementation(async () => new Map([[ITEM, { itemId: ITEM, taxId: null, taxPerc: 0, inclTax: false, hasCess: false }]]));
    jest.spyOn(bulk, 'auditWrites').mockImplementation(async () => new Map());
    jest.spyOn(bulk, 'applyBucketPrice').mockImplementation(async (_tx, candidate: BucketPriceCandidate, _scope: ScopeResolution) => {
      applied.push(candidate);
      return { ipmId: IPM, before: { ipm_id: IPM }, lineNo: 1, itemName: 'Rice 25 Kg' };
    });
    service = new PurchasePriceStepService(
      {} as PrismaService, {} as RequestContextService, {} as AuditLogService, bulk, priceGateway as unknown as PriceBucketGateway,
      gateway as unknown as PurchasePriceStepGateway, {} as PriceMasterWriter,
    );
  });

  const post = () =>
    service.afterPurchase(tx, {
      piId: 'pi', accYear: '2026-2027', mode: 'UPDATE_PRICES', actor: 'u', isHq: true,
      businessTime: new Date('2026-11-02T10:00:00+05:30'), canReview: true,
    });

  it('prices + a new MSP: one write carrying both', async () => {
    line = { sells: [D(130), null, null, null], minPrice: D(120) };
    const out = await post();
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(applied[0].minPrice).toBe(120);
    expect(applied[0].levels.map((l) => [l.level, l.price])).toEqual([[1, 130], [2, 112]]);
  });

  it("MSP first: the prices are judged against the bill's MSP, not the stored one", async () => {
    stored.min = 150;
    line = { sells: [D(130), null, null, null], minPrice: D(120) };
    expect((await post()).lines.get('L1')!.result).toBe('UPDATED');
    expect(applied[0].minPrice).toBe(120);
  });

  it("a price below the bill's own MSP: neither is written — the cost moves alone (COST_ONLY) and the note says so", async () => {
    line = { sells: [D(110), null, null, null], minPrice: D(120) };
    const out = await post();
    expect(out.lines.get('L1')!.result).toBe('COST_ONLY');
    expect(applied[0].minPrice).toBeNull();
    expect(applied[0].levels.map((l) => l.price)).toEqual([118, 112]);
    expect(out.notes[0]).toMatchObject({ code: 'PUR_PRICE_NOT_WRITTEN', lineNo: 1 });
    // S4 — rule=BELOW_MIN names the level, the price and the minimum
    expect(out.notes[0]).toMatchObject({ rule: 'BELOW_MIN', params: { n: 1, level: 'L1', price: '110.00', min: '120.00', item: 'Rice 25 Kg', unit: 'BAG' } });
    expect(out.notes[0].message).toContain('L1 110.00 of Rice 25 Kg BAG would be below its minimum price 120.00, so its prices were kept; its cost moved.');
  });

  it('an MSP equal to the stored one is no change (the row keeps its own)', async () => {
    stored.min = 120;
    line = { sells: [D(130), null, null, null], minPrice: D(120) };
    await post();
    expect(applied[0].minPrice).toBeNull();
  });

  it('0 clears a stored MSP', async () => {
    stored.min = 50;
    line = { sells: [D(130), null, null, null], minPrice: D(0) };
    await post();
    expect(applied[0].minPrice).toBe(0);
  });

  it("a bill line with NO saved MSP (null): the item's minimum is left alone, and the prices are still checked against it", async () => {
    stored.min = 100;
    line = { sells: [D(130), null, null, null], minPrice: null };
    expect((await post()).lines.get('L1')!.result).toBe('UPDATED');
    expect(applied[0].minPrice).toBeNull();
    applied = [];
    line = { sells: [D(90), null, null, null], minPrice: null };
    const low = await post();
    expect(low.lines.get('L1')!.result).toBe('COST_ONLY');
    expect(low.notes[0]).toMatchObject({ rule: 'BELOW_MIN', params: expect.objectContaining({ price: '90.00', min: '100.00' }) });
  });
});
