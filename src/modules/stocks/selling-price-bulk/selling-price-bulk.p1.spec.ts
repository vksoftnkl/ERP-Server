import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import type { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import {
  PriceBucketGateway,
  type BucketPriceCandidate,
  type PriceLineRecord,
  type RowCost,
} from './price-bucket.gateway';
import { StockCostReader } from './stock-cost.reader';
import { markupReproduces, roundToStep } from './selling-price-math.helper';
import type { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';

/**
 * Change Selling Price P1 (plan 2026-11-23, Shared/Prathap/inventory/
 * plan-change-selling-price-rework-p1-2026-11-23.md, with the user's answers): below cost on
 * the HIGHER of the line cost and the stock cost (A3 option C), the every-branch check and its
 * O10 skips, + Line (isNew / LINE_EXISTS), Back to all branches (Q1, Q5), the per-line scope
 * re-check, the branch rule, the line's own cost kept (A1), the markup kept (decision 20), and
 * the grid's lines (paging by item, spread).
 */
const COMPANY = '01000000-0000-7000-8000-0000000000c1';
const BRANCH = '01000000-0000-7000-8000-0000000000b1';
const OTHER_BRANCH = '01000000-0000-7000-8000-0000000000b2';
const USER = '01000000-0000-7000-8000-0000000000a1';
const ITEM = '01000000-0000-7000-8000-000000000001';
const MRP_ITEM = '01000000-0000-7000-8000-000000000002';
const UOM = '01000000-0000-7000-8000-000000000011';
const TAX = '01000000-0000-7000-8000-000000000031';
const CHAIN_ROW = '01000000-0000-7000-8000-000000000041';
const OWN_ROW = '01000000-0000-7000-8000-000000000042';
const LATER_ROW = '01000000-0000-7000-8000-000000000043';
const TODAY = '2026-11-23';

const dec = (value: number) => new Prisma.Decimal(value);

/**
 * 2026-11-27 — the reader answers the stock cost WITHOUT GST; the judge adds the item's GST (5 % in
 * this file) with stockCostWithGst. `wot5(90)` is the without-GST figure of a 90.00 stock cost.
 */
const wot5 = (withGst: number) => withGst / 1.05;

/** A cost probe answer: line cost 100, stock cost 90 (85.714286 + 5 % GST) unless overridden. */
const rowCost = (overrides: Partial<RowCost> = {}): RowCost => ({
  itemCode: 'ZT1',
  itemName: 'ZT-CSP-PLAIN',
  uomBelongs: true,
  trackMrp: false,
  trackSalePrice: false,
  costRate: 90,
  costWot: 85.714286,
  costBasis: 'ITEM',
  minPrice: 0,
  unitName: 'PCS',
  unitFactor: 1,
  lineCost: 100,
  lineCostWot: 95.238095,
  lineRoundOff: 0,
  stockCostWot: 85.714286,
  stockCostBasis: 'ITEM',
  ...overrides,
});

describe('Change Selling Price P1 — SellingPriceBulkService', () => {
  let service: SellingPriceBulkService;
  let rights: { um_can_view: boolean; um_can_edit: boolean; um_can_delete: boolean };
  let prisma: { $transaction: jest.Mock; $queryRaw: jest.Mock } & Record<string, unknown>;
  let tx: Record<string, unknown>;
  let audit: { logEntityChange: jest.Mock };
  let ctx: {
    getUserId: jest.Mock;
    getUserType: jest.Mock;
    getDeviceId: jest.Mock;
    getBranchId: jest.Mock;
  };
  let settings: { resolveEffective: jest.Mock };
  let cost: RowCost;
  let gateway: Record<string, jest.Mock>;
  let writer: Record<string, jest.Mock>;

  beforeEach(() => {
    rights = { um_can_view: true, um_can_edit: true, um_can_delete: true };
    cost = rowCost();
    tx = {
      itemMaster: {
        findMany: jest.fn().mockResolvedValue([
          { itemId: ITEM, itemDefaultTaxId: TAX, itemInclTax: true },
          { itemId: MRP_ITEM, itemDefaultTaxId: TAX, itemInclTax: true },
        ]),
      },
      itemTaxHistory: { findMany: jest.fn().mockResolvedValue([]) },
      taxRateMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { taxId: TAX, taxRatePerc: 5, taxCessBasis: 'NONE', taxAcessBasis: 'NONE' },
          ]),
      },
    };
    prisma = {
      ...tx,
      $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
      $queryRaw: jest.fn(() => Promise.resolve([rights])),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    ctx = {
      getUserId: jest.fn().mockReturnValue(USER),
      getUserType: jest.fn().mockReturnValue('SUPER ADMIN'),
      getDeviceId: jest.fn().mockReturnValue(null),
      getBranchId: jest.fn().mockReturnValue(BRANCH),
    };
    settings = {
      resolveEffective: jest
        .fn()
        .mockResolvedValue([{ asdKey: 'inventory.below_cost_price', value: 'warning' }]),
    };
    const real = PriceBucketGateway.prototype;
    gateway = {
      calendar: jest.fn().mockResolvedValue({ today: TODAY, latest: '2027-11-23' }),
      loadRowCosts: jest.fn((_tx: unknown, rows: unknown[]) =>
        Promise.resolve(rows.map(() => cost)),
      ),
      // the real verdicts and the real branch rule (neither uses `this`)
      validateRows: jest.fn((c: never, m: never, o: never) => real.validateRows.call({}, c, m, o)),
      branchProblems: jest.fn((c: never, b: never, o: never) =>
        real.branchProblems.call({}, c, b, o),
      ),
      otherBranchStockCosts: jest.fn((_tx: unknown, a: { probes: unknown[] }) =>
        Promise.resolve(a.probes.map(() => [])),
      ),
      priceLevels: jest.fn().mockResolvedValue([
        { level: 1, name: 'WS', active: true },
        { level: 2, name: 'RET', active: true },
        { level: 3, name: 'BWH', active: false },
        { level: 4, name: 'HOT', active: false },
      ]),
      branchLabels: jest.fn((_tx: unknown, ids: string[]) =>
        Promise.resolve(
          new Map(ids.map((id) => [id.toLowerCase(), id === BRANCH ? 'Acme CBE' : 'Counter2'])),
        ),
      ),
      findBucketRowForUpdate: jest.fn().mockResolvedValue(null),
      // P2 review S5 / N1 — the sorted locks at the start of every write (no row found: keys only).
      findPriceRows: jest.fn().mockResolvedValue([]),
      lockPriceKeys: jest.fn().mockResolvedValue(undefined),
      lockPriceRows: jest.fn().mockResolvedValue(undefined),
      snapshotRows: jest.fn((_tx: unknown, ids: string[]) =>
        Promise.resolve(
          new Map(ids.map((id) => [id, { ipm_id: id, ipm_bucket_mrp: null, ipm_bucket_sp: null }])),
        ),
      ),
      listNoStock: jest.fn().mockResolvedValue([]),
      userBranchId: jest.fn().mockResolvedValue(null),
      listPriceLines: jest.fn(),
      taxNames: jest.fn().mockResolvedValue(new Map([[TAX, 'GST 5%']])),
      lockPriceRow: jest.fn(),
      liveOwnRowsOfKey: jest.fn(),
      priceAfterRemoval: jest.fn(),
    };
    writer = {
      updateBucketPrice: jest.fn().mockResolvedValue(CHAIN_ROW),
      insertBucketPrice: jest.fn().mockResolvedValue(OWN_ROW),
      softDeletePriceRow: jest.fn().mockResolvedValue(undefined),
    };
    service = new SellingPriceBulkService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLogService,
      ctx as unknown as RequestContextService,
      settings as unknown as AppSettingValueService,
      gateway as unknown as PriceBucketGateway,
      writer as unknown as PriceMasterWriter,
    );
  });

  const line = (overrides: Record<string, unknown> = {}) => ({
    lineNo: 1,
    itemId: ITEM,
    uomId: UOM,
    mrp: null,
    salePrice: null,
    priceScope: 'CHAIN',
    scope: 'CHAIN',
    levels: [
      { level: 1, price: 120 },
      { level: 2, price: 130 },
    ],
    ...overrides,
  });
  const save = (rows: unknown[], extra: Record<string, unknown> = {}) =>
    ({
      companyId: COMPANY,
      branchId: BRANCH,
      rows,
      ...extra,
    }) as unknown as SaveSellingPriceBulkDto;
  const storeUser = () => ctx.getUserType.mockReturnValue('STORE MANAGER');
  const codesOf = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e: unknown) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    const body = error.getResponse() as { errors: Array<Record<string, unknown>> };
    return {
      status: error.getStatus(),
      errors: body.errors,
      codes: body.errors.map((e) => e.code),
    };
  };

  // ── A3 option C — the higher of the line's own cost and the stock cost ──────
  describe('below cost on the higher of the two costs (A3 option C)', () => {
    it('judges on the line cost when it is the higher one: rule LINE_COST, both costs named', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(90) });
      const result = await service.saveBulk(save([line({ levels: [{ level: 1, price: 95 }] })]));

      expect(result.needsConfirm).toBe(true);
      expect(result.problems).toEqual([
        expect.objectContaining({
          verdict: 'BELOW_COST',
          code: 'STOCK_PRICE_BELOW_COST',
          rule: 'LINE_COST',
          cost: 100,
          lineCost: 100,
          stockCost: 90,
          message: 'ZT-CSP-PLAIN: 95 is below the last purchase cost 100.00 (stock cost 90.00).',
          params: expect.objectContaining({
            level: 'WS',
            price: '95.00',
            cost: '100.00',
            lineCost: '100.00',
            stockCost: '90.00',
            unit: 'PCS',
            item: 'ZT-CSP-PLAIN',
            n: 1,
          }),
        }),
      ]);
    });

    it('judges on the stock cost when it is the higher one, even under a typed lower cost: rule STOCK_COST', async () => {
      cost = rowCost({ stockCostWot: wot5(200) });
      const result = await service.saveBulk(
        save([line({ costPrice: 100, levels: [{ level: 1, price: 150 }] })]),
      );

      expect(result.problems[0]).toMatchObject({
        rule: 'STOCK_COST',
        cost: 200,
        lineCost: 100,
        stockCost: 200,
      });
      // the typed cost is still what the line stores
      expect(writer.updateBucketPrice).not.toHaveBeenCalled();
      const prepared = await service.prepareBulk(tx as never, save([line({ costPrice: 100 })]), {
        actor: USER,
        policy: 'warning',
      });
      expect(prepared.candidates[0]).toMatchObject({
        costRate: 100,
        judgeCost: 200,
        stockCost: 200,
      });
    });

    it('a price between the two costs is below cost (the higher one wins), above both is not', async () => {
      cost = rowCost({ lineCost: 300, stockCostWot: wot5(200) });
      const between = await service.saveBulk(save([line({ levels: [{ level: 1, price: 210 }] })]));
      expect(between.problems).toEqual([expect.objectContaining({ rule: 'LINE_COST', cost: 300 })]);

      const above = await service.saveBulk(save([line({ levels: [{ level: 1, price: 310 }] })]));
      expect(above).toMatchObject({ needsConfirm: false, problems: [] });
    });

    it('with one cost known there is no rule and the old wording stands', () => {
      const candidate = {
        lineNo: 1,
        companyId: COMPANY,
        itemId: ITEM,
        uomId: UOM,
        itemCode: null,
        itemName: 'ZT',
        bucketId: null,
        mrp: null,
        salePrice: null,
        levels: [{ level: 1, price: 80, priceWot: 0, markupPerc: 0 }],
        minPrice: null,
        roundOff: null,
        costRate: 0,
        costWot: 0,
        actor: USER,
        judgeCost: 90,
        stockCost: 90,
      } as BucketPriceCandidate;
      const [problem] = PriceBucketGateway.prototype.validateRows.call({}, [candidate], [0]);
      expect(problem).toMatchObject({
        verdict: 'BELOW_COST',
        cost: 90,
        lineCost: null,
        stockCost: 90,
      });
      expect(problem).not.toHaveProperty('rule');
      expect(problem.message).toBe('ZT: 80 is below the cost 90.');
    });

    it('the restrict refusal carries the rule and the params for the wording variant', async () => {
      settings.resolveEffective.mockResolvedValue([
        { asdKey: 'inventory.below_cost_price', value: 'restrict' },
      ]);
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(90) });
      const refused = await codesOf(
        service.saveBulk(save([line({ levels: [{ level: 1, price: 95 }] })])),
      );

      expect(refused.status).toBe(422);
      expect(refused.errors[0]).toMatchObject({
        code: 'STOCK_PRICE_BELOW_COST',
        rule: 'LINE_COST',
        params: expect.objectContaining({ level: 'WS', lineCost: '100.00' }),
      });
    });

    it('menu 244 gets the same judge: prepareBulk without keepLineCost still judges the stock cost', async () => {
      cost = rowCost({ costRate: 90, lineCost: 100, stockCostWot: wot5(150) });
      const prepared = await service.prepareBulk(
        tx as never,
        save([
          line({
            scope: undefined,
            priceScope: 'BRANCH',
            costPrice: 120,
            levels: [{ level: 1, price: 140 }],
          }),
        ]),
        { actor: USER, policy: 'warning' },
      );
      expect(prepared.belowCost).toEqual([
        expect.objectContaining({ rule: 'STOCK_COST', cost: 150 }),
      ]);
    });
  });

  // ── A1 — the line's own cost is kept when no cost is typed ─────────────────
  describe("the line's own cost (A1)", () => {
    it('menu 30 (saveBulk) keeps the line cost and its w/o-tax half when no costPrice is sent', async () => {
      cost = rowCost({
        costRate: 90,
        costWot: 85.714286,
        lineCost: 100,
        lineCostWot: 95.238095,
        stockCostWot: wot5(90),
      });
      await service.saveBulk(save([line({ levels: [{ level: 1, price: 120 }] })]));

      expect(writer.insertBucketPrice.mock.calls[0][1]).toMatchObject({
        costRate: 100,
        costWot: 95.238095,
      });
    });

    it('a typed costPrice is stored, whatever the stock cost', async () => {
      await service.saveBulk(save([line({ costPrice: 105, levels: [{ level: 1, price: 120 }] })]));

      expect(writer.insertBucketPrice.mock.calls[0][1]).toMatchObject({ costRate: 105 });
    });

    it('a key with no line yet (no line cost) takes the stock-first cost, as before', async () => {
      cost = rowCost({ costRate: 90, lineCost: null, lineCostWot: null });
      await service.saveBulk(save([line({ levels: [{ level: 1, price: 120 }] })]));

      expect(writer.insertBucketPrice.mock.calls[0][1]).toMatchObject({ costRate: 90 });
    });

    it('purchases and menu 244 (prepareBulk without keepLineCost) store the stock-first cost, as before', async () => {
      const prepared = await service.prepareBulk(tx as never, save([line()]), {
        actor: USER,
        policy: 'allow',
      });

      expect(prepared.candidates[0]).toMatchObject({ costRate: 90 });
    });
  });

  // ── decision 20 — a sent markup kept when it reproduces the price ──────────
  describe('the markup % kept as typed (decision 20)', () => {
    it('keeps 20 % when cost × 1.20 rounded to the R.Off is the price; recomputes otherwise', async () => {
      await service.saveBulk(
        save([
          line({
            costPrice: 100,
            roundOff: 1,
            levels: [
              { level: 1, price: 120, markupPerc: 20 },
              { level: 2, price: 125, markupPerc: 20 },
            ],
          }),
        ]),
      );
      const levels = (writer.insertBucketPrice.mock.calls[0][1] as BucketPriceCandidate).levels;
      expect(levels[0].markupPerc).toBe(20);
      // 125 is not 100 × 1.20: the server's own figure, the price wins
      expect(levels[1].markupPerc).toBe(25);
    });

    it('the helper is the card load rule: nearest step, within 0.005', () => {
      expect(roundToStep(113.3625, 0.05)).toBeCloseTo(113.35, 6);
      expect(markupReproduces(100, 12.5, 0.5, 112.5)).toBe(true);
      expect(markupReproduces(100, 12.4, 1, 112)).toBe(true);
      expect(markupReproduces(100, 12.4, 0, 112)).toBe(false);
      expect(markupReproduces(0, 10, 0, 0)).toBe(false);
    });
  });

  // ── C6 / O10 — the every-branch check ───────────────────────────────────────
  describe('an All branches save is judged at every other branch (C6, O10)', () => {
    const counter2 = (stockCost: number) => ({
      branchId: OTHER_BRANCH,
      branchName: 'Counter2',
      stockQty: 50,
      stockCost,
      stockCostWot: stockCost / 1.05,
      basis: 'ITEM' as const,
    });

    it('names a branch whose stock cost is above the line cost and the price; asks before writing', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(90) });
      gateway.otherBranchStockCosts.mockResolvedValue([[counter2(125)]]);
      const result = await service.saveBulk(save([line()]));

      expect(gateway.otherBranchStockCosts).toHaveBeenCalledWith(tx, {
        companyId: COMPANY,
        excludeBranchId: BRANCH,
        onDate: TODAY,
        // 2026-11-27 — the item's GST %: the other branches' stock cost is made WITH it
        probes: [{ itemId: ITEM, uomId: UOM, mrp: null, salePrice: null, taxPerc: 5 }],
      });
      expect(result.needsConfirm).toBe(true);
      expect(result.problems).toEqual([
        expect.objectContaining({
          verdict: 'BELOW_COST',
          rule: 'BRANCHES',
          level: 1,
          branchId: OTHER_BRANCH,
          branchName: 'Counter2',
          cost: 125,
          message: 'ZT-CSP-PLAIN: WS 120.00 is below the stock cost at Counter2 (125.00).',
          params: expect.objectContaining({
            level: 'WS',
            price: '120.00',
            branch: 'Counter2',
            cost: '125.00',
          }),
        }),
      ]);
      expect(writer.updateBucketPrice).not.toHaveBeenCalled();
      expect(writer.insertBucketPrice).not.toHaveBeenCalled();
    });

    it('a branch whose stock cost is under the line cost is not named (the line cost was reported once)', async () => {
      cost = rowCost({ lineCost: 130, stockCostWot: wot5(90) });
      gateway.otherBranchStockCosts.mockResolvedValue([[counter2(125)]]);
      const result = await service.saveBulk(save([line({ levels: [{ level: 1, price: 120 }] })]));

      expect(result.problems.map((p) => p.rule)).toEqual(['LINE_COST']);
    });

    it('judges the active levels priced above 0 only, and confirmed writes', async () => {
      cost = rowCost({ lineCost: 100 });
      gateway.otherBranchStockCosts.mockResolvedValue([[counter2(140)]]);
      const asked = await service.saveBulk(
        save([
          line({
            levels: [
              { level: 1, price: 120 },
              { level: 2, price: 0 },
              { level: 3, price: 110 },
            ],
          }),
        ]),
      );
      // the other branch: level 1 only (2 is 0, 3 is not active); review S4 (11-24): the branch on
      // screen judges the same way — the 0 of level 2 and the hidden level 3 are not asked about
      expect(asked.problems.filter((p) => p.rule === 'BRANCHES').map((p) => p.level)).toEqual([1]);
      expect(asked.problems.filter((p) => p.rule !== 'BRANCHES').map((p) => p.level)).toEqual([]);

      const saved = await service.saveBulk(save([line()], { confirmed: true }));
      expect(saved.needsConfirm).toBe(false);
      // WS 120 and RET 130 are both under Counter2's 140: still reported, now written
      expect(saved.problems.map((p) => [p.rule, p.level])).toEqual([
        ['BRANCHES', 1],
        ['BRANCHES', 2],
      ]);
      expect(writer.insertBucketPrice).toHaveBeenCalledTimes(1);
    });

    it('is not run for a line saved at this branch only', async () => {
      await service.saveBulk(save([line({ scope: 'BRANCH', priceScope: 'BRANCH' })]));
      expect(gateway.otherBranchStockCosts).not.toHaveBeenCalled();
    });

    it('O10: the reader keeps branches with stock on hand, a stock cost and no own line', async () => {
      const client = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            ord: 1n,
            branchId: OTHER_BRANCH,
            branchName: 'Counter2',
            stockQty: dec(50),
            stockCostWot: dec(10),
            basis: 'ITEM',
          },
          {
            ord: 1n,
            branchId: 'x',
            branchName: 'No cost',
            stockQty: dec(5),
            stockCostWot: null,
            basis: null,
          },
        ]),
      };
      const answer = await StockCostReader.otherBranches(client, {
        companyId: COMPANY,
        excludeBranchId: BRANCH,
        probes: [{ itemId: ITEM, uomId: UOM, mrp: null, salePrice: null, taxPerc: 5 }],
      });
      // 2026-11-27 — the SQL answers 10.00 without GST; the branch's stock cost is 10.50 with 5 % GST
      expect(answer).toEqual([
        [expect.objectContaining({ branchName: 'Counter2', stockCost: 10.5, stockCostWot: 10 })],
      ]);
      const [strings, ...values] = client.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = Prisma.sql(strings, ...values).sql;
      expect(sql).toContain('WHERE st.qty > 0');
      expect(sql).toContain('AND NOT EXISTS');
      expect(sql).toContain('o.ipm_branch_id  = p.br_id');
      expect(sql).toContain('b.br_id        <> ');
    });
  });

  // ── §4.8 — + Line ───────────────────────────────────────────────────────────
  describe('+ Line (isNew)', () => {
    it('refuses a key that already has a line at the target scope, naming it (n always sent)', async () => {
      gateway.findBucketRowForUpdate.mockResolvedValue({
        ipmId: CHAIN_ROW,
        effectiveFrom: '1900-01-01',
        effectiveTo: '9999-12-31',
      });
      const refused = await codesOf(service.saveBulk(save([line({ lineNo: 7, isNew: true })])));

      expect(refused).toMatchObject({ status: 422, codes: ['STOCK_PRICE_LINE_EXISTS'] });
      expect(refused.errors[0]).toMatchObject({
        field: 'rows.7',
        existingIpmId: CHAIN_ROW,
        params: { unit: 'PCS', mrp: '', branch: 'All branches', n: 7, item: 'ZT-CSP-PLAIN' },
      });
      expect(writer.insertBucketPrice).not.toHaveBeenCalled();
    });

    it('names this branch for a branch line and the MRP of an MRP line', async () => {
      cost = rowCost({ trackMrp: true });
      gateway.findBucketRowForUpdate.mockResolvedValue({
        ipmId: OWN_ROW,
        effectiveFrom: '1900-01-01',
        effectiveTo: '9999-12-31',
      });
      const refused = await codesOf(
        service.saveBulk(
          save([
            line({ itemId: MRP_ITEM, mrp: 540, isNew: true, scope: 'BRANCH', priceScope: null }),
          ]),
        ),
      );
      expect(refused.errors[0].params).toMatchObject({
        mrp: 'MRP 540.00',
        branch: 'Acme CBE',
        n: 1,
      });
    });

    it('an MRP item new line without an MRP is STOCK_PRICE_BUCKET_MRP_ZERO', async () => {
      cost = rowCost({ trackMrp: true });
      const refused = await codesOf(
        service.saveBulk(save([line({ itemId: MRP_ITEM, mrp: 0, isNew: true })])),
      );
      expect(refused).toMatchObject({ status: 422, codes: ['STOCK_PRICE_BUCKET_MRP_ZERO'] });
      expect(refused.errors[0].field).toBe('rows.1.mrp');
    });

    it('a new key is inserted at its scope with its typed cost', async () => {
      cost = rowCost({ trackMrp: true, lineCost: null, stockCostWot: null });
      await service.saveBulk(
        save([
          line({
            itemId: MRP_ITEM,
            mrp: 580,
            isNew: true,
            priceScope: null,
            costPrice: 488,
            levels: [{ level: 1, price: 537 }],
          }),
        ]),
      );
      const [, candidate, scope] = writer.insertBucketPrice.mock.calls[0] as [
        unknown,
        BucketPriceCandidate,
        { targetBranchId: string | null },
      ];
      expect(candidate).toMatchObject({ mrp: 580, costRate: 488 });
      expect(scope.targetBranchId).toBeNull();
    });
  });

  // ── §4.6 — per-line scope, the branch rule ──────────────────────────────────
  describe('who saves which line (§4.6)', () => {
    it('each line takes its own scope: CHAIN updates the All branches line, BRANCH makes an own line', async () => {
      gateway.findBucketRowForUpdate.mockImplementation(
        (_tx: unknown, _c: unknown, scope: { targetScope: string }) =>
          Promise.resolve(
            scope.targetScope === 'CHAIN'
              ? { ipmId: CHAIN_ROW, effectiveFrom: '1900-01-01', effectiveTo: '9999-12-31' }
              : null,
          ),
      );
      await service.saveBulk(
        save([
          line({ lineNo: 1 }),
          line({
            lineNo: 2,
            uomId: '01000000-0000-7000-8000-000000000012',
            scope: 'BRANCH',
            priceScope: 'CHAIN',
          }),
        ]),
      );
      expect(writer.updateBucketPrice).toHaveBeenCalledTimes(1);
      expect(writer.insertBucketPrice.mock.calls[0][2]).toMatchObject({
        targetScope: 'BRANCH',
        targetBranchId: BRANCH,
        createsBranchOverride: true,
      });
      const notes = audit.logEntityChange.mock.calls.map(
        ([entry]: [{ notes: string }]) => entry.notes,
      );
      expect(notes[0]).toContain('all branches');
      expect(notes[1]).toContain('this branch');
    });

    it('a store user sending a line at CHAIN is refused 403 CHAIN_HQ_ONLY naming the line', async () => {
      storeUser();
      const refused = await codesOf(service.saveBulk(save([line({ lineNo: 4 })])));

      expect(refused).toMatchObject({ status: 403, codes: ['STOCK_PRICE_CHAIN_HQ_ONLY'] });
      expect(refused.errors[0].field).toBe('rows.4.scope');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a store user saving an All branches line as BRANCH makes his own line ("→ this branch")', async () => {
      storeUser();
      await service.saveBulk(save([line({ scope: 'BRANCH', priceScope: 'CHAIN' })]));
      expect(writer.insertBucketPrice.mock.calls[0][2]).toMatchObject({
        targetBranchId: BRANCH,
        createsBranchOverride: true,
      });
    });

    it('a store user on another branch is 403 BRANCH_HQ_ONLY on GET, POST and Back; head office is not', async () => {
      storeUser();
      const other = { companyId: COMPANY, branchId: OTHER_BRANCH };
      for (const attempt of [
        service.listPriceLines(other),
        service.listBuckets(ITEM, other),
        service.saveBulk(save([line({ scope: 'BRANCH' })], { branchId: OTHER_BRANCH })),
        service.backToAllBranches({ ...other, ipmId: OWN_ROW }),
      ]) {
        expect(await codesOf(attempt)).toMatchObject({
          status: 403,
          codes: ['STOCK_PRICE_BRANCH_HQ_ONLY'],
        });
      }
      ctx.getUserType.mockReturnValue('ADMIN');
      gateway.listPriceLines.mockResolvedValue({
        items: [],
        meta: { limit: 200, offset: 0, count: 0, lines: 0 },
      });
      await expect(service.listPriceLines(other)).resolves.toMatchObject({ items: [] });
    });

    it("a login with no device branch falls back to the user's own branch", async () => {
      storeUser();
      ctx.getBranchId.mockReturnValue(null);
      gateway.userBranchId.mockResolvedValue(BRANCH.toUpperCase());
      gateway.listPriceLines.mockResolvedValue({
        items: [],
        meta: { limit: 200, offset: 0, count: 0, lines: 0 },
      });
      await expect(
        service.listPriceLines({ companyId: COMPANY, branchId: BRANCH }),
      ).resolves.toBeTruthy();
      gateway.userBranchId.mockResolvedValue(null);
      expect(
        await codesOf(service.listPriceLines({ companyId: COMPANY, branchId: BRANCH })),
      ).toMatchObject({
        codes: ['STOCK_PRICE_BRANCH_HQ_ONLY'],
      });
    });

    it('the GET needs Edit on menu 30 (O8: no read-only mode)', async () => {
      rights.um_can_edit = false;
      expect(
        await codesOf(service.listPriceLines({ companyId: COMPANY, branchId: BRANCH })),
      ).toMatchObject({
        status: 403,
        codes: ['STOCK_PRICE_RIGHT_EDIT'],
      });
      expect(gateway.listPriceLines).not.toHaveBeenCalled();
    });
  });

  // ── §4.9 — Back to all branches ─────────────────────────────────────────────
  describe('Back to all branches (§4.9, Q1, Q5)', () => {
    const ownLine = (overrides: Record<string, unknown> = {}) => ({
      ipmId: OWN_ROW,
      companyId: COMPANY,
      branchId: BRANCH,
      itemId: ITEM,
      uomId: UOM,
      keyMrp: 540,
      keySp: -1,
      isDeleted: false,
      itemName: 'BRU 200G',
      unitName: 'PCS',
      ...overrides,
    });
    const back = (ipmId = OWN_ROW) =>
      service.backToAllBranches({ companyId: COMPANY, branchId: BRANCH, ipmId });

    beforeEach(() => {
      gateway.lockPriceRow.mockResolvedValue(ownLine());
      gateway.liveOwnRowsOfKey.mockResolvedValue([
        { ipmId: OWN_ROW, effectiveFrom: '1900-01-01' },
        { ipmId: LATER_ROW, effectiveFrom: '2026-12-01' },
      ]);
      gateway.priceAfterRemoval.mockResolvedValue({
        ipmId: CHAIN_ROW,
        branchId: null,
        keyMrp: 540,
        keySp: -1,
        prices: [505, 530, 0, 0],
      });
    });

    it('soft-deletes the own line and its scheduled rows, logged and audited, and says what prices it now', async () => {
      const result = await back();

      expect(result).toEqual({
        removed: 2,
        removedIds: [OWN_ROW, LATER_ROW],
        nowPricedBy: {
          lineKind: 'MRP',
          branchId: null,
          ipmId: CHAIN_ROW,
          prices: [505, 530, 0, 0],
        },
      });
      expect(writer.softDeletePriceRow.mock.calls.map((call) => [call[1], call[3]])).toEqual([
        [
          OWN_ROW,
          expect.objectContaining({
            source: 'CHANGE_SELLING_PRICE',
            reason: 'Back to all branches',
          }),
        ],
        [LATER_ROW, expect.objectContaining({ reason: 'Back to all branches' })],
      ]);
      expect(gateway.priceAfterRemoval).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ excludeIds: [OWN_ROW, LATER_ROW], keyMrp: 540 }),
      );
      expect(audit.logEntityChange).toHaveBeenCalledTimes(2);
      expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({
        action: 'cancel',
        pk: OWN_ROW,
      });
    });

    it('needs Delete on menu 30 as well as Edit (Q1)', async () => {
      rights.um_can_delete = false;
      expect(await codesOf(back())).toMatchObject({
        status: 403,
        codes: ['STOCK_PRICE_RIGHT_DELETE'],
      });
      rights.um_can_delete = true;
      rights.um_can_edit = false;
      expect(await codesOf(back())).toMatchObject({
        status: 403,
        codes: ['STOCK_PRICE_RIGHT_EDIT'],
      });
      expect(writer.softDeletePriceRow).not.toHaveBeenCalled();
    });

    it("refuses an All branches line (BACK_NOT_OWN) and another branch's line", async () => {
      gateway.lockPriceRow.mockResolvedValue(ownLine({ branchId: null }));
      expect(await codesOf(back())).toMatchObject({
        status: 422,
        codes: ['STOCK_PRICE_BACK_NOT_OWN'],
      });

      gateway.lockPriceRow.mockResolvedValue(ownLine({ branchId: OTHER_BRANCH }));
      expect(await codesOf(back())).toMatchObject({
        status: 422,
        codes: ['STOCK_PRICE_BACK_NOT_OWN'],
        errors: [expect.objectContaining({ rule: 'OTHER_BRANCH' })], // its own wording (NIT 11)
      });
      // a store user may not even reach another branch's line
      storeUser();
      expect(await codesOf(back())).toMatchObject({
        status: 403,
        codes: ['STOCK_PRICE_BRANCH_HQ_ONLY'],
      });
      expect(writer.softDeletePriceRow).not.toHaveBeenCalled();
    });

    it('refuses when nothing would price the unit afterwards, naming item, unit and branch', async () => {
      gateway.priceAfterRemoval.mockResolvedValue(null);
      const refused = await codesOf(back());

      expect(refused).toMatchObject({ status: 422, codes: ['STOCK_PRICE_BACK_NOTHING_LEFT'] });
      expect(refused.errors[0].params).toEqual({
        item: 'BRU 200G',
        unit: 'PCS',
        branch: 'Acme CBE',
      });
      expect(writer.softDeletePriceRow).not.toHaveBeenCalled();
    });

    it('a stale id (the card rewrote the line) finds the live line by its key; none live is 404', async () => {
      gateway.lockPriceRow.mockResolvedValue(ownLine({ isDeleted: true }));
      await expect(back()).resolves.toMatchObject({ removed: 2 });

      gateway.liveOwnRowsOfKey.mockResolvedValue([]);
      expect(await codesOf(back())).toMatchObject({
        status: 404,
        codes: ['STOCK_ITEM_PRICE_NOT_FOUND'],
      });
      gateway.lockPriceRow.mockResolvedValue(null);
      expect(await codesOf(back())).toMatchObject({
        status: 404,
        codes: ['STOCK_ITEM_PRICE_NOT_FOUND'],
      });
    });

    it("a store user sends his own branch's line back", async () => {
      storeUser();
      await expect(back()).resolves.toMatchObject({ removed: 2 });
    });
  });

  // ── §7.1 — the grid's lines ─────────────────────────────────────────────────
  describe('GET lines (§7.1)', () => {
    const record = (overrides: Partial<PriceLineRecord> = {}): PriceLineRecord => ({
      itemId: ITEM,
      itemCode: 'ZT1',
      barcode: null,
      itemName: 'ZT-CSP-PLAIN',
      uomId: UOM,
      unitName: 'PCS',
      stockQty: 0,
      mrp: null,
      salePrice: null,
      maxPrice: 0,
      priceSource: 'MASTER',
      priceScope: 'CHAIN',
      bucketId: CHAIN_ROW,
      costRate: 90,
      costWot: 85.714286,
      costBasis: 'ITEM',
      minPrice: 0,
      roundOff: 0,
      prices: [120, 130, 0, 0],
      lineKind: 'HEADLINE',
      lineCost: 100,
      lineCostWot: 95.238095,
      stockCostWot: 85.714286,
      stockCostBasis: 'ITEM',
      profitType: 'By %',
      companyId: COMPANY,
      companyName: 'Acme Foods',
      branchId: null,
      branchName: null,
      unitFactor: 1,
      unitSlNo: 2,
      isDefaultUnit: true,
      itemGroupName: 'Edible Oil',
      trackPresetName: null,
      trackMrp: false,
      trackSalePrice: false,
      itemCompanyId: COMPANY,
      itemStockQty: 150,
      itemStockUnit: 'PCS',
      storedMarkups: [20, null, null, null],
      ...overrides,
    });

    it('adds the line keys, the tax name, the stored markup and the spread on All branches lines only', async () => {
      gateway.listPriceLines.mockResolvedValue({
        items: [
          record(),
          record({
            branchId: BRANCH,
            branchName: 'Acme CBE',
            priceScope: 'BRANCH',
            bucketId: OWN_ROW,
          }),
          record({ lineKind: 'NO_PRICE', mrp: 300, lineCost: null }),
        ],
        meta: { limit: 1, offset: 0, count: 1, lines: 3 },
      });
      gateway.otherBranchStockCosts.mockResolvedValue([
        [
          {
            branchId: OTHER_BRANCH,
            branchName: 'Counter2',
            stockQty: 5,
            stockCost: 110,
            stockCostWot: 0,
            basis: 'ITEM',
          },
          {
            branchId: 'h',
            branchName: 'Head Office',
            stockQty: 5,
            stockCost: 95,
            stockCostWot: 0,
            basis: 'ITEM',
          },
        ],
      ]);
      const page = await service.listPriceLines({
        companyId: COMPANY,
        branchId: BRANCH,
        limit: 1,
        unpricedOnly: true,
      });

      expect(gateway.listPriceLines).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1, offset: 0, unpricedOnly: true }),
      );
      expect(gateway.otherBranchStockCosts.mock.calls[0][1].probes).toHaveLength(1);
      expect(page.meta).toEqual({ limit: 1, offset: 0, count: 1, lines: 3 });
      expect(page.items[0]).toMatchObject({
        lineNo: 1,
        lineKind: 'HEADLINE',
        lineCost: 100,
        // 2026-11-27 — the record carries 85.714286 without GST; the line answers it with 5 % GST
        stockCost: 90,
        stockCostWot: 85.714286,
        taxName: 'GST 5%',
        taxPerc: 5,
        otherBranchesStockCost: {
          low: 95,
          high: 110,
          lowBranch: 'Head Office',
          highBranch: 'Counter2',
          branches: 2,
        },
      });
      expect(page.items[0].levels[0]).toMatchObject({ level: 1, price: 120, storedMarkupPerc: 20 });
      expect(page.items[1].otherBranchesStockCost).toBeNull();
      expect(page.items[2]).toMatchObject({ lineKind: 'NO_PRICE', otherBranchesStockCost: null });
    });
  });
  describe('review fixes 2026-11-24 (S1, S2, S4, S7, S8)', () => {
    it('S1 / S8: menu 30, no cost sent, no cost of its own, an MRP with no lot -> stores 0 and asks nothing', async () => {
      // the old stock-first figure was the branch average over every MRP (341.67)
      cost = rowCost({
        trackMrp: true,
        costRate: 341.67,
        costBasis: 'ITEM',
        lineCost: null,
        lineCostWot: null,
        stockCostWot: null,
        stockCostBasis: null,
      });
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ mrp: 99, isNew: true, levels: [{ level: 1, price: 80 }] })]),
        { actor: USER, policy: 'warning', keepLineCost: true },
      );
      expect(prepared.candidates[0]).toMatchObject({ costRate: 0, costWot: 0, judgeCost: 0, ownCost: null });
      expect(prepared.belowCost).toEqual([]);
    });

    it('S1: menu 30, no cost of its own but a stock cost -> stores and judges the stock cost (Cost with GST, Cost Wot without)', async () => {
      // 2026-11-27 — 23.80 without GST + 5 % = 24.99: the line stores the pair on decision 12's footing
      cost = rowCost({ costRate: 341.67, lineCost: null, lineCostWot: null, stockCostWot: 23.8 });
      const prepared = await service.prepareBulk(tx as never, save([line()]), {
        actor: USER,
        policy: 'warning',
        keepLineCost: true,
      });
      expect(prepared.candidates[0]).toMatchObject({ costRate: 24.99, costWot: 23.8, judgeCost: 24.99, stockCost: 24.99 });
    });

    it('S2: menu 244 sends no cost on an MRP row -> judged on the higher of the line\'s own cost and the stock cost', async () => {
      cost = rowCost({ trackMrp: true, costRate: 450, lineCost: 500, stockCostWot: wot5(450) });
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ mrp: 600, scope: undefined, priceScope: 'BRANCH', levels: [{ level: 1, price: 480 }] })]),
        { actor: USER, policy: 'warning' },
      );
      // the stored figure is what it was (P2 / P4 move it); the judge takes the line's own cost
      expect(prepared.candidates[0]).toMatchObject({ costRate: 450, ownCost: 500, judgeCost: 500 });
      expect(prepared.belowCost).toEqual([
        expect.objectContaining({ rule: 'LINE_COST', cost: 500, lineCost: 500, stockCost: 450 }),
      ]);
    });

    it('S2: a sent cost is judged on it (and the stock cost), not on the line\'s stored cost', async () => {
      cost = rowCost({ costRate: 90, lineCost: 500 });
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ costPrice: 100, scope: undefined, priceScope: 'BRANCH', levels: [{ level: 1, price: 120 }] })]),
        { actor: USER, policy: 'warning' },
      );
      expect(prepared.candidates[0]).toMatchObject({ costRate: 100, ownCost: 100, judgeCost: 100 });
      expect(prepared.belowCost).toEqual([]);
    });

    it('S2 / S7: an MRP item with neither cost is not judged on the stored (mixed) figure', async () => {
      cost = rowCost({ trackMrp: true, costRate: 341.67, lineCost: null, stockCostWot: null });
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ scope: undefined, priceScope: 'BRANCH', levels: [{ level: 1, price: 100 }] })]),
        { actor: USER, policy: 'warning' },
      );
      expect(prepared.candidates[0]).toMatchObject({ judgeCost: 0 });
      expect(prepared.belowCost).toEqual([]);
    });

    it('S4: a hidden (inactive) level below cost neither asks nor refuses on menu 30', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(90) });
      const result = await service.saveBulk(
        save([line({ levels: [{ level: 1, price: 120 }, { level: 3, price: 90 }] })]),
      );
      expect(result).toMatchObject({ needsConfirm: false });
      expect(result.problems.filter((p) => p.level === 3)).toEqual([]);
    });
  });

  // ── CSP P2 follow-up (user "Go" 2026-11-27) ─────────────────────────────────
  describe("one footing, and a purchase's own rows judged on their own cost (2026-11-27)", () => {
    const counter2 = {
      branchId: OTHER_BRANCH,
      branchName: 'Counter2',
      stockQty: 5,
      stockCost: 300,
      stockCostWot: 285.714286,
      basis: 'ITEM' as const,
    };

    it('A3-C on one footing: 100.00 without GST is a 105.00 stock cost at 5 %, above the line cost 100 (STOCK_COST)', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: 100 });
      const result = await service.saveBulk(save([line({ levels: [{ level: 1, price: 104 }] })]));

      expect(result.problems).toEqual([
        expect.objectContaining({ rule: 'STOCK_COST', cost: 105, lineCost: 100, stockCost: 105 }),
      ]);
    });

    it('a stock cost equal to the line cost as shown (2 dp) names the line cost (LINE_COST), not the stock cost', async () => {
      // E1: the bill stored 1,415.631; its own lot reads 1,348.220004 + 5 % = 1,415.631004
      cost = rowCost({ lineCost: 1415.631, stockCostWot: 1348.220004 });
      const result = await service.saveBulk(save([line({ levels: [{ level: 1, price: 1400 }] })]));

      expect(result.problems).toEqual([
        expect.objectContaining({ rule: 'LINE_COST', cost: 1415.63, lineCost: 1415.63, stockCost: 1415.63 }),
      ]);
    });

    it('ownCostOnly: judged on the cost the row sends alone — no stock cost beside it, no other branch (C6)', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(200) });
      gateway.otherBranchStockCosts.mockResolvedValue([[counter2]]);
      const ownCostOnly = jest.fn(() => true);
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ costPrice: 150, levels: [{ level: 1, price: 160 }] })]),
        { actor: USER, policy: 'warning', keepLineCost: true, ownCostOnly },
      );

      expect(ownCostOnly).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ itemId: ITEM, costPrice: 150 }),
        { mrp: null, salePrice: null },
        cost,
      );
      expect(prepared.candidates[0]).toMatchObject({
        costRate: 150,
        ownCost: 150,
        judgeCost: 150,
        stockCost: null,
        ownCostOnly: true,
      });
      expect(prepared.problems).toEqual([]);
      expect(gateway.otherBranchStockCosts).not.toHaveBeenCalled();
    });

    it('ownCostOnly: below its own cost is the plain "below the cost" (no rule, no stock cost named)', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(200) });
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ costPrice: 150, levels: [{ level: 1, price: 140 }] })]),
        { actor: USER, policy: 'warning', ownCostOnly: () => true },
      );

      expect(prepared.belowCost).toEqual([
        expect.objectContaining({ verdict: 'BELOW_COST', cost: 150, lineCost: 150, stockCost: null }),
      ]);
      expect(prepared.belowCost[0]).not.toHaveProperty('rule');
      expect(prepared.belowCost[0].params).not.toHaveProperty('stockCost');
    });

    it('ownCostOnly is not asked for a row that sends no cost: it keeps A3-C (the line cost and the stock cost)', async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(200) });
      const ownCostOnly = jest.fn(() => true);
      const prepared = await service.prepareBulk(
        tx as never,
        save([line({ scope: 'BRANCH', priceScope: 'BRANCH', levels: [{ level: 1, price: 150 }] })]),
        { actor: USER, policy: 'warning', keepLineCost: true, ownCostOnly },
      );

      expect(ownCostOnly).not.toHaveBeenCalled();
      expect(prepared.candidates[0]).toMatchObject({ judgeCost: 200, stockCost: 200 });
      expect(prepared.belowCost).toEqual([expect.objectContaining({ rule: 'STOCK_COST', cost: 200 })]);
    });

    it("the purchase view's save hands its ownCostOnly to prepareBulk: the bill's row is written, nothing asked", async () => {
      cost = rowCost({ lineCost: 100, stockCostWot: wot5(200) });
      gateway.otherBranchStockCosts.mockResolvedValue([[counter2]]);
      const result = await service.saveBulk(
        save([line({ costPrice: 150, levels: [{ level: 1, price: 160 }] })]),
        {
          reason: 'From purchase PI-1 (27-11-2026)',
          fromPurchase: { piId: 'pi', accYear: '2026-2027', refno: 'PI-1' },
          afterPrepare: jest.fn().mockResolvedValue(undefined),
          afterWrite: jest.fn().mockResolvedValue(undefined),
          ownCostOnly: () => true,
        },
      );

      expect(result).toMatchObject({ needsConfirm: false, problems: [] });
      expect(gateway.otherBranchStockCosts).not.toHaveBeenCalled();
      expect(writer.insertBucketPrice.mock.calls[0][1]).toMatchObject({ costRate: 150, judgeCost: 150 });
    });
  });
});

