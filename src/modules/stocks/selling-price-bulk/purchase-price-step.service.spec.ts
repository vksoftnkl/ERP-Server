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
import type {
  LaterLine,
  NewerChange,
  PurchasePriceStepGateway,
  StepBill,
  StepBillLine,
} from './purchase-price-step.gateway';
import type {
  PurchaseOldPriceEntry,
  PurchasePriceMode,
  SellingPriceLineRow,
} from './types/selling-price-bulk.types';

/**
 * Change Selling Price P2 — PurchasePriceStepService (plan 2026-11-24 §7.5, addendum 1 §7):
 * the post's price step per mode, B5 (lock then read, company vs branch), D16, the policy
 * table (below cost, above a bucket MRP, U1 above a typed MRP / skip_mrp, S4 hidden levels),
 * NO_LINE vs a line made from typed prices (Q9), the scope table incl. "→ this branch",
 * free goods, pii_old_prices, the view's order (decision 24), Cancel's put-back, and the view
 * save's B5 re-check.
 */
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const CO = '01000000-0000-7000-8000-0000000000c1';
const BR = '01000000-0000-7000-8000-0000000000b1';
const BR2 = '01000000-0000-7000-8000-0000000000b2';
const OIL = '01000000-0000-7000-8000-00000000a001';
const BRU = '01000000-0000-7000-8000-00000000a002';
const BOX = '01000000-0000-7000-8000-00000000b001';
const PCS = '01000000-0000-7000-8000-00000000b002';
const BRU_PCS = '01000000-0000-7000-8000-00000000b003';
const IPM_BOX = '01000000-0000-7000-8000-00000000c001';
const IPM_PCS = '01000000-0000-7000-8000-00000000c002';
const IPM_BRU_HEAD = '01000000-0000-7000-8000-00000000c003';
const IPM_BRU_560 = '01000000-0000-7000-8000-00000000c004';
const USER = '01000000-0000-7000-8000-0000000000e1';

function lineRow(over: Partial<SellingPriceLineRow> & { prices?: number[]; stored?: (number | null)[] }): SellingPriceLineRow {
  const prices = over.prices ?? [0, 0, 0, 0];
  const stored = over.stored ?? [null, null, null, null];
  const row = {
    lineNo: 1, itemId: OIL, itemCode: 'OIL', barcode: null, itemName: 'GOLD WINNER OIL 1L', uomId: BOX, unitName: 'BOX',
    stockQty: 0, mrp: null, salePrice: null, maxPrice: 0, priceSource: 'MASTER', priceScope: 'CHAIN', bucketId: IPM_BOX,
    costRate: 0, costWot: 0, costBasis: null, minPrice: 0, roundOff: 1, taxPerc: 5, inclTax: false, hasCess: false,
    lineKind: 'HEADLINE', lineCost: 1361.18, lineCostWot: 1296.361905, stockCost: null, stockCostWot: null, stockCostBasis: null,
    otherBranchesStockCost: null, profitType: 'By %', companyId: CO, companyName: 'ZT', branchId: null, branchName: null,
    unitFactor: 12, unitSlNo: 1, isDefaultUnit: false, itemGroupName: null, taxName: 'GST 5%', trackPresetName: null,
    trackMrp: false, trackSalePrice: false, itemCompanyId: CO, itemStockQty: 0, itemStockUnit: null,
    ...over,
  } as Record<string, unknown>;
  row.levels = [1, 2, 3, 4].map((level) => ({
    level, price: prices[level - 1] ?? 0, priceWot: 0, markupPerc: 0, marginPerc: 0, storedMarkupPerc: stored[level - 1] ?? null,
  }));
  delete row.prices;
  delete row.stored;
  return row as unknown as SellingPriceLineRow;
}

/** E1's two All branches lines: BOX By % R.Off 1, PCS By Rs R.Off 0.10. */
const oilRows = (box: Partial<SellingPriceLineRow> & { prices?: number[]; stored?: (number | null)[] } = {}, pcs: Partial<SellingPriceLineRow> & { prices?: number[] } = {}) => [
  lineRow({ prices: [1565, 1633, 0, 0], stored: [15, 20], ...box }),
  lineRow({
    uomId: PCS, unitName: 'PCS', bucketId: IPM_PCS, unitFactor: 1, unitSlNo: 2, isDefaultUnit: true,
    profitType: 'By Rs', roundOff: 0.1, lineCost: 113.43, lineCostWot: 108.028571, prices: [134.4, 140, 0, 0], ...pcs,
  }),
];

function billLine(over: Partial<StepBillLine> = {}): StepBillLine {
  return {
    piiId: 'L1', lineNo: 1, itemId: OIL, itemName: 'GOLD WINNER OIL 1L', uomId: BOX, unitName: 'BOX', factor: D(12),
    billedQty: D(10), freeQty: D(0), rate: D('1348.22'), landedCostWot: D('112.351667'), mrp: null,
    sells: [null, null, null, null], minPrice: null, result: null, oldPrices: null,
    portions: [{ mrp: null, salePrice: null, baseQty: D(120) }],
    ...over,
  };
}

const BILL: StepBill = {
  piId: '01000000-0000-7000-8000-0000000000f1', accYear: '2026-2027', refno: 'PI-00123', companyId: CO, branchId: BR,
  branchName: 'Head Office', status: 'POSTED', docDate: '2026-11-12', docDatetime: new Date('2026-11-12T10:00:00+05:30'),
  supplierInvNo: 'SBT/4471', supplierName: 'Sri Balaji Traders', deviceId: null, policy: { priceUpdate: 'UPDATE_PRICES', allowPriceUpdate: true },
};

