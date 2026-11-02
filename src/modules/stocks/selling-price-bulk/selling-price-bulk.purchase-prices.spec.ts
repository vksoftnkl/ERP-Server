import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import type { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import { PriceBucketGateway, type BucketPriceCandidate, type RowCost } from './price-bucket.gateway';

/**
 * Purchase entry P9 (2026-11-02) — a bill line's MSP rides in applyPurchasePrices, MSP FIRST:
 * the bill's prices are judged against the bill's MSP and both are written in the one row write,
 * or neither is. A line that changes only the MSP re-states the prices in force.
 */
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000002';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const TAX_ID = '01000000-0000-7000-8000-000000000031';
const IPM_ID = '01000000-0000-7000-8000-000000000041';
const COST = 95;

describe('SellingPriceBulkService.applyPurchasePrices — the line MSP (P9)', () => {
  let service: SellingPriceBulkService;
  let newerLog: unknown[];
  let stored: Partial<RowCost>;
  let s1Row: { ipmId: string } | null;
  let tx: Record<string, unknown>;
  let gateway: { loadRowCosts: jest.Mock; validateRows: jest.Mock; findBucketRowForUpdate: jest.Mock; snapshotRows: jest.Mock };
  let writer: { updateBucketPrice: jest.Mock; insertBucketPrice: jest.Mock };

  beforeEach(() => {
    newerLog = [];
    stored = { minPrice: 0, prices: [118, 112, 0, 0] };
    s1Row = { ipmId: IPM_ID };
    tx = {
      $queryRaw: jest.fn(() => Promise.resolve(newerLog)),
      itemMaster: { findMany: jest.fn().mockResolvedValue([{ itemId: ITEM_ID, itemDefaultTaxId: TAX_ID, itemInclTax: true }]) },
      itemTaxHistory: { findMany: jest.fn().mockResolvedValue([]) },
      taxRateMaster: { findMany: jest.fn().mockResolvedValue([{ taxId: TAX_ID, taxRatePerc: 18, taxCessBasis: 'NONE', taxAcessBasis: 'NONE' }]) },
    };
    gateway = {
      loadRowCosts: jest.fn((_tx: unknown, rows: unknown[]) =>
        Promise.resolve(rows.map(() => ({
          itemCode: 'RICE', itemName: 'Rice 25 Kg', uomBelongs: true, trackMrp: false, trackSalePrice: false,
          costRate: COST, costWot: COST / 1.18, costBasis: 'ITEM', minPrice: 0, ...stored,
        })))),
      // the real verdicts: above MRP, below the minimum, below cost
      validateRows: jest.fn((c: BucketPriceCandidate[], m: number[]) => PriceBucketGateway.prototype.validateRows.call({}, c, m)),
      findBucketRowForUpdate: jest.fn(() => Promise.resolve(s1Row)),
      snapshotRows: jest.fn((_tx: unknown, ids: string[]) => Promise.resolve(new Map(ids.map((id) => [id, { ipm_id: id }])))),
    };
    writer = { updateBucketPrice: jest.fn().mockResolvedValue(IPM_ID), insertBucketPrice: jest.fn().mockResolvedValue(IPM_ID) };
    service = new SellingPriceBulkService(
      {} as PrismaService, {} as AuditLogService, {} as RequestContextService, {} as AppSettingValueService,
      gateway as unknown as PriceBucketGateway, writer as unknown as PriceMasterWriter,
    );
  });

  const apply = (row: { levels?: { level: number; price: number }[]; minPrice?: number | null }) =>
    service.applyPurchasePrices(tx as never, {
      companyId: COMPANY_ID, branchId: BRANCH_ID, actor: 'u', billRef: 'PUR/1', businessTime: new Date('2026-11-02T10:00:00+05:30'),
      rows: [{ key: 'L1', itemId: ITEM_ID, uomId: UOM_ID, mrp: null, levels: row.levels ?? [], ...('minPrice' in row ? { minPrice: row.minPrice } : {}) }],
    });
  const written = (): BucketPriceCandidate => (writer.updateBucketPrice.mock.calls[0] ?? writer.insertBucketPrice.mock.calls[0])[writer.updateBucketPrice.mock.calls.length ? 2 : 1];

  it('prices + a new MSP: one write carrying both', async () => {
    const r = await apply({ levels: [{ level: 1, price: 130 }], minPrice: 120 });
    expect(r.get('L1')).toEqual({ result: 'UPDATED', note: null });
    expect(written().minPrice).toBe(120);
    expect(written().levels.map((l) => [l.level, l.price])).toEqual([[1, 130]]);
  });

  it('MSP first: the prices are judged against the bill\'s MSP, not the stored one', async () => {
    stored = { ...stored, minPrice: 150 };
    const r = await apply({ levels: [{ level: 1, price: 130 }], minPrice: 120 });
    expect(r.get('L1')!.result).toBe('UPDATED');
    expect(written().minPrice).toBe(120);
  });

  it('a price below the bill\'s own MSP: neither is written, and the note says so', async () => {
    const r = await apply({ levels: [{ level: 1, price: 110 }], minPrice: 120 });
    expect(r.get('L1')).toEqual({ result: 'NONE', note: 'Price not updated — Rice 25 Kg: 110 is below the minimum price 120. The MSP 120 is not written either.' });
    expect(writer.updateBucketPrice).not.toHaveBeenCalled();
    expect(writer.insertBucketPrice).not.toHaveBeenCalled();
  });

  it('an MSP equal to the stored one is no change (the row keeps its own)', async () => {
    stored = { ...stored, minPrice: 120 };
    await apply({ levels: [{ level: 1, price: 130 }], minPrice: 120 });
    expect(written().minPrice).toBeNull();
    writer.updateBucketPrice.mockClear();
    const only = await apply({ minPrice: 120 });
    expect(only.get('L1')).toEqual({ result: 'NONE', note: null });
    expect(writer.updateBucketPrice).not.toHaveBeenCalled();
  });

  it('MSP only: the prices in force are re-stated unchanged (S3 here — a new branch row keeps them)', async () => {
    s1Row = null;
    const r = await apply({ minPrice: 100 });
    expect(r.get('L1')!.result).toBe('UPDATED');
    const c = writer.insertBucketPrice.mock.calls[0][1] as BucketPriceCandidate;
    expect(c.minPrice).toBe(100);
    expect(c.levels.map((l) => [l.level, l.price])).toEqual([[1, 118], [2, 112]]);
  });

  it('MSP only, but the in-force prices are below the new MSP: nothing is written', async () => {
    const r = await apply({ minPrice: 115 });
    expect(r.get('L1')!.result).toBe('NONE');
    expect(r.get('L1')!.note).toContain('112 is below the minimum price 115');
    expect(writer.updateBucketPrice).not.toHaveBeenCalled();
  });

  it('MSP only with no price row for the unit: nothing to hang it on', async () => {
    stored = { minPrice: 0 };
    delete stored.prices;
    const r = await apply({ minPrice: 100 });
    expect(r.get('L1')).toEqual({ result: 'NONE', note: 'MSP 100 not written — the item has no selling price for this unit here; set its prices first.' });
  });

  it('0 clears a stored MSP', async () => {
    stored = { ...stored, minPrice: 50 };
    await apply({ levels: [{ level: 1, price: 130 }], minPrice: 0 });
    expect(written().minPrice).toBe(0);
  });

  it('no MSP sent (the GRN): as before — prices only, the stored minimum stands', async () => {
    stored = { ...stored, minPrice: 100 };
    const r = await apply({ levels: [{ level: 1, price: 130 }] });
    expect(r.get('L1')!.result).toBe('UPDATED');
    expect(written().minPrice).toBeNull();
    expect((await apply({})).get('L1')).toEqual({ result: 'NONE', note: null });
  });

  it('a bill line with NO saved MSP (null): the item\'s minimum is left alone, and the prices are still checked against it', async () => {
    stored = { ...stored, minPrice: 100 };
    const ok = await apply({ levels: [{ level: 1, price: 130 }], minPrice: null });
    expect(ok.get('L1')!.result).toBe('UPDATED');
    expect(written().minPrice).toBeNull();
    writer.updateBucketPrice.mockClear();
    const low = await apply({ levels: [{ level: 1, price: 90 }], minPrice: null });
    expect(low.get('L1')).toEqual({ result: 'NONE', note: 'Price not updated — Rice 25 Kg: 90 is below the minimum price 100.' });
    expect(writer.updateBucketPrice).not.toHaveBeenCalled();
    expect((await apply({ minPrice: null })).get('L1')).toEqual({ result: 'NONE', note: null });
  });

  it('D16: a change logged after the bill keeps the row — MSP included', async () => {
    newerLog = [{ item_id: ITEM_ID, unit_id: UOM_ID, at: new Date('2026-11-02T11:00:00+05:30'), who: 'admin', source: 'ITEM_CARD' }];
    const r = await apply({ minPrice: 100 });
    expect(r.get('L1')!.result).toBe('KEPT_NEWER');
    expect(gateway.loadRowCosts).not.toHaveBeenCalled();
  });
});