describe('Change Selling Price P1 — PriceBucketGateway.listPriceLines', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    pageItems: 2n,
    itemId: ITEM,
    itemCode: 'ZT1',
    barcode: null,
    itemName: 'ZT',
    uomId: UOM,
    unitName: 'PCS',
    stockQty: dec(0),
    mrp: null,
    salePrice: null,
    keyMrp: dec(-1),
    keySp: dec(-1),
    exact: true,
    priceIsBucket: false,
    priceBranchId: null,
    bucketId: CHAIN_ROW,
    maxPrice: dec(0),
    costRate: dec(90),
    costWot: dec(85),
    costBasis: 'ITEM',
    minPrice: dec(0),
    roundOff: dec(0),
    priceA: dec(120),
    priceB: dec(130),
    priceC: null,
    priceD: null,
    lineCost: dec(100),
    lineCostWot: dec(95),
    markupA: dec(20),
    markupB: null,
    markupC: null,
    markupD: null,
    stockCostWot: dec(85),
    stockCostBasis: 'ITEM',
    profitType: 'By %',
    companyId: COMPANY,
    companyName: 'Acme Foods',
    branchName: 'Acme CBE',
    unitFactor: dec(1),
    unitSlNo: 1,
    isDefaultUnit: true,
    itemGroupName: 'G',
    trackPresetName: 'Plain',
    trackMrp: true,
    trackSalePrice: false,
    itemCompanyId: COMPANY,
    itemStockQty: dec(18),
    itemStockUnit: 'PCS',
    ...overrides,
  });

  it('tells HEADLINE / MRP / SOLD_AT / NO_PRICE apart, and pages by item', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          row(),
          row({ keyMrp: dec(540), mrp: dec(540), priceBranchId: BRANCH }),
          row({ keyMrp: dec(-1), keySp: dec(1250), salePrice: dec(1250) }),
          row({ keyMrp: dec(300), mrp: dec(300), exact: false, stockQty: dec(18), lineCost: null }),
          row({ exact: false, bucketId: null, stockQty: dec(0), lineCost: null }),
          row({ exact: false, bucketId: null, stockQty: dec(4), lineCost: null }),
        ]),
    };
    const gateway = new PriceBucketGateway(prisma as unknown as PrismaService);
    const page = await gateway.listPriceLines({
      companyId: COMPANY,
      branchId: BRANCH,
      activeOnly: true,
      unpricedOnly: true,
      limit: 2,
      offset: 4,
    });

    expect(page.items.map((item) => item.lineKind)).toEqual([
      'HEADLINE',
      'MRP',
      'SOLD_AT',
      'NO_PRICE',
      'HEADLINE',
      'NO_PRICE',
    ]);
    expect(page.items[1]).toMatchObject({
      branchId: BRANCH,
      branchName: 'Acme CBE',
      storedMarkups: [20, null, null, null],
    });
    expect(page.items[3]).toMatchObject({ branchId: null, branchName: null, lineCost: null });
    expect(page.meta).toEqual({ limit: 2, offset: 4, count: 2, lines: 6 });
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const statement = Prisma.sql(strings, ...values);
    expect(statement.values).toContain(true); // unpricedOnly
    expect(statement.values).toEqual(expect.arrayContaining([2, 4]));
    expect(statement.sql).toContain('LIMIT');
    expect(statement.sql).toContain('page AS (');
  });

  it('answers count 0 for an empty page', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const gateway = new PriceBucketGateway(prisma as unknown as PrismaService);
    const page = await gateway.listPriceLines({
      companyId: COMPANY,
      branchId: BRANCH,
      activeOnly: true,
      limit: 50,
      offset: 0,
    });
    expect(page).toEqual({ items: [], meta: { limit: 50, offset: 0, count: 0, lines: 0 } });
  });

});