describe('PurchasePriceStepService', () => {
  let rows: SellingPriceLineRow[];
  let lines: StepBillLine[];
  let later: LaterLine[];
  let newer: NewerChange[];
  let settings: { belowCost: 'restrict' | 'warning' | 'allow'; skipMrp: boolean; defaultLevel: number };
  let levels: Array<{ level: number; name: string; active: boolean }>;
  let stockCost: Map<string, number>;
  let userType: string;
  let calls: string[];
  /** ipm_company_id of each line in force, as lockRows answers it (absent = the company's). */
  let lineCompany: Map<string, string | null>;
  let gateway: Record<string, jest.Mock>;
  let priceGateway: Record<string, jest.Mock>;
  let writer: { updatePrice: jest.Mock; softDeletePriceRow: jest.Mock; updateBucketPrice: jest.Mock };
  /** N4 — the scheduled rows findPriceRows answers (per probe index), and the order of every lock. */
  let scheduled: Array<{ index: number; ipmId: string; effectiveFrom: string; future: boolean }>;
  let sql: string[];
  let audit: { logEntityChange: jest.Mock };
  let bulk: SellingPriceBulkService;
  let applied: Array<{ candidate: BucketPriceCandidate & { maxPrice?: number | null; profitType?: string | null }; scope: ScopeResolution; reason: string | null | undefined }>;
  let service: PurchasePriceStepService;
  const tx = {
    $executeRaw: jest.fn(async (parts: TemplateStringsArray) => { sql.push(parts.join('?').trim()); return 0; }),
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    rows = oilRows();
    lines = [billLine()];
    later = [];
    newer = [];
    settings = { belowCost: 'warning', skipMrp: false, defaultLevel: 1 };
    levels = [
      { level: 1, name: 'WS', active: true },
      { level: 2, name: 'RET', active: true },
      { level: 3, name: 'BWH', active: false },
      { level: 4, name: 'HOT', active: false },
    ];
    stockCost = new Map();
    userType = 'SUPER ADMIN';
    calls = [];
    lineCompany = new Map();
    applied = [];
    scheduled = [];
    sql = [];
    gateway = {
      readBill: jest.fn(async () => BILL),
      readLines: jest.fn(async () => lines),
      stepSettings: jest.fn(async () => settings),
      lockRows: jest.fn(async (_tx: unknown, ids: string[]) => {
        calls.push('lock');
        return new Map(ids.map((id) => [id, lineCompany.has(id) ? lineCompany.get(id)! : CO]));
      }),
      laterLines: jest.fn(async () => { calls.push('later'); return later; }),
      newerChanges: jest.fn(async () => newer),
      rowTokens: jest.fn(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, `tok-${id}`]))),
      rowFigures: jest.fn(async (_tx: unknown, ids: string[]) =>
        new Map(ids.map((id) => [id, { cost: '1', costWot: '1', prices: ['1', '2', '0', '0'], pricesWot: ['1', '2', '0', '0'], markups: ['0', '0', '0', '0'], min: '0', max: '0', profitType: 'By %', roundOff: '1' }]))),
      lastStep: jest.fn(async () => null),
      lockRowStates: jest.fn(async () => new Map()),
      lastChange: jest.fn(async () => null),
      rowCompanies: jest.fn(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, lineCompany.has(id) ? lineCompany.get(id)! : CO]))),
    };
    priceGateway = {
      priceLevels: jest.fn(async () => levels),
      loadRowCosts: jest.fn(async (_tx: unknown, probe: Array<{ itemId: string; uomId: string; mrp: number | null }>) =>
        probe.map((p): RowCost => {
          const row = rows.find((r) => r.uomId === p.uomId && (r.mrp ?? null) === (p.mrp ?? null));
          const itemRow = rows.find((r) => r.itemId === p.itemId);
          const sc = stockCost.get(`${p.uomId}|${p.mrp ?? ''}`) ?? null;
          return {
            itemCode: 'X', itemName: itemRow?.itemName ?? 'ITEM', uomBelongs: true, trackMrp: itemRow?.trackMrp ?? false, trackSalePrice: false,
            costRate: 0, costWot: 0, costBasis: null, minPrice: row?.minPrice ?? 0, unitName: row?.unitName ?? null, unitFactor: row?.unitFactor ?? 1,
            lineCost: row?.lineCost ?? null, lineCostWot: row?.lineCostWot ?? null, lineRoundOff: row?.roundOff ?? null,
            stockCost: sc, stockCostWot: sc === null ? null : sc / 1.05, stockCostBasis: sc === null ? null : 'ITEM',
          };
        })),
      // the real verdicts
      validateRows: jest.fn((c: BucketPriceCandidate[], m: number[], o: object) => PriceBucketGateway.prototype.validateRows.call({}, c, m, o)),
      findBucketRowForUpdate: jest.fn(async (_tx: unknown, c: BucketPriceCandidate, scope: ScopeResolution) => {
        const row = rows.find((r) => r.uomId === c.uomId && (r.mrp ?? null) === c.mrp && r.lineKind !== 'NO_PRICE');
        if (!row) return null;
        const rowScope = row.branchId === null ? null : row.branchId;
        return rowScope === scope.targetBranchId ? { ipmId: row.bucketId!, effectiveFrom: '1900-01-01', effectiveTo: '9999-12-31' } : null;
      }),
      snapshotRows: jest.fn(async () => new Map()),
      // N4 — the scheduled rows of the probed keys; N1 — the key locks (taken BEFORE the row locks).
      findPriceRows: jest.fn(async (_tx: unknown, _probes: unknown[], _day: unknown, opts: { inForce?: boolean; future?: boolean } = {}) =>
        opts.future ? scheduled.filter((row) => row.future) : []),
      lockPriceKeys: jest.fn(async (_tx: unknown, keys: string[]) => { if (keys.length) calls.push('keys'); }),
    };
    writer = { updatePrice: jest.fn(), softDeletePriceRow: jest.fn(), updateBucketPrice: jest.fn(async (_tx: unknown, id: string) => id) };
    audit = { logEntityChange: jest.fn() };
    const requestContext = {
      getUserId: () => USER,
      getUserType: () => userType,
      getDeviceId: () => null,
      getBranchId: () => BR,
    } as unknown as RequestContextService;
    bulk = new SellingPriceBulkService(
      {} as PrismaService, audit as unknown as AuditLogService, requestContext, {} as AppSettingValueService,
      priceGateway as unknown as PriceBucketGateway, writer as unknown as PriceMasterWriter,
    );
    jest.spyOn(bulk, 'linesOfItems').mockImplementation(async () => rows);
    jest.spyOn(bulk, 'resolveItemTaxRates').mockImplementation(async (_c, ids) =>
      new Map(ids.map((id) => [id, { itemId: id, taxId: null, taxPerc: rows.find((r) => r.itemId === id)?.taxPerc ?? 0, inclTax: false, hasCess: false }])));
    jest.spyOn(bulk, 'auditWrites').mockImplementation(async () => new Map());
    jest.spyOn(bulk, 'applyBucketPrice').mockImplementation(async (_tx, candidate, scope, _from, origin) => {
      applied.push({ candidate, scope, reason: origin?.reason });
      const found = await priceGateway.findBucketRowForUpdate(tx, candidate, scope);
      return { ipmId: found?.ipmId ?? `new-${candidate.uomId}`, before: found ? { ipm_id: found.ipmId } : null, lineNo: candidate.lineNo, itemName: candidate.itemName };
    });
    service = new PurchasePriceStepService(
      { $queryRaw: jest.fn(async () => [{ um_can_view: true, um_can_edit: true }]) } as unknown as PrismaService,
      requestContext, audit as unknown as AuditLogService, bulk, priceGateway as unknown as PriceBucketGateway,
      gateway as unknown as PurchasePriceStepGateway, writer as unknown as PriceMasterWriter,
    );
  });

  const run = (mode: PurchasePriceMode, opts: { canReview?: boolean; businessTime?: Date } = {}) =>
    service.afterPurchase(tx, {
      piId: BILL.piId, accYear: BILL.accYear, mode, actor: USER, isHq: ['SUPER ADMIN', 'ADMIN', 'HQ'].includes(userType),
      businessTime: opts.businessTime ?? new Date('2026-11-12T10:00:00+05:30'), canReview: opts.canReview ?? true,
    });
  const written = (uom: string) => applied.find((a) => a.candidate.uomId === uom);
  const pricesOf = (uom: string) => written(uom)!.candidate.levels.map((l) => [l.level, l.price]);

  // ── the modes (§4.6) ──────────────────────────────────────────────────────
  it('NONE: every line OFF, nothing read or written', async () => {
    const out = await run('NONE');
    expect(out.lines.get('L1')).toEqual({ result: 'OFF', oldPrices: [] });
    expect(bulk.linesOfItems).not.toHaveBeenCalled();
    expect(applied).toHaveLength(0);
  });

  it('OPEN_CHANGE_SELLING: nothing written, the line TO_REVIEW; no note for a buyer with Edit on 30', async () => {
    const out = await run('OPEN_CHANGE_SELLING');
    expect(out.lines.get('L1')!.result).toBe('TO_REVIEW');
    expect(applied).toHaveLength(0);
    expect(out.notes).toEqual([]);
  });

  it('OPEN_CHANGE_SELLING without Edit on 30 (O8 / P2A-Q2): one PUR_PRICE_TO_REVIEW note', async () => {
    const out = await run('OPEN_CHANGE_SELLING', { canReview: false });
    expect(out.notes.map((n) => n.code)).toEqual(['PUR_PRICE_TO_REVIEW']);
    expect(out.notes[0].lineNo).toBeNull();
  });

  it('COST_ONLY (E1): BOX and its PCS chain take the bill cost; prices stay; COST_ONLY; pii_old_prices filled', async () => {
    const out = await run('COST_ONLY');
    expect(written(BOX)!.candidate).toMatchObject({ costRate: 1415.631, costWot: 1348.22 });
    expect(written(PCS)!.candidate).toMatchObject({ costRate: 117.96925, costWot: 112.351667 });
    expect(pricesOf(BOX)).toEqual([[1, 1565], [2, 1633]]);
    expect(pricesOf(PCS)).toEqual([[1, 134.4], [2, 140]]);
    // markups recomputed from price and the new cost (price wins)
    expect(written(BOX)!.candidate.levels[0].markupPerc).toBeCloseTo(10.5514, 4);
    const line = out.lines.get('L1')!;
    expect(line.result).toBe('COST_ONLY');
    expect(line.oldPrices.map((e: PurchaseOldPriceEntry) => [e.kind, e.action, e.ipmId, e.afterToken])).toEqual([
      ['BOUGHT', 'UPDATE', IPM_BOX, `tok-${IPM_BOX}`],
      ['CHAIN', 'UPDATE', IPM_PCS, `tok-${IPM_PCS}`],
    ]);
    expect(line.oldPrices[0].before).toMatchObject({ cost: '1', prices: ['1', '2', '0', '0'] });
    expect(applied[0].reason).toBe('Purchase PI-00123 (12-11-2026)');
    expect(applied[1].reason).toBe('Purchase PI-00123 (12-11-2026) · chain from BOX');
    expect(bulk.auditWrites).toHaveBeenCalledWith(tx, expect.any(Array), expect.objectContaining({
      writer: 'Purchase PI-00123 (12-11-2026)', scopeLabels: ['all branches', 'all branches, chain from BOX'],
    }));
  });

  it('UPDATE_PRICES (E1): BOX WS 1,628 / RET 1,699 (kept 15 / 20 % sent), PCS 138.90 / 144.50; UPDATED', async () => {
    const out = await run('UPDATE_PRICES');
    expect(pricesOf(BOX)).toEqual([[1, 1628], [2, 1699]]);
    expect(written(BOX)!.candidate.levels.map((l) => l.markupPerc)).toEqual([15, 20]);
    expect(pricesOf(PCS)).toEqual([[1, 138.9], [2, 144.5]]);
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(out.notes).toEqual([]);
    // HQ on an All branches line: CHAIN, updated in place
    expect(written(BOX)!.scope).toMatchObject({ targetScope: 'CHAIN', targetBranchId: null });
  });

  it('UPDATE_PRICES (E2): a price typed on the bill wins for the bought unit only', async () => {
    lines = [billLine({ sells: [D(1650), null, null, null] })];
    await run('UPDATE_PRICES');
    expect(pricesOf(BOX)).toEqual([[1, 1650], [2, 1699]]);
    expect(pricesOf(PCS)).toEqual([[1, 138.9], [2, 144.5]]);
  });

  it('nothing to change: the same cost and prices → NONE, no write', async () => {
    rows = oilRows({ lineCost: 1415.631, prices: [1628, 1699, 0, 0], stored: [15, 20] }, { lineCost: 117.96925, prices: [138.9, 144.5, 0, 0] });
    const out = await run('UPDATE_PRICES');
    expect(applied).toHaveLength(0);
    expect(out.lines.get('L1')!.result).toBe('NONE');
  });

  it('free goods only (landed 0): NONE, nothing moves', async () => {
    lines = [billLine({ landedCostWot: D(0), billedQty: D(0), freeQty: D(10) })];
    const out = await run('UPDATE_PRICES');
    expect(applied).toHaveLength(0);
    expect(out.lines.get('L1')!.result).toBe('NONE');
  });

  // ── B5 (§4.5) ─────────────────────────────────────────────────────────────
  const laterLine = (over: Partial<LaterLine> = {}): LaterLine => ({
    piId: 'p131', accYear: '2026-2027', refno: 'PI-00131', docDate: '2026-11-15', docDatetime: new Date('2026-11-15T10:00:00+05:30'), branchId: BR, branchName: 'Head Office',
    itemId: OIL, factor: D(1), mrp: null, salePrice: null, landedCostWot: D('112'), ...over,
  });

  it('a later posted bill of the item (any unit, Q5): LATER_BILL, nothing written, one note (the bought line)', async () => {
    later = [laterLine()];
    const out = await run('UPDATE_PRICES');
    expect(applied).toHaveLength(0);
    expect(out.lines.get('L1')!.result).toBe('LATER_BILL');
    expect(out.notes.map((n) => [n.code, n.lineNo, n.params])).toEqual([
      ['PUR_PRICE_LATER_BILL', 1, { n: 1, bill: 'PI-00131', date: '15-11-2026', item: 'GOLD WINNER OIL 1L' }],
    ]);
  });

  it('decision 20: the target rows are locked BEFORE the later bills are read', async () => {
    await run('UPDATE_PRICES');
    expect(gateway.lockRows).toHaveBeenCalledWith(tx, [IPM_BOX, IPM_PCS]);
    expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('later'));
  });

  it('C4: an own line counts only its branch — a later bill at another branch does not block it', async () => {
    rows = oilRows({ branchId: BR, priceScope: 'BRANCH' }, { branchId: BR, priceScope: 'BRANCH' });
    later = [laterLine({ branchId: BR2 })];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(written(BOX)!.scope).toMatchObject({ targetScope: 'BRANCH', targetBranchId: BR });
  });

  it('C4: an All branches line (head office) counts the whole company — another branch\'s later bill blocks it', async () => {
    later = [laterLine({ branchId: BR2 })];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('LATER_BILL');
  });

  it('Q10: a store poster on an All branches line makes "→ this branch" (a BRANCH insert); its later bills are the branch\'s', async () => {
    userType = 'USER';
    later = [laterLine({ branchId: BR2 })];
    const out = await run('UPDATE_PRICES');
    expect(written(BOX)!.scope).toMatchObject({ targetScope: 'BRANCH', targetBranchId: BR, createsBranchOverride: true });
    expect(applied[0].reason).toBe('Purchase PI-00123 (12-11-2026) → this branch');
    expect(out.lines.get('L1')!.oldPrices.map((e) => e.action)).toEqual(['CREATE', 'CREATE']);
    // the new own line carries the line's own Profit Type and R.Off, not the headline's
    expect(written(PCS)!.candidate).toMatchObject({ profitType: 'By Rs', roundOff: 0.1 });
  });

  it('D16 (automatic modes): a logged change of THAT line after the bill keeps it (KEPT_NEWER) with {when} {who} {source}; N9: its chain unit is kept too', async () => {
    newer = [{ itemId: OIL, unitId: BOX, keyMrp: D(-1), keySp: D(-1), at: new Date('2026-11-13T10:20:00+05:30'), who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' }];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('KEPT_NEWER');
    expect(written(BOX)).toBeUndefined();
    // N9 (user 2026-11-26: keep the chain) — PCS does not move either
    expect(written(PCS)).toBeUndefined();
    expect(out.lines.get('L1')!.oldPrices).toEqual([]);
    expect(out.notes.map((n) => [n.code, n.rule ?? null, n.lineNo, n.params])).toEqual([
      ['PUR_PRICE_KEPT_NEWER', null, 1, { n: 1, item: 'GOLD WINNER OIL 1L', unit: 'BOX', when: '13-11-2026 10:20 AM', who: 'VKPOS', source: 'Change Selling Price' }],
      ['PUR_PRICE_KEPT_NEWER', 'CHAIN', 1, { n: 1, item: 'GOLD WINNER OIL 1L', unit: 'PCS', boughtUnit: 'BOX', when: '13-11-2026 10:20 AM', who: 'VKPOS', source: 'Change Selling Price' }],
    ]);
    expect(out.notes[1].message).toBe(
      'Line 1: GOLD WINNER OIL 1L PCS price not updated — GOLD WINNER OIL 1L BOX was changed later on 13-11-2026 10:20 AM ' +
        '(Change Selling Price, VKPOS), so its unit chain was kept too; the bill keeps its own price as history.',
    );
  });

  it('D16 on the CHAIN unit only: that unit is kept; the bought unit still moves (N9 is one way)', async () => {
    newer = [{ itemId: OIL, unitId: PCS, keyMrp: D(-1), keySp: D(-1), at: new Date('2026-11-13T10:20:00+05:30'), who: null, source: 'ITEM_CARD' }];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(pricesOf(BOX)).toEqual([[1, 1628], [2, 1699]]);
    expect(written(PCS)).toBeUndefined();
    // no {who} when the log has none
    expect(out.notes).toEqual([
      expect.objectContaining({ code: 'PUR_PRICE_KEPT_NEWER', params: { n: 1, item: 'GOLD WINNER OIL 1L', unit: 'PCS', when: '13-11-2026 10:20 AM', source: 'item card' } }),
    ]);
  });

  it('D16 on a COMPANY-LESS All branches line: its log rows (ipcl_company_id NULL) count — KEPT_NEWER (api B7)', async () => {
    lineCompany.set(IPM_BOX, null);
    newer = [{ itemId: OIL, unitId: BOX, keyMrp: D(-1), keySp: D(-1), companyNull: true, at: new Date('2026-11-13T10:20:00+05:30'), who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' }];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('KEPT_NEWER');
    expect(written(BOX)).toBeUndefined();
    expect(out.notes[0]).toMatchObject({ code: 'PUR_PRICE_KEPT_NEWER', lineNo: 1 });
  });

  it("D16: a company-less row's change does not hold the company's OWN line of the key", async () => {
    newer = [{ itemId: OIL, unitId: BOX, keyMrp: D(-1), keySp: D(-1), companyNull: true, at: new Date('2026-11-13T10:20:00+05:30'), who: 'VKPOS', source: 'ITEM_CARD' }];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(pricesOf(BOX)).toEqual([[1, 1628], [2, 1699]]);
  });

  // ── the policy table (§4.8 + addendum §4) ─────────────────────────────────
  it('below the judged cost under warning: prices + MSP kept, the cost moves, COST_ONLY, PUR_PRICE_NOT_WRITTEN', async () => {
    stockCost.set(`${BOX}|`, 1650);
    const out = await run('UPDATE_PRICES');
    // the bill line says what its BOUGHT line got (the PCS chain moved by its own rule, and is in pii_old_prices)
    expect(out.lines.get('L1')!.result).toBe('COST_ONLY');
    expect(pricesOf(PCS)).toEqual([[1, 138.9], [2, 144.5]]);
    expect(pricesOf(BOX)).toEqual([[1, 1565], [2, 1633]]);
    expect(written(BOX)!.candidate.costRate).toBe(1415.631);
    const nw = out.notes.filter((n) => n.code === 'PUR_PRICE_NOT_WRITTEN');
    expect(nw.map((n) => n.params?.level)).toEqual(['WS']);
    // S4 — rule=BELOW_COST: {level} {price} {cost} (the judged, higher cost), and both costs (A3-C)
    expect(nw[0]).toMatchObject({ rule: 'BELOW_COST' });
    expect(nw[0].params).toEqual({
      n: 1, level: 'WS', price: '1,628.00', item: 'GOLD WINNER OIL 1L', unit: 'BOX', cost: '1,650.00', lineCost: '1,415.63', stockCost: '1,650.00',
    });
    expect(nw[0].message).toBe(
      'Line 1: WS 1,628.00 of GOLD WINNER OIL 1L BOX would be below the cost 1,650.00 (this bill 1,415.63, stock 1,650.00), ' +
        'so its prices were kept; its cost moved.',
    );
  });

  it('below the judged cost under restrict: the same (nobody can confirm at post)', async () => {
    settings.belowCost = 'restrict';
    stockCost.set(`${BOX}|`, 1650);
    lines = [billLine({ itemId: OIL })];
    rows = [oilRows()[0]];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('COST_ONLY');
    expect(pricesOf(BOX)).toEqual([[1, 1565], [2, 1633]]);
  });

  it('below the judged cost under allow: written, and PUR_PRICE_BELOW_NEW_COST says so', async () => {
    settings.belowCost = 'allow';
    stockCost.set(`${BOX}|`, 1650);
    rows = [oilRows()[0]];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(pricesOf(BOX)).toEqual([[1, 1628], [2, 1699]]);
    expect(out.notes.map((n) => [n.code, n.params?.level])).toEqual([['PUR_PRICE_BELOW_NEW_COST', 'WS']]);
  });

  it('U1 (decision 35): above a plain line\'s TYPED MRP — kept, COST_ONLY, rule=ABOVE_MRP; not judged under skip_mrp', async () => {
    rows = [oilRows({ maxPrice: 1650 })[0]];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('COST_ONLY');
    expect(out.notes).toEqual([
      expect.objectContaining({ code: 'PUR_PRICE_NOT_WRITTEN', rule: 'ABOVE_MRP', params: expect.objectContaining({ level: 'RET', price: '1,699.00', mrp: '1,650.00', n: 1 }) }),
    ]);
    applied = [];
    settings.skipMrp = true;
    const skip = await run('UPDATE_PRICES');
    expect(skip.lines.get('L1')!.result).toBe('UPDATED');
    expect(pricesOf(BOX)).toEqual([[1, 1628], [2, 1699]]);
  });

  it('Q11: the bill\'s MRP goes on a plain bought line, and U1 reads it (1,700 lets 1,699 through)', async () => {
    rows = [oilRows({ maxPrice: 1650 })[0]];
    lines = [billLine({ mrp: D(1700) })];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(written(BOX)!.candidate.maxPrice).toBe(1700);
  });

  it('S4 (decision 36): a level the company does not use is not judged', async () => {
    // RET (level 2) is hidden: its price above the typed MRP is written with no note
    levels[1].active = false;
    rows = [oilRows({ maxPrice: 1650 })[0]];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('UPDATED');
    expect(out.notes).toEqual([]);
  });

  it('P9: the bill\'s MSP rides with the prices when it differs from the stored one', async () => {
    rows = [oilRows({ minPrice: 1500 })[0]];
    lines = [billLine({ minPrice: D(1550) })];
    await run('UPDATE_PRICES');
    expect(written(BOX)!.candidate.minPrice).toBe(1550);
    applied = [];
    lines = [billLine({ minPrice: D(1500) })];
    await run('UPDATE_PRICES');
    expect(written(BOX)!.candidate.minPrice).toBeNull();
  });

  it('P9: a new price below the bill\'s MSP keeps the prices and the MSP (one write or none)', async () => {
    rows = [oilRows()[0]];
    lines = [billLine({ minPrice: D(1650) })];
    const out = await run('UPDATE_PRICES');
    expect(out.lines.get('L1')!.result).toBe('COST_ONLY');
    expect(written(BOX)!.candidate.minPrice).toBeNull();
    expect(out.notes[0]).toMatchObject({ code: 'PUR_PRICE_NOT_WRITTEN', params: expect.objectContaining({ level: 'WS' }) });
  });

  // ── MRP items: B3 / Q9 / Q12 ─────────────────────────────────────────────
  const bruRows = () => [
    lineRow({ itemId: BRU, itemName: 'BRU 200G', uomId: BRU_PCS, unitName: 'PCS', unitFactor: 1, bucketId: IPM_BRU_HEAD, trackMrp: true, taxPerc: 18,
      profitType: 'By User', lineCost: 240, prices: [262, 275, 0, 0] }),
    lineRow({ itemId: BRU, itemName: 'BRU 200G', uomId: BRU_PCS, unitName: 'PCS', unitFactor: 1, bucketId: IPM_BRU_560, trackMrp: true, taxPerc: 18,
      mrp: 560, maxPrice: 560, lineKind: 'MRP', profitType: 'By User', lineCost: 470.4, prices: [515, 549, 0, 0] }),
  ];
  const bruLine = (over: Partial<StepBillLine> = {}) =>
    billLine({ piiId: 'L2', lineNo: 2, itemId: BRU, itemName: 'BRU 200G', uomId: BRU_PCS, unitName: 'PCS', factor: D(1), billedQty: D(12),
      rate: D(220), landedCostWot: D('213.559322'), portions: [{ mrp: D(300), salePrice: null, baseQty: D(12) }], ...over });

  it('B3: a bought MRP with no line, nothing typed → NO_LINE and the note names what it sells at today', async () => {
    rows = bruRows();
    lines = [bruLine()];
    const out = await run('UPDATE_PRICES');
    expect(applied).toHaveLength(0);
    expect(out.lines.get('L2')!.result).toBe('NO_LINE');
    expect(out.notes[0]).toMatchObject({ code: 'PUR_PRICE_NO_LINE', lineNo: 2, params: { n: 2, item: 'BRU 200G', mrp: '300.00', price: '262.00' } });
  });

  it('Q9: UPDATE_PRICES with a typed WS makes the line — typed WS, RET from the other-MRPs line, the bill cost (HQ: All branches)', async () => {
    rows = bruRows();
    lines = [bruLine({ sells: [D(270), null, null, null] })];
    const out = await run('UPDATE_PRICES');
    const made = written(BRU_PCS)!;
    expect(made.candidate).toMatchObject({ mrp: 300, costRate: 252 });
    expect(made.candidate.levels.map((l) => [l.level, l.price])).toEqual([[1, 270], [2, 275]]);
    expect(made.scope).toMatchObject({ targetScope: 'CHAIN', targetBranchId: null });
    expect(out.lines.get('L2')!.result).toBe('UPDATED');
    expect(out.lines.get('L2')!.oldPrices[0]).toMatchObject({ action: 'CREATE', before: null });
  });

  it('E3: By User on the bought MRP keeps WS 515; the cost moves (489.22)', async () => {
    rows = bruRows();
    lines = [bruLine({ landedCostWot: D('414.59'), portions: [{ mrp: D(560), salePrice: null, baseQty: D(24) }] })];
    const out = await run('UPDATE_PRICES');
    expect(pricesOf(BRU_PCS)).toEqual([[1, 515], [2, 549]]);
    expect(written(BRU_PCS)!.candidate.costRate).toBe(489.2162);
    expect(out.lines.get('L2')!.result).toBe('UPDATED');
    // the "other MRPs" headline is never a target of an MRP purchase
    expect(applied).toHaveLength(1);
  });

  // ── the view (§7.2, decision 24) ──────────────────────────────────────────
  it('purchase-lines: rows grouped by item in the order of each item\'s first bill line, each bought line then its chain units', async () => {
    rows = [...oilRows(), ...bruRows()];
    lines = [
      bruLine({ piiId: 'A', lineNo: 1, landedCostWot: D(400), portions: [{ mrp: D(560), salePrice: null, baseQty: D(12) }] }),
      billLine({ piiId: 'B', lineNo: 2 }),
      bruLine({ piiId: 'C', lineNo: 3 }),
    ];
    jest.spyOn(bulk, 'assertCanEditPrices').mockResolvedValue(undefined);
    jest.spyOn(bulk, 'assertBranchAllowed').mockResolvedValue(undefined);
    const view = await service.purchaseLines({ companyId: CO, branchId: BR, accYear: BILL.accYear, piId: BILL.piId });
    expect(view.items.map((r) => [r.itemId === BRU ? 'BRU' : 'OIL', r.unitName, r.mrp, r.fromBill.kind])).toEqual([
      ['BRU', 'PCS', 560, 'BOUGHT'],
      ['BRU', 'PCS', 300, 'NO_PRICE'],
      ['OIL', 'BOX', null, 'BOUGHT'],
      ['OIL', 'PCS', null, 'CHAIN'],
    ]);
    expect(view.items.map((r) => r.lineNo)).toEqual([1, 2, 3, 4]);
    const box = view.items[2].fromBill;
    expect(box.words).toBe('10 BOX · rate 1,348.22 · landing 1,348.22 + GST 5 %');
    expect(box.proposed!.levels.map((l) => [l.price, l.from])).toEqual([[1628, 'RULE'], [1699, 'RULE'], [0, 'KEPT'], [0, 'KEPT']]);
    expect(view.items[3].fromBill).toMatchObject({ chainFrom: { unitName: 'BOX', factor: 12, way: 'SMALLER' }, words: 'BOX ÷ 12 (the smaller unit)' });
    expect(view.meta).toEqual({ items: 2, lines: 4, bought: 2, chain: 1, laterBill: 0, noPrice: 1, toChange: 4, latestLines: 4 });
  });

  it('purchase-lines: a LATER_BILL row carries the later bill and no proposal', async () => {
    later = [laterLine({ landedCostWot: D('112.5') })];
    jest.spyOn(bulk, 'assertCanEditPrices').mockResolvedValue(undefined);
    jest.spyOn(bulk, 'assertBranchAllowed').mockResolvedValue(undefined);
    const view = await service.purchaseLines({ companyId: CO, branchId: BR, accYear: BILL.accYear, piId: BILL.piId });
    expect(view.items[0].fromBill).toMatchObject({
      kind: 'LATER_BILL', proposed: null, laterBill: { refno: 'PI-00131', cost: 1417.5 }, words: 'later purchase PI-00131 15-11, cost 1,417.50',
    });
    expect(view.meta.latestLines).toBe(0);
  });

  it('purchase-lines: a DRAFT bill is 422 STOCK_PRICE_BILL_NOT_POSTED; another branch\'s bill 404', async () => {
    jest.spyOn(bulk, 'assertCanEditPrices').mockResolvedValue(undefined);
    jest.spyOn(bulk, 'assertBranchAllowed').mockResolvedValue(undefined);
    gateway.readBill.mockResolvedValueOnce({ ...BILL, status: 'DRAFT' });
    await expect(service.purchaseLines({ companyId: CO, branchId: BR, accYear: BILL.accYear, piId: BILL.piId })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'STOCK_PRICE_BILL_NOT_POSTED', params: { bill: 'PI-00123', status: 'DRAFT' } })] },
    });
    await expect(service.purchaseLines({ companyId: CO, branchId: BR2, accYear: BILL.accYear, piId: BILL.piId })).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'STOCK_PRICE_BILL_NOT_FOUND' })] },
    });
  });

  // ── the view save's re-check (§7.3) ───────────────────────────────────────
  it('fromPurchase: a row a later posted bill bought → 409 STOCK_PRICE_LATER_PURCHASE; nothing else runs', async () => {
    later = [laterLine()];
    jest.spyOn(bulk, 'assertCanEditPrices').mockResolvedValue(undefined);
    jest.spyOn(bulk, 'assertBranchAllowed').mockResolvedValue(undefined);
    const afterWrite = jest.fn();
    jest.spyOn(bulk, 'saveBulk').mockImplementation(async (_dto, hooks) => {
      const candidate = { lineNo: 1, itemId: OIL, uomId: BOX, mrp: null, salePrice: null, itemName: 'GOLD WINNER OIL 1L', unitName: 'BOX' } as BucketPriceCandidate;
      await hooks!.afterPrepare(tx, {
        candidates: [candidate], costs: [{ trackMrp: false, trackSalePrice: false, unitFactor: 12 } as RowCost],
        resolutions: [{ targetScope: 'CHAIN', targetBranchId: null } as ScopeResolution], scheduledFrom: undefined,
      } as never);
      await afterWrite();
      return {} as never;
    });
    await expect(
      service.saveFromPurchase({ companyId: CO, branchId: BR, rows: [], fromPurchase: { piId: BILL.piId, accYear: BILL.accYear } } as never),
    ).rejects.toMatchObject({
      status: 409,
      response: { errors: [expect.objectContaining({ code: 'STOCK_PRICE_LATER_PURCHASE', field: 'rows.1', params: expect.objectContaining({ bill: 'PI-00131', date: '15-11-2026', unit: 'BOX', cost: '1,411.20' }) })] },
    });
    // S5 — the rows come locked (lockTargets, sorted, in saveBulk): assertLatest locks none row by row
    expect(priceGateway.findBucketRowForUpdate).not.toHaveBeenCalled();
    expect(afterWrite).not.toHaveBeenCalled();
  });

  // ── afterPurchase.laterBill (user OK 2026-11-26) ──────────────────────────
  it('afterPurchase.laterBill: the newest later bill of the bill\'s lines; latestLines counts what is left', async () => {
    rows = [...oilRows(), ...bruRows()];
    lines = [billLine(), bruLine({ landedCostWot: D(400), portions: [{ mrp: D(560), salePrice: null, baseQty: D(12) }] })];
    later = [
      laterLine({ piId: 'p140', refno: 'PI-00140', docDate: '2026-11-20', docDatetime: new Date('2026-11-20T09:00:00+05:30'), itemId: BRU, mrp: D(560) }),
      laterLine(),
    ];
    const state = await service.afterPurchaseState(BILL.piId, BILL.accYear);
    expect(state.laterBill).toEqual({ piId: 'p140', refno: 'PI-00140', docDate: '2026-11-20T00:00:00.000Z' });
    expect(state.latestLines).toBe(0);
    expect(state.canOpen).toBe(false);
  });

  it('afterPurchase.laterBill: null when no line of the bill is overtaken, and on a bill that is not POSTED', async () => {
    expect((await service.afterPurchaseState(BILL.piId, BILL.accYear)).laterBill).toBeNull();
    gateway.readBill.mockResolvedValueOnce({ ...BILL, status: 'CANCELLED' });
    later = [laterLine()];
    expect((await service.afterPurchaseState(BILL.piId, BILL.accYear)).laterBill).toBeNull();
  });

  // ── Cancel's put-back (§4.9, Q7) ─────────────────────────────────────────
  it('undo: untouched UPDATE put back, untouched CREATE soft-deleted, a touched row kept and said; the view-save line', async () => {
    const before = { cost: '1361.18', costWot: '1296.361905', prices: ['1565', '1633', '0', '0'], pricesWot: ['1', '2', '0', '0'], markups: ['15', '20', '0', '0'], min: '0', max: '1800', profitType: 'By %', roundOff: '1' };
    lines = [billLine({
      oldPrices: [
        { ipmId: IPM_BOX, kind: 'BOUGHT', action: 'UPDATE', before, afterToken: 't-box', itemName: 'GOLD WINNER OIL 1L', unitName: 'BOX' },
        { ipmId: 'new-own', kind: 'CHAIN', action: 'CREATE', before: null, afterToken: 't-own', itemName: 'GOLD WINNER OIL 1L', unitName: 'PCS' },
        { ipmId: IPM_PCS, kind: 'CHAIN', action: 'UPDATE', before, afterToken: 't-pcs', itemName: 'GOLD WINNER OIL 1L', unitName: 'PCS' },
      ],
    })];
    gateway.lockRowStates.mockResolvedValue(new Map([
      [IPM_BOX, { ipmId: IPM_BOX, token: 't-box', isDeleted: false }],
      ['new-own', { ipmId: 'new-own', token: 't-own', isDeleted: false }],
      [IPM_PCS, { ipmId: IPM_PCS, token: 'changed', isDeleted: false }],
    ]));
    gateway.lastChange.mockResolvedValue({ at: new Date('2026-11-13T10:20:00+05:30'), who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' });
    gateway.lastStep.mockResolvedValue({ on: '2026-11-13T10:30:00+05:30', by: 'VKPOS' });
    const notes = await service.undo(tx, { piId: BILL.piId, accYear: BILL.accYear, refno: 'PI-00123', actor: USER });
    expect(writer.updatePrice).toHaveBeenCalledTimes(1);
    expect(writer.updatePrice.mock.calls[0][2]).toBe(IPM_BOX);
    expect(writer.updatePrice.mock.calls[0][3]).toMatchObject({ ipmCostPrice: D('1361.18'), ipmSalesPriceA: D(1565), ipmMaxPrice: D(1800), ipmProfitType: 'By %' });
    expect(writer.updatePrice.mock.calls[0][1]).toMatchObject({ source: 'PURCHASE', menuId: 24, reason: 'Purchase PI-00123 cancelled — back to before' });
    expect(writer.softDeletePriceRow).toHaveBeenCalledWith(tx, 'new-own', USER, expect.objectContaining({ source: 'PURCHASE' }));
    expect(notes.map((n) => [n.code, n.params])).toEqual([
      ['PUR_PRICE_RESTORED', { count: 2, bill: 'PI-00123' }],
      ['PUR_PRICE_KEPT_ON_CANCEL', { item: 'GOLD WINNER OIL 1L', unit: 'PCS', bill: 'PI-00123', when: '13-11 10:20 AM', who: 'VKPOS', source: 'Change Selling Price' }],
      ['PUR_PRICE_REVIEW_KEPT', { bill: 'PI-00123' }],
    ]);
    expect(notes[1].message).toContain('(13-11 10:20 AM, VKPOS, Change Selling Price)');
    expect(audit.logEntityChange).toHaveBeenCalledTimes(2);
  });
  // ── review fix batch 2026-11-26 (review-fix-batch-csp-p2-2026-11-26.md, SERVER) ─────────────
  describe('review fix batch 2026-11-26', () => {
    const openView = () => {
      jest.spyOn(bulk, 'assertCanEditPrices').mockResolvedValue(undefined);
      jest.spyOn(bulk, 'assertBranchAllowed').mockResolvedValue(undefined);
      return service.purchaseLines({ companyId: CO, branchId: BR, accYear: BILL.accYear, piId: BILL.piId });
    };
    const posted = (on: string) =>
      gateway.lastStep.mockImplementation(async (_c: unknown, _p: unknown, _y: unknown, event: string) => (event === 'POSTED' ? { on, by: 'VKPOS' } : null));
    const figures = (cost: string, costWot: string, prices: string[]) => ({
      cost, costWot, prices, pricesWot: ['0', '0', '0', '0'], markups: ['0', '0', '0', '0'], min: '0', max: '0', profitType: 'By %', roundOff: '1',
    });
    const savingFromView = (run: (hooks: Parameters<SellingPriceBulkService['saveBulk']>[1]) => Promise<void>) => {
      jest.spyOn(bulk, 'assertCanEditPrices').mockResolvedValue(undefined);
      jest.spyOn(bulk, 'assertBranchAllowed').mockResolvedValue(undefined);
      jest.spyOn(bulk, 'saveBulk').mockImplementation(async (_dto, hooks) => {
        await run(hooks);
        return {} as never;
      });
      return service.saveFromPurchase({ companyId: CO, branchId: BR, rows: [], fromPurchase: { piId: BILL.piId, accYear: BILL.accYear } } as never);
    };

    // ── S3 ──
    it('S3: fromBill.changedSince — the latest change of THAT line after the bill, the bill\'s own writes left out', async () => {
      gateway.lastStep.mockImplementation(async (_c: unknown, _p: unknown, _y: unknown, event: string) =>
        event === 'POSTED' ? { on: '2026-11-12T10:05:00+05:30', by: 'VKPOS', at: new Date('2026-11-12T10:05:00.734+05:30') } : null);
      newer = [{ itemId: OIL, unitId: BOX, keyMrp: D(-1), keySp: D(-1), at: new Date('2026-11-25T10:20:00+05:30'), who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' }];
      const view = await openView();
      expect(view.items[0].fromBill.changedSince).toEqual({ at: '2026-11-25T10:20:00+05:30', who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' });
      expect(view.items[1].fromBill.changedSince).toBeNull();
      // posted on its own day: from its exact POSTED moment (not cut to the second); this bill's own
      // post / cancel / view saves left out
      expect(gateway.newerChanges).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        after: new Date('2026-11-12T10:05:00.734+05:30'), exceptBill: 'PI-00123', itemIds: [OIL],
      }));
    });

    it('S3: a late entry is judged from the end of its day; a company-less change only on a company-less line; NO_PRICE null', async () => {
      posted('2026-11-14T09:00:00+05:30');
      rows = [...oilRows(), ...bruRows()];
      lines = [billLine(), bruLine()];
      newer = [{ itemId: OIL, unitId: BOX, keyMrp: D(-1), keySp: D(-1), companyNull: true, at: new Date('2026-11-25T10:20:00+05:30'), who: null, source: 'ITEM_CARD' }];
      let view = await openView();
      expect(gateway.newerChanges).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ after: new Date('2026-11-12T23:59:59.999+05:30') }));
      expect(view.items.map((r) => [r.unitName, r.fromBill.kind, r.fromBill.changedSince])).toEqual([
        ['BOX', 'BOUGHT', null], ['PCS', 'CHAIN', null], ['PCS', 'NO_PRICE', null],
      ]);
      lineCompany.set(IPM_BOX, null);
      view = await openView();
      expect(view.items[0].fromBill.changedSince).toEqual({ at: '2026-11-25T10:20:00+05:30', who: null, source: 'ITEM_CARD' });
    });

    // ── S4 ──
    it('S4: above a bucket MRP — rule=ABOVE_MRP with {price} {mrp}', async () => {
      rows = bruRows();
      lines = [bruLine({ landedCostWot: D('414.59'), sells: [D(570), null, null, null], portions: [{ mrp: D(560), salePrice: null, baseQty: D(24) }] })];
      const out = await run('UPDATE_PRICES');
      expect(out.lines.get('L2')!.result).toBe('COST_ONLY');
      expect(out.notes).toContainEqual(expect.objectContaining({
        code: 'PUR_PRICE_NOT_WRITTEN', rule: 'ABOVE_MRP', lineNo: 2,
        params: { n: 2, level: 'WS', price: '570.00', item: 'BRU 200G', unit: 'PCS', mrp: '560.00' },
        message: 'Line 2: WS 570.00 of BRU 200G PCS would be above its MRP 560.00, so its prices were kept; its cost moved.',
      }));
    });

    it('S4: a refused Q9 new line — rule=NEW_LINE_ABOVE_MRP "so no price line was made" (never "its cost moved"); NO_LINE, nothing written', async () => {
      rows = bruRows();
      lines = [bruLine({ sells: [D(310), null, null, null] })];
      const out = await run('UPDATE_PRICES');
      expect(out.lines.get('L2')!.result).toBe('NO_LINE');
      expect(applied).toHaveLength(0);
      const note = out.notes.find((n) => n.code === 'PUR_PRICE_NOT_WRITTEN')!;
      expect(note).toMatchObject({ rule: 'NEW_LINE_ABOVE_MRP', lineNo: 2, params: { n: 2, level: 'WS', price: '310.00', item: 'BRU 200G', unit: 'PCS', mrp: '300.00' } });
      expect(note.message).toBe('Line 2: WS 310.00 of BRU 200G PCS would be above its MRP 300.00, so no price line was made.');
    });

    it('S4: PUR_PRICE_NO_LINE — an MRP key keeps the plain row (+ {unit}); a plain item\'s unit is rule=PLAIN {n} {item} {unit}', async () => {
      rows = bruRows();
      lines = [bruLine()];
      let out = await run('UPDATE_PRICES');
      expect(out.notes[0]).toEqual(expect.objectContaining({ code: 'PUR_PRICE_NO_LINE', params: { n: 2, item: 'BRU 200G', unit: 'PCS', mrp: '300.00', price: '262.00' } }));
      expect(out.notes[0].rule).toBeUndefined();
      rows = [oilRows()[0], lineRow({ uomId: PCS, unitName: 'PCS', bucketId: null, lineKind: 'NO_PRICE', unitFactor: 1, unitSlNo: 2, lineCost: null })];
      lines = [billLine({ uomId: PCS, unitName: 'PCS', factor: D(1), portions: [{ mrp: null, salePrice: null, baseQty: D(120) }] })];
      out = await run('COST_ONLY');
      expect(out.lines.get('L1')!.result).toBe('NO_LINE');
      const note = out.notes.find((n) => n.code === 'PUR_PRICE_NO_LINE')!;
      expect(note).toMatchObject({ rule: 'PLAIN', lineNo: 1, params: { n: 1, item: 'GOLD WINNER OIL 1L', unit: 'PCS' } });
      expect(note.message).toBe('Line 1: GOLD WINNER OIL 1L PCS has no price line yet, so this bill could not price it.');
    });

    it('S4: PUR_PRICE_RESTORED of ONE line carries rule=ONE; more than one, no rule', async () => {
      const before = figures('1361.18', '1296.361905', ['1565', '1633', '0', '0']);
      lines = [billLine({ oldPrices: [{ ipmId: IPM_BOX, kind: 'BOUGHT', action: 'UPDATE', before, afterToken: 't-box', itemName: 'GOLD WINNER OIL 1L', unitName: 'BOX' }] })];
      gateway.lockRowStates.mockResolvedValue(new Map([[IPM_BOX, { ipmId: IPM_BOX, token: 't-box', isDeleted: false }]]));
      const notes = await service.undo(tx, { piId: BILL.piId, accYear: BILL.accYear, refno: 'PI-00123', actor: USER });
      expect(notes).toEqual([expect.objectContaining({
        code: 'PUR_PRICE_RESTORED', rule: 'ONE', params: { count: 1, bill: 'PI-00123' },
        message: 'Prices put back: 1 price line went back to their figures before PI-00123.',
      })]);
    });

    // ── S5 / N1 ──
    it('S5: Open mode locks nothing (it writes nothing); B5 still runs', async () => {
      await run('OPEN_CHANGE_SELLING');
      expect(gateway.lockRows).not.toHaveBeenCalled();
      expect(priceGateway.lockPriceKeys).not.toHaveBeenCalled();
      expect(priceGateway.findPriceRows).not.toHaveBeenCalled();
      expect(gateway.laterLines).toHaveBeenCalled();
    });

    it('S5 / N1: the keys an insert needs first, then every row ONCE (lines + scheduled rows), then B5', async () => {
      userType = 'USER'; // a store poster on All branches lines: two "→ this branch" inserts
      scheduled = [{ index: 0, ipmId: 'sched-box', effectiveFrom: '2026-12-01', future: true }];
      await run('UPDATE_PRICES');
      expect(calls.slice(0, 3)).toEqual(['keys', 'lock', 'later']);
      expect(priceGateway.lockPriceKeys.mock.calls[0][1]).toEqual([
        [CO, BR, OIL, BOX, '-1', '-1'].join('|').toLowerCase(),
        [CO, BR, OIL, PCS, '-1', '-1'].join('|').toLowerCase(),
      ]);
      expect(gateway.lockRows).toHaveBeenCalledTimes(1);
      expect(gateway.lockRows.mock.calls[0][1]).toEqual([IPM_BOX, IPM_PCS, 'sched-box']);
      // the scheduled rows are looked for at the scope each write lands on (here this branch)
      expect(priceGateway.findPriceRows).toHaveBeenCalledWith(tx, [
        { companyId: CO, branchId: BR, itemId: OIL, uomId: BOX, mrp: null, salePrice: null },
        { companyId: CO, branchId: BR, itemId: OIL, uomId: PCS, mrp: null, salePrice: null },
      ], undefined, { inForce: false, future: true });
    });

    it('S5: a head office update of existing lines needs no key lock', async () => {
      await run('UPDATE_PRICES');
      expect(priceGateway.lockPriceKeys).toHaveBeenCalledWith(tx, []);
      expect(calls).toEqual(['lock', 'later']);
    });

    it('N1: an insert another writer beat (ex_ipm_overlap) → KEPT_NEWER with its when / who, inside a savepoint — never a 500', async () => {
      rows = bruRows();
      lines = [bruLine({ sells: [D(270), null, null, null] })];
      (bulk.applyBucketPrice as jest.Mock).mockImplementationOnce(async () => {
        throw Object.assign(new Error('Raw query failed. Code: `23P01`.'), {
          code: 'P2010', meta: { code: '23P01', message: 'conflicting key value violates exclusion constraint "ex_ipm_overlap"' },
        });
      });
      priceGateway.findPriceRows.mockImplementation(async (_tx: unknown, _p: unknown, _d: unknown, opts: { future?: boolean } = {}) =>
        opts.future ? [] : [{ index: 0, ipmId: 'winner', effectiveFrom: '2026-11-12', future: false }]);
      gateway.lastChange.mockResolvedValue({ at: new Date('2026-11-12T10:00:30+05:30'), who: 'PRATHAP', source: 'ITEM_CARD' });
      const out = await run('UPDATE_PRICES');
      expect(out.lines.get('L2')!).toEqual({ result: 'KEPT_NEWER', oldPrices: [] });
      expect(sql).toEqual(['SAVEPOINT csp_price_insert', 'ROLLBACK TO SAVEPOINT csp_price_insert']);
      expect(gateway.lastChange).toHaveBeenCalledWith(tx, 'winner');
      expect(out.notes).toEqual([expect.objectContaining({
        code: 'PUR_PRICE_KEPT_NEWER', lineNo: 2,
        params: { n: 2, item: 'BRU 200G', unit: 'PCS', when: '12-11-2026 10:00 AM', who: 'PRATHAP', source: 'item card' },
      })]);
      expect(calls.indexOf('keys')).toBeLessThan(calls.indexOf('lock'));
    });

    it('N1: a successful insert releases its savepoint; any other error in it is rethrown', async () => {
      rows = bruRows();
      lines = [bruLine({ sells: [D(270), null, null, null] })];
      await run('UPDATE_PRICES');
      expect(sql).toEqual(['SAVEPOINT csp_price_insert', 'RELEASE SAVEPOINT csp_price_insert']);
      (bulk.applyBucketPrice as jest.Mock).mockImplementationOnce(async () => { throw new Error('boom'); });
      await expect(run('UPDATE_PRICES')).rejects.toThrow('boom');
    });

    // ── N2 ──
    it('N2: the view save re-reads its bill FOR SHARE first — cancelled meanwhile → 422 STOCK_PRICE_BILL_NOT_POSTED', async () => {
      gateway.readBill.mockResolvedValueOnce(BILL).mockResolvedValueOnce({ ...BILL, status: 'CANCELLED' });
      await expect(savingFromView(async (hooks) => { await hooks!.beforePrepare!(tx); })).rejects.toMatchObject({
        status: 422,
        response: { errors: [expect.objectContaining({ code: 'STOCK_PRICE_BILL_NOT_POSTED', params: { bill: 'PI-00123', status: 'CANCELLED' } })] },
      });
      expect(gateway.readBill).toHaveBeenLastCalledWith(tx, BILL.piId, BILL.accYear, { lock: 'SHARE' });
    });

    // ── N3 ──
    it('N3: canOpen needs View on 24 as well as Edit on 30', async () => {
      const queryRaw = (service as unknown as { prisma: { $queryRaw: jest.Mock } }).prisma.$queryRaw;
      queryRaw.mockImplementation(async (_s: TemplateStringsArray, ...values: unknown[]) => [{ um_can_view: !values.includes(24), um_can_edit: true }]);
      expect((await service.afterPurchaseState(BILL.piId, BILL.accYear)).canOpen).toBe(false);
      queryRaw.mockImplementation(async (_s: TemplateStringsArray, ...values: unknown[]) => [{ um_can_view: true, um_can_edit: !values.includes(30) }]);
      expect((await service.afterPurchaseState(BILL.piId, BILL.accYear)).canOpen).toBe(false);
      queryRaw.mockImplementation(async () => [{ um_can_view: true, um_can_edit: true }]);
      expect((await service.afterPurchaseState(BILL.piId, BILL.accYear)).canOpen).toBe(true);
    });

    // ── N4 ──
    it('N4 (cost only): the key\'s scheduled rows take the new cost, prices kept, markups recomputed (tax of their day)', async () => {
      scheduled = [{ index: 0, ipmId: 'sched-box', effectiveFrom: '2026-12-01', future: true }];
      gateway.rowFigures.mockImplementation(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, figures('1361.18', '1296.361905', ['1600', '1650', '0', '0'])])));
      const out = await run('UPDATE_PRICES');
      const call = writer.updateBucketPrice.mock.calls.find((c) => c[1] === 'sched-box')!;
      expect(call[2]).toMatchObject({ costRate: 1415.631, costWot: 1348.22, minPrice: null, roundOff: null });
      expect(call[2].levels.map((l: { level: number; price: number }) => [l.level, l.price])).toEqual([[1, 1600], [2, 1650]]);
      expect(call[2].levels[0].markupPerc).toBeCloseTo(13.023804, 5); // (1600 − 1415.631) ÷ 1415.631
      expect(call[2].profitType).toBeUndefined();
      expect(call[3]).toMatchObject({ source: 'PURCHASE', menuId: 24, reason: 'Purchase PI-00123 (12-11-2026) · scheduled from 01-12-2026' });
      expect(bulk.resolveItemTaxRates).toHaveBeenCalledWith(tx, [OIL], new Date('2026-12-01T00:00:00.000Z'));
      const entries = out.lines.get('L1')!.oldPrices;
      expect(entries.map((e) => [e.ipmId, e.kind, e.action, e.scheduledFrom ?? null, e.afterToken])).toEqual([
        [IPM_BOX, 'BOUGHT', 'UPDATE', null, `tok-${IPM_BOX}`],
        ['sched-box', 'BOUGHT', 'UPDATE', '2026-12-01', 'tok-sched-box'],
        [IPM_PCS, 'CHAIN', 'UPDATE', null, `tok-${IPM_PCS}`],
      ]);
      expect(entries[1].before).toMatchObject({ cost: '1361.18', prices: ['1600', '1650', '0', '0'] });
      expect(bulk.auditWrites).toHaveBeenCalledWith(tx, expect.any(Array), expect.objectContaining({
        scopeLabels: ['all branches', 'all branches, scheduled from 01-12-2026', 'all branches, chain from BOX'],
      }));
      // afterPurchase.moved counts the rows in force; the scheduled ones apart
      lines = [billLine({ oldPrices: entries })];
      expect((await service.afterPurchaseState(BILL.piId, BILL.accYear)).moved).toEqual({ rows: 2, chain: 1, created: 0, scheduled: 1 });
    });

    it('N4: COST_ONLY moves them too; one already at the new cost is not written; a kept line (D16) moves none', async () => {
      scheduled = [{ index: 0, ipmId: 'sched-box', effectiveFrom: '2026-12-01', future: true }];
      gateway.rowFigures.mockImplementation(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, figures('1361.18', '1296.361905', ['1600', '1650', '0', '0'])])));
      await run('COST_ONLY');
      expect(writer.updateBucketPrice.mock.calls.map((c) => c[1])).toEqual(['sched-box']);
      writer.updateBucketPrice.mockClear();
      gateway.rowFigures.mockImplementation(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, figures('1415.631000', '1348.220000', ['1600', '1650', '0', '0'])])));
      await run('COST_ONLY');
      expect(writer.updateBucketPrice).not.toHaveBeenCalled();
      newer = [{ itemId: OIL, unitId: BOX, keyMrp: D(-1), keySp: D(-1), at: new Date('2026-11-13T10:20:00+05:30'), who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' }];
      gateway.rowFigures.mockImplementation(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, figures('1', '1', ['1600', '1650', '0', '0'])])));
      await run('COST_ONLY');
      expect(writer.updateBucketPrice).not.toHaveBeenCalled();
    });

    it('N4: Cancel puts a scheduled row back by the same token rule; one changed since is kept, rule=SCHEDULED {from}', async () => {
      const before = figures('1361.18', '1296.361905', ['1600', '1650', '0', '0']);
      lines = [billLine({
        oldPrices: [
          { ipmId: IPM_BOX, kind: 'BOUGHT', action: 'UPDATE', before, afterToken: 't-box', itemName: 'GOLD WINNER OIL 1L', unitName: 'BOX' },
          { ipmId: 'sched-box', kind: 'BOUGHT', action: 'UPDATE', before, afterToken: 't-s1', itemName: 'GOLD WINNER OIL 1L', unitName: 'BOX', scheduledFrom: '2026-12-01' },
          { ipmId: 'sched-box2', kind: 'BOUGHT', action: 'UPDATE', before, afterToken: 't-s2', itemName: 'GOLD WINNER OIL 1L', unitName: 'BOX', scheduledFrom: '2027-01-01' },
        ],
      })];
      gateway.lockRowStates.mockResolvedValue(new Map([
        [IPM_BOX, { ipmId: IPM_BOX, token: 't-box', isDeleted: false }],
        ['sched-box', { ipmId: 'sched-box', token: 't-s1', isDeleted: false }],
        ['sched-box2', { ipmId: 'sched-box2', token: 'changed', isDeleted: false }],
      ]));
      gateway.lastChange.mockResolvedValue({ at: new Date('2026-11-13T10:20:00+05:30'), who: 'VKPOS', source: 'CHANGE_SELLING_PRICE' });
      const notes = await service.undo(tx, { piId: BILL.piId, accYear: BILL.accYear, refno: 'PI-00123', actor: USER });
      expect(gateway.lockRowStates).toHaveBeenCalledWith(tx, [IPM_BOX, 'sched-box', 'sched-box2']);
      expect(writer.updatePrice.mock.calls.map((c) => c[2])).toEqual([IPM_BOX, 'sched-box']);
      expect(writer.updatePrice.mock.calls[1][3]).toMatchObject({ ipmCostPrice: D('1361.18'), ipmSalesPriceA: D(1600) });
      expect(notes.map((n) => [n.code, n.rule ?? null, n.params])).toEqual([
        ['PUR_PRICE_RESTORED', null, { count: 2, bill: 'PI-00123', scheduled: 1 }],
        ['PUR_PRICE_KEPT_ON_CANCEL', 'SCHEDULED', {
          item: 'GOLD WINNER OIL 1L', unit: 'BOX', bill: 'PI-00123', from: '01-01-2027', when: '13-11 10:20 AM', who: 'VKPOS', source: 'Change Selling Price',
        }],
      ]);
    });

    it('N4 on the view save: each saved key\'s scheduled rows (locked with the rows) take the saved cost — menu 30, audited', async () => {
      const stepTx = {
        txnStatusLog: { findFirst: jest.fn(async () => ({ tslSeqNo: 2 })), create: jest.fn(async () => ({})) },
      } as unknown as Prisma.TransactionClient;
      gateway.rowFigures.mockImplementation(async (_tx: unknown, ids: string[]) => new Map(ids.map((id) => [id, figures('1361.18', '1296.361905', ['1600', '1650', '0', '0'])])));
      await savingFromView(async (hooks) => {
        expect(hooks!.lockFuture).toBe(true);
        const prepared = {
          actor: USER,
          candidates: [{ lineNo: 1, companyId: CO, itemId: OIL, uomId: BOX, mrp: null, salePrice: null, costRate: 1415.631, costWot: 1348.22, itemName: 'GOLD WINNER OIL 1L' }],
          costs: [{ itemCode: 'OIL', itemName: 'GOLD WINNER OIL 1L', uomBelongs: true, trackMrp: false, trackSalePrice: false, costRate: 0, costWot: 0, costBasis: null, minPrice: 0 }],
          resolutions: [{ targetScope: 'CHAIN', targetBranchId: null }],
          futureRows: [{ index: 0, ipmId: 'sched-box', effectiveFrom: '2026-12-01', future: true }],
        } as never;
        await hooks!.afterWrite(stepTx, { saved: 1 } as never, prepared);
      });
      expect(writer.updateBucketPrice).toHaveBeenCalledTimes(1);
      const [, id, candidate, origin] = writer.updateBucketPrice.mock.calls[0];
      expect(id).toBe('sched-box');
      expect(candidate).toMatchObject({ costRate: 1415.631, costWot: 1348.22 });
      expect(candidate.levels.map((l: { price: number }) => l.price)).toEqual([1600, 1650]);
      expect(origin).toMatchObject({ source: 'CHANGE_SELLING_PRICE', menuId: 30, reason: 'From purchase PI-00123 (12-11-2026) · scheduled from 01-12-2026' });
      expect(bulk.auditWrites).toHaveBeenCalledWith(stepTx, [expect.objectContaining({ ipmId: 'sched-box' })], expect.objectContaining({
        writer: 'From purchase PI-00123 (12-11-2026)', scopeLabels: ['all branches, scheduled from 01-12-2026'],
      }));
      // and the PRICES_REVIEWED step after it
      expect((stepTx as unknown as { txnStatusLog: { create: jest.Mock } }).txnStatusLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tslEvent: 'PRICES_REVIEWED', tslSeqNo: 3 }),
      });
    });

    // ── N5 ──
    it('N5: each bill line\'s OWN later bill (lineLaterBills), so the chip names the right one', async () => {
      rows = [...oilRows(), ...bruRows()];
      lines = [billLine(), bruLine({ landedCostWot: D(400), portions: [{ mrp: D(560), salePrice: null, baseQty: D(12) }] })];
      later = [laterLine({ piId: 'p140', refno: 'PI-00140', docDate: '2026-11-20', docDatetime: new Date('2026-11-20T09:00:00+05:30'), itemId: BRU, mrp: D(560) })];
      const view = await service.afterPurchaseView(BILL.piId, BILL.accYear);
      expect([...view.lineLaterBills]).toEqual([['L2', { piId: 'p140', refno: 'PI-00140', docDate: '2026-11-20T00:00:00.000Z' }]]);
      expect(view.state.laterBill).toEqual({ piId: 'p140', refno: 'PI-00140', docDate: '2026-11-20T00:00:00.000Z' });
      // two lines overtaken by two bills: each names its own (afterPurchase.laterBill the newest)
      later = [...later, laterLine()];
      const both = await service.afterPurchaseView(BILL.piId, BILL.accYear);
      expect(both.lineLaterBills.get('L1')).toMatchObject({ refno: 'PI-00131' });
      expect(both.lineLaterBills.get('L2')).toMatchObject({ refno: 'PI-00140' });
      expect(both.state.laterBill).toMatchObject({ refno: 'PI-00140' });
    });
  });
});
