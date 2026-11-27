import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import type { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { SellingPriceBulkService, type PreparedBulkSave, type PurchaseSaveHooks } from './selling-price-bulk.service';
import { priceKeyLockId, type PriceBucketGateway, type BucketPriceCandidate, type RowCost } from './price-bucket.gateway';
import type { ScopeResolution } from './selling-price-scope.helper';
import type { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';

/**
 * Change Selling Price P2 review S5 / N1 (fix batch 2026-11-26) — every menu 30 / menu 244 /
 * purchase-view save locks its target price rows ONCE, in ipm_id order, before the first write
 * (the purchase post locks in the same order), and before that takes an advisory lock on each key
 * it will insert (keys first, then rows, for every writer). N2 / N4 — the purchase view's hooks
 * run in the order bill → prepare → locks (with the scheduled rows) → B5 → write → afterWrite.
 */
const CO = '01000000-0000-7000-8000-0000000000C1';
const BR = '01000000-0000-7000-8000-0000000000b1';
const ITEM = '01000000-0000-7000-8000-00000000a001';
const BOX = '01000000-0000-7000-8000-00000000b001';
const PCS = '01000000-0000-7000-8000-00000000b002';

describe('SellingPriceBulkService — the sorted locks (review S5 / N1)', () => {
  let order: string[];
  let found: Array<{ index: number; ipmId: string; effectiveFrom: string; future: boolean }>;
  let gateway: Record<string, jest.Mock>;
  let service: SellingPriceBulkService;
  const tx = {} as Prisma.TransactionClient;

  const candidate = (uomId: string, lineNo: number, mrp: number | null = null): BucketPriceCandidate =>
    ({ lineNo, companyId: CO, itemId: ITEM, uomId, mrp, salePrice: null, itemName: 'OIL', levels: [], costRate: 1, costWot: 1 }) as unknown as BucketPriceCandidate;
  const prepared = (): PreparedBulkSave =>
    ({
      dto: { companyId: CO, branchId: BR, rows: [{ itemId: ITEM, uomId: BOX }, { itemId: ITEM, uomId: PCS }] },
      actor: 'u',
      from: '2026-11-27',
      scheduledFrom: undefined,
      costs: [{} as RowCost, {} as RowCost],
      candidates: [candidate(BOX, 1), candidate(PCS, 2, 15)],
      resolutions: [
        { targetScope: 'CHAIN', targetBranchId: null } as ScopeResolution,
        { targetScope: 'BRANCH', targetBranchId: BR } as ScopeResolution,
      ],
      problems: [],
      belowCost: [],
    }) as unknown as PreparedBulkSave;

  beforeEach(() => {
    order = [];
    found = [{ index: 0, ipmId: 'ffff0000-0000-7000-8000-000000000001', effectiveFrom: '1900-01-01', future: false }];
    gateway = {
      findPriceRows: jest.fn(async (_tx: unknown, _probes: unknown, _day: unknown, opts: { future?: boolean }) => {
        order.push(`find:${opts.future === true}`);
        return opts.future
          ? [...found, { index: 0, ipmId: '00000000-0000-7000-8000-000000000009', effectiveFrom: '2026-12-01', future: true }]
          : found;
      }),
      lockPriceKeys: jest.fn(async (_tx: unknown, keys: string[]) => { order.push(`keys:${keys.length}`); }),
      lockPriceRows: jest.fn(async (_tx: unknown, ids: string[]) => { order.push(`rows:${ids.length}`); }),
      loadRowCosts: jest.fn(async (_tx: unknown, rows: unknown[]) => rows.map(() => ({}))),
      listNoStock: jest.fn(async () => []),
      snapshotRows: jest.fn(async () => new Map()),
    };
    service = new SellingPriceBulkService(
      { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as PrismaService,
      {} as AuditLogService,
      { getUserId: () => 'u', getUserType: () => 'SUPER ADMIN', getBranchId: () => BR } as unknown as RequestContextService,
      {} as AppSettingValueService,
      gateway as unknown as PriceBucketGateway,
      {} as PriceMasterWriter,
    );
    jest.spyOn(service, 'auditWrites').mockResolvedValue(new Map());
  });

  it('lockTargets: one search, the keys with no row yet locked first, then the rows found — once', async () => {
    const p = prepared();
    await service.lockTargets(tx, p);
    expect(order).toEqual(['find:false', 'keys:1', 'rows:1']);
    expect(gateway.findPriceRows).toHaveBeenCalledWith(tx, [
      { companyId: CO, branchId: null, itemId: ITEM, uomId: BOX, mrp: null, salePrice: null },
      { companyId: CO, branchId: BR, itemId: ITEM, uomId: PCS, mrp: 15, salePrice: null },
    ], undefined, { future: false });
    // PCS (index 1) has no row: its key is the one locked — the same text every writer builds
    expect(gateway.lockPriceKeys).toHaveBeenCalledWith(tx, [
      priceKeyLockId({ companyId: CO, branchId: BR, itemId: ITEM, uomId: PCS, mrp: 15, salePrice: null }),
    ]);
    // company / branch / item / unit lower-cased, the keys at 6 dp, none = -1
    expect(gateway.lockPriceKeys.mock.calls[0][1][0]).toBe([CO.toLowerCase(), BR, ITEM, PCS, '15.000000', '-1'].join('|'));
    expect(gateway.lockPriceRows).toHaveBeenCalledWith(tx, ['ffff0000-0000-7000-8000-000000000001']);
    expect(p).toMatchObject({ locked: true, futureRows: [] });
    await service.lockTargets(tx, p);
    expect(gateway.findPriceRows).toHaveBeenCalledTimes(1);
  });

  it('lockTargets({future}): the scheduled rows are locked with the rows and kept on prepared.futureRows (N4)', async () => {
    const p = prepared();
    await service.lockTargets(tx, p, { future: true });
    expect(gateway.lockPriceRows).toHaveBeenCalledWith(tx, ['ffff0000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000009']);
    expect(p.futureRows).toEqual([{ index: 0, ipmId: '00000000-0000-7000-8000-000000000009', effectiveFrom: '2026-12-01', future: true }]);
  });

  it('writeBulkInTx: the rows are locked before the FIRST write, not row by row in grid order', async () => {
    jest.spyOn(service, 'applyBucketPrice').mockImplementation(async (_tx, c) => {
      order.push(`write:${c.lineNo}`);
      return { ipmId: `id-${c.lineNo}`, before: null, lineNo: c.lineNo, itemName: 'OIL' };
    });
    await service.writeBulkInTx(tx, prepared(), { confirmed: false, via: null, policy: 'warning' });
    expect(order).toEqual(['find:false', 'keys:1', 'rows:1', 'write:1', 'write:2']);
  });

  it('saveBulk from the purchase view: bill FOR SHARE → prepare → locks (+ scheduled) → B5 → write (no second lock) → afterWrite(prepared)', async () => {
    const p = prepared();
    const s = service as unknown as Record<string, unknown>;
    jest.spyOn(service, 'assertCanEditPrices').mockResolvedValue(undefined);
    jest.spyOn(service, 'assertBranchAllowed').mockResolvedValue(undefined);
    jest.spyOn(s as never, 'assertScopeAllowed' as never).mockImplementation((() => undefined) as never);
    jest.spyOn(s as never, 'assertRowScopesAllowed' as never).mockImplementation((() => undefined) as never);
    jest.spyOn(s as never, 'resolveBelowCostPolicy' as never).mockImplementation((async () => 'warning') as never);
    jest.spyOn(service, 'prepareBulk').mockImplementation(async () => { order.push('prepare'); return p; });
    jest.spyOn(service, 'applyBucketPrice').mockImplementation(async (_tx, c) => {
      order.push(`write:${c.lineNo}`);
      return { ipmId: `id-${c.lineNo}`, before: null, lineNo: c.lineNo, itemName: 'OIL' };
    });
    const hooks: PurchaseSaveHooks = {
      beforePrepare: jest.fn(async () => { order.push('bill'); }),
      lockFuture: true,
      afterPrepare: jest.fn(async () => { order.push('b5'); }),
      reason: 'From purchase PI-1 (27-11-2026)',
      afterWrite: jest.fn(async (_tx, _result, prep) => { order.push(`after:${prep === p}`); }),
      fromPurchase: { piId: 'pi', accYear: '2026-2027', refno: 'PI-1' },
    };
    const out = await service.saveBulk({ companyId: CO, branchId: BR, rows: [] } as unknown as SaveSellingPriceBulkDto, hooks);
    expect(order).toEqual(['bill', 'prepare', 'find:true', 'keys:1', 'rows:2', 'b5', 'write:1', 'write:2', 'after:true']);
    expect(out).toMatchObject({ saved: 2, fromPurchase: { refno: 'PI-1' } });
  });
});
