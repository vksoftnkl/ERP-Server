import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  PriceBucketGateway,
  type BucketPriceCandidate,
  type ListSellingPricesArgs,
} from './price-bucket.gateway';
import type { ScopeResolution } from './selling-price-scope.helper';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const OTHER_ITEM_ID = '01000000-0000-7000-8000-000000000002';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const OTHER_UOM_ID = '01000000-0000-7000-8000-000000000012';
const IPM_ID = '01000000-0000-7000-8000-000000000041';
const OTHER_IPM_ID = '01000000-0000-7000-8000-000000000042';
const GROUP_ID = '01000000-0000-7000-8000-000000000051';
const BRAND_ID = '01000000-0000-7000-8000-000000000052';

const dec = (value: number | string) => new Prisma.Decimal(value);

/**
 * The statement a mocked tagged-template call ran, rebuilt the way Prisma
 * builds it — nested fragments flattened, `Prisma.raw` inlined — so a test can
 * read the bound values and the SQL text without a database.
 */
const statementOf = (mock: jest.Mock, call = 0): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

/** A Q24/Q25 row as the database answers it. */
const gridRow = (overrides: Record<string, unknown> = {}) => ({
  itemId: ITEM_ID,
  itemCode: 'SALT',
  barcode: '8901234567890',
  itemName: 'Salt 1 Kg',
  uomId: UOM_ID,
  unitName: 'PCS',
  stockQty: dec('12.5'),
  mrp: dec(40),
  salePrice: null,
  priceIsBucket: true,
  priceBranchId: BRANCH_ID,
  bucketId: IPM_ID,
  maxPrice: dec(40),
  costRate: dec('25.5'),
  costWot: dec('21.610169'),
  costBasis: 'MRP',
  minPrice: dec(26),
  roundOff: dec(0),
  priceA: dec(38),
  priceB: dec(37),
  priceC: null,
  priceD: dec(0),
  ...overrides,
});

const candidate = (overrides: Partial<BucketPriceCandidate> = {}): BucketPriceCandidate => ({
  lineNo: 1,
  companyId: COMPANY_ID,
  itemId: ITEM_ID,
  uomId: UOM_ID,
  itemCode: 'SALT',
  itemName: 'Salt 1 Kg',
  bucketId: null,
  mrp: 40,
  salePrice: null,
  levels: [{ level: 1, price: 38, priceWot: 32.20339, markupPerc: 49.019608 }],
  minPrice: null,
  roundOff: null,
  costRate: 25.5,
  costWot: 21.610169,
  actor: USER_ID,
  ...overrides,
});

const branchScope: ScopeResolution = {
  targetScope: 'BRANCH',
  targetBranchId: BRANCH_ID,
  expected: 'UPDATE',
  createsBranchOverride: false,
  switchIgnored: false,
  reason: 'test',
};
const chainScope: ScopeResolution = { ...branchScope, targetScope: 'CHAIN', targetBranchId: null };

describe('PriceBucketGateway', () => {
  let prisma: { $queryRaw: jest.Mock };
  let tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let gateway: PriceBucketGateway;

  const txClient = () => tx as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    gateway = new PriceBucketGateway(prisma as unknown as PrismaService);
  });

  // ── 19q Q6 — the opening seed ─────────────────────────────────────────────
  describe('findOpeningSeedBucket', () => {
    const args = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      itemId: ITEM_ID,
      uomId: UOM_ID,
      onDate: '2026-10-21',
    };

    it('seeds a line from the bucket row the scope prefers', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucketMrp: dec(550), bucketSp: dec(520), maxPrice: dec(550) },
      ]);

      await expect(gateway.findOpeningSeedBucket(args)).resolves.toEqual({
        mrp: 550,
        salePrice: 520,
      });
      expect(statementOf(prisma.$queryRaw).values).toEqual([
        ITEM_ID,
        UOM_ID,
        COMPANY_ID,
        COMPANY_ID,
        BRANCH_ID,
        BRANCH_ID,
        '2026-10-21',
      ]);
    });

    it("seeds the MRP from the headline's max price when no bucket row exists, and no sale price", async () => {
      prisma.$queryRaw.mockResolvedValue([{ bucketMrp: null, bucketSp: null, maxPrice: dec(45) }]);

      await expect(gateway.findOpeningSeedBucket(args)).resolves.toEqual({
        mrp: 45,
        salePrice: 0,
      });
    });

    it('answers null when the unit has no price row at all', async () => {
      await expect(gateway.findOpeningSeedBucket(args)).resolves.toBeNull();
    });

    it('switches a half of the scope filter off with a null company or branch', async () => {
      await gateway.findOpeningSeedBucket({ ...args, companyId: null, branchId: null });

      const statement = statementOf(prisma.$queryRaw);
      expect(statement.values.slice(2, 6)).toEqual([null, null, null, null]);
      // Bucket rows before the headline, then the dearest bucket.
      expect(statement.sql).toContain('ORDER BY (p.ipm_key_mrp = -1 AND p.ipm_key_sp = -1)');
      expect(statement.sql).toContain('p.ipm_bucket_mrp DESC NULLS LAST');
    });
  });

  // ── Q25 — the grid ────────────────────────────────────────────────────────
  describe('listPrices', () => {
    const args = (overrides: Partial<ListSellingPricesArgs> = {}): ListSellingPricesArgs => ({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      activeOnly: true,
      limit: 50,
      offset: 100,
      ...overrides,
    });

    it('maps each row: a branch bucket row, a chain headline row, and a bucket nothing prices yet', async () => {
      prisma.$queryRaw.mockResolvedValue([
        gridRow(),
        gridRow({
          mrp: null,
          priceIsBucket: false,
          priceBranchId: null,
          bucketId: OTHER_IPM_ID,
          costBasis: 'ITEM',
        }),
        gridRow({
          stockQty: null,
          priceIsBucket: null,
          priceBranchId: null,
          bucketId: null,
          maxPrice: null,
          costRate: null,
          costWot: null,
          costBasis: null,
          minPrice: null,
          roundOff: null,
          priceA: null,
          priceB: null,
          priceC: null,
          priceD: null,
        }),
      ]);

      const result = await gateway.listPrices(args());

      expect(result.meta).toEqual({ limit: 50, offset: 100, count: 3 });
      expect(result.items[0]).toEqual({
        itemId: ITEM_ID,
        itemCode: 'SALT',
        barcode: '8901234567890',
        itemName: 'Salt 1 Kg',
        uomId: UOM_ID,
        unitName: 'PCS',
        stockQty: 12.5,
        mrp: 40,
        salePrice: null,
        maxPrice: 40,
        priceSource: 'BUCKET',
        priceScope: 'BRANCH',
        bucketId: IPM_ID,
        costRate: 25.5,
        costWot: 21.610169,
        costBasis: 'MRP',
        minPrice: 26,
        roundOff: 0,
        prices: [38, 37, 0, 0],
      });
      expect(result.items[1]).toMatchObject({
        mrp: null,
        priceSource: 'MASTER',
        priceScope: 'CHAIN',
        costBasis: 'ITEM',
      });
      expect(result.items[2]).toMatchObject({
        priceSource: 'MASTER',
        priceScope: null,
        bucketId: null,
        stockQty: 0,
        maxPrice: 0,
        costRate: 0,
        costWot: 0,
        costBasis: null,
        minPrice: 0,
        roundOff: 0,
        prices: [0, 0, 0, 0],
      });
    });

    it('binds the page and the scope, and switches every absent filter off with a null', async () => {
      await gateway.listPrices(args());

      const statement = statementOf(prisma.$queryRaw);
      expect(statement.values.slice(-2)).toEqual([50, 100]);
      expect(statement.values).toContain(COMPANY_ID);
      expect(statement.values).toContain(BRANCH_ID);
      // group, brand, section, supplier, item, category, preset, tax — each twice.
      expect(statement.values.filter((value) => value === null)).toHaveLength(16);
      expect(statement.values.filter((value) => typeof value === 'boolean')).toEqual([true]);
      expect(statement.sql).toContain('LIMIT');
      expect(statement.sql).toContain('OFFSET');
    });

    it('binds every filter it is given, the inactive switch and the loose search', async () => {
      await gateway.listPrices(
        args({
          itemGroupId: GROUP_ID,
          itemBrandId: BRAND_ID,
          itemId: ITEM_ID,
          search: 'tata salt',
          activeOnly: false,
        }),
      );

      const statement = statementOf(prisma.$queryRaw);
      expect(statement.values.filter((value) => value === GROUP_ID)).toHaveLength(2);
      expect(statement.values.filter((value) => value === BRAND_ID)).toHaveLength(2);
      expect(statement.values).toContain(ITEM_ID);
      // Every typed word is required, on code, name, alias and barcode.
      expect(statement.values.filter((value) => value === 'tata')).toHaveLength(4);
      expect(statement.values.filter((value) => value === 'salt')).toHaveLength(4);
      expect(statement.values.filter((value) => typeof value === 'boolean')).toEqual([false]);
    });
  });

  // ── Q24 — F12 ─────────────────────────────────────────────────────────────
  describe('listBuckets', () => {
    it("lists one item's rows at the branch, mapped like the grid", async () => {
      prisma.$queryRaw.mockResolvedValue([
        gridRow(),
        gridRow({ priceBranchId: null, salePrice: dec(38) }),
      ]);

      const rows = await gateway.listBuckets(ITEM_ID, COMPANY_ID, BRANCH_ID);

      expect(rows.map((row) => [row.priceSource, row.priceScope, row.salePrice])).toEqual([
        ['BUCKET', 'BRANCH', null],
        ['BUCKET', 'CHAIN', 38],
      ]);
      const statement = statementOf(prisma.$queryRaw);
      expect(statement.values).toContain(ITEM_ID);
      expect(statement.values).toContain(COMPANY_ID);
      expect(statement.values).toContain(BRANCH_ID);
      expect(statement.sql).toContain("b.sbl_bucket     = 'SALEABLE'");
    });
  });

  // ── the save's cost probe ─────────────────────────────────────────────────
  describe('loadRowCosts', () => {
    it('asks nothing for an empty save', async () => {
      await expect(gateway.loadRowCosts(txClient(), [], COMPANY_ID, BRANCH_ID)).resolves.toEqual(
        [],
      );
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('binds the rows as four parallel arrays, a missing bucket value as an empty string', async () => {
      await gateway.loadRowCosts(
        txClient(),
        [
          { itemId: ITEM_ID, uomId: UOM_ID, mrp: 40, salePrice: null },
          { itemId: OTHER_ITEM_ID, uomId: OTHER_UOM_ID, mrp: null, salePrice: 38.5 },
        ],
        COMPANY_ID,
        BRANCH_ID,
        undefined,
        new Map(),
      );

      const values = statementOf(tx.$queryRaw).values;
      expect(values.slice(0, 4)).toEqual([
        [ITEM_ID, OTHER_ITEM_ID],
        [UOM_ID, OTHER_UOM_ID],
        ['40', ''],
        ['', '38.5'],
      ]);
      expect(values).toContain(COMPANY_ID);
      expect(values).toContain(BRANCH_ID);
    });

    it('answers one cost per row in payload order, defaulting a row the statement did not return', async () => {
      tx.$queryRaw.mockResolvedValue([
        {
          ord: 3n,
          itemCode: 'RICE',
          itemName: 'Rice 25 Kg',
          uomBelongs: true,
          trackMrp: false,
          trackSalePrice: true,
          costRate: null,
          costWot: null,
          minPrice: null,
        },
        {
          ord: 1n,
          itemCode: 'SALT',
          itemName: 'Salt 1 Kg',
          uomBelongs: true,
          trackMrp: true,
          trackSalePrice: false,
          // A stock basis: the statement answers no costRate (2026-11-27), only the wot.
          costRate: null,
          costWot: dec('21.610169'),
          costBasis: 'MRP',
          minPrice: dec(26),
        },
      ]);
      const row = { itemId: ITEM_ID, uomId: UOM_ID, mrp: 40, salePrice: null };

      const costs = await gateway.loadRowCosts(
        txClient(),
        [row, row, row],
        COMPANY_ID,
        BRANCH_ID,
        undefined,
        new Map([[ITEM_ID, { taxPerc: 18 }]]),
      );

      // P1 — the line's own cost and the stock cost apart, none in these rows.
      const p1 = {
        unitName: null,
        unitFactor: 1,
        lineCost: null,
        lineCostWot: null,
        lineRoundOff: null,
        stockCostWot: null,
        stockCostBasis: null,
      };
      expect(costs).toEqual([
        {
          ...p1,
          itemCode: 'SALT',
          itemName: 'Salt 1 Kg',
          uomBelongs: true,
          trackMrp: true,
          trackSalePrice: false,
          // stockCostWithGst(21.610169, 18) = 25.49999942 → 25.499999 (6 dp half up).
          costRate: 25.499999,
          costWot: 21.610169,
          costBasis: 'MRP',
          minPrice: 26,
        },
        {
          ...p1,
          itemCode: null,
          itemName: '',
          uomBelongs: false,
          trackMrp: false,
          trackSalePrice: false,
          costRate: 0,
          costWot: 0,
          costBasis: null,
          minPrice: 0,
        },
        {
          ...p1,
          itemCode: 'RICE',
          itemName: 'Rice 25 Kg',
          uomBelongs: true,
          trackMrp: false,
          trackSalePrice: true,
          costRate: 0,
          costWot: 0,
          costBasis: null,
          minPrice: 0,
        },
      ]);
    });
    it('2026-11-27 — the stock-first cost on one footing: a stock basis WITH GST from the wot, PRICE_ROW as stored', async () => {
      tx.$queryRaw.mockResolvedValue([
        // A purchased lot of the item at 5 %: the stored cost_rate was the ITC figure (= wot).
        { ord: 1n, itemName: 'Oil', uomBelongs: true, costRate: null, costWot: dec('1348.220004'), costBasis: 'ITEM', minPrice: null },
        // The answering row's own cost: stored WITH GST, read as it is.
        { ord: 2n, itemName: 'Oil', uomBelongs: true, costRate: dec('1260'), costWot: dec('1200'), costBasis: 'PRICE_ROW', minPrice: null },
        // An item id in other case still finds its tax.
        { ord: 3n, itemName: 'Salt', uomBelongs: true, costRate: null, costWot: dec(100), costBasis: 'MRP', minPrice: null },
      ]);

      const costs = await gateway.loadRowCosts(
        txClient(),
        [
          { itemId: ITEM_ID, uomId: UOM_ID, mrp: null, salePrice: null },
          { itemId: ITEM_ID, uomId: UOM_ID, mrp: null, salePrice: null },
          { itemId: OTHER_ITEM_ID.toUpperCase(), uomId: UOM_ID, mrp: 40, salePrice: null },
        ],
        COMPANY_ID,
        BRANCH_ID,
        undefined,
        new Map([
          [ITEM_ID, { taxPerc: 5 }],
          [OTHER_ITEM_ID, { taxPerc: 18 }],
        ]),
      );

      expect(costs.map((c) => [c.costBasis, c.costRate, c.costWot])).toEqual([
        ['ITEM', 1415.631004, 1348.220004],
        ['PRICE_ROW', 1260, 1200],
        ['MRP', 118, 100],
      ]);
      // The basis is decided on the cost WITHOUT GST; the stored lot / branch cost_rate is not read.
      const sql = statementOf(tx.$queryRaw).sql;
      expect(sql).toContain('mc.cost_rate_wot > 0');
      expect(sql).toContain('sic.sic_avg_cost_rate_wot > 0');
      expect(sql).not.toMatch(/sic_avg_cost_rate(?!_wot)/);
      expect(sql).not.toMatch(/mc\.cost_rate(?!_wot)/);
    });

    it('resolves the tax itself, as of the day asked, when the caller sends none', async () => {
      const findItems = jest.fn().mockResolvedValue([
        { itemId: ITEM_ID, itemDefaultTaxId: 'tax-12', itemInclTax: true },
      ]);
      const findHistory = jest.fn().mockResolvedValue([]);
      const findTaxes = jest.fn().mockResolvedValue([
        { taxId: 'tax-12', taxRatePerc: dec(12), taxCessBasis: 'NONE', taxAcessBasis: 'NONE' },
      ]);
      Object.assign(tx, {
        itemMaster: { findMany: findItems },
        itemTaxHistory: { findMany: findHistory },
        taxRateMaster: { findMany: findTaxes },
      });
      tx.$queryRaw.mockResolvedValue([
        { ord: 1n, itemName: 'Salt', uomBelongs: true, costRate: null, costWot: dec(50), costBasis: 'ITEM', minPrice: null },
      ]);

      const [cost] = await gateway.loadRowCosts(
        txClient(),
        [{ itemId: ITEM_ID, uomId: UOM_ID, mrp: null, salePrice: null }],
        COMPANY_ID,
        BRANCH_ID,
        '2026-12-01',
      );

      expect(cost).toMatchObject({ costBasis: 'ITEM', costRate: 56, costWot: 50 });
      // item_tax_history is read as of the scheduled day (UTC midnight of 2026-12-01).
      const where = findHistory.mock.calls[0][0].where as { ithEffectiveFrom: { lte: Date } };
      expect(where.ithEffectiveFrom.lte.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });
  });

  // ── Q26 — the verdicts ────────────────────────────────────────────────────
  describe('validateRows', () => {
    const level = (price: number, lvl: 1 | 2 | 3 | 4 = 1) => ({
      level: lvl,
      price,
      priceWot: 0,
      markupPerc: 0,
    });

    it('gives each level one verdict, ABOVE_MRP before BELOW_MIN before BELOW_COST', () => {
      const problems = gateway.validateRows(
        [
          candidate({
            bucketId: IPM_ID,
            minPrice: 30,
            costRate: 35,
            levels: [level(41, 1), level(29, 2), level(33, 3), level(36, 4)],
          }),
        ],
        [0],
      );

      expect(problems.map((problem) => [problem.level, problem.verdict])).toEqual([
        [1, 'ABOVE_MRP'],
        [2, 'BELOW_MIN'],
        [3, 'BELOW_COST'],
      ]);
      expect(problems[0]).toEqual({
        lineNo: 1,
        itemId: ITEM_ID,
        itemCode: 'SALT',
        itemName: 'Salt 1 Kg',
        uomId: UOM_ID,
        bucketId: IPM_ID,
        level: 1,
        verdict: 'ABOVE_MRP',
        message: 'Salt 1 Kg: 41 is above the MRP 40.',
        code: 'STOCK_PRICE_ABOVE_MRP',
      });
      expect(problems[1].message).toBe('Salt 1 Kg: 29 is below the minimum price 30.');
      expect(problems[2].message).toBe('Salt 1 Kg: 33 is below the cost 35.');
    });

    it('reports each candidate against its own stored min price, and names no item it does not know', () => {
      const problems = gateway.validateRows(
        [
          candidate({ lineNo: 1, costRate: 0 }),
          candidate({ lineNo: 2, itemName: '', costRate: 0, levels: [level(30)] }),
        ],
        [0, 35],
      );

      expect(problems).toEqual([
        expect.objectContaining({
          lineNo: 2,
          verdict: 'BELOW_MIN',
          message: '30 is below the minimum price 35.',
        }),
      ]);
    });

    it('treats a missing stored min price as none', () => {
      expect(gateway.validateRows([candidate({ costRate: 0 })], [])).toEqual([]);
    });

    it('activeLevels (Qty-wise Prices, C-a): judges only an active level priced above 0', () => {
      const rows = [
        candidate({
          bucketId: IPM_ID,
          minPrice: 30,
          costRate: 35,
          // 1 active and above the MRP; 2 active but 0; 3 inactive and below min; 4 inactive, 0
          levels: [level(41, 1), level(0, 2), level(29, 3), level(0, 4)],
        }),
      ];
      expect(
        gateway.validateRows(rows, [0], { activeLevels: [1, 2] }).map((p) => [p.level, p.verdict]),
      ).toEqual([[1, 'ABOVE_MRP']]);
      // without it (menu 30, Quick Rate, purchase) every level sent is judged, as before
      expect(gateway.validateRows(rows, [0]).map((p) => [p.level, p.verdict])).toEqual([
        [1, 'ABOVE_MRP'],
        [2, 'BELOW_MIN'],
        [3, 'BELOW_MIN'],
        [4, 'BELOW_MIN'],
      ]);
    });
  });

  // ── S1 — find at the target scope ─────────────────────────────────────────
  describe('findBucketRowForUpdate', () => {
    it('finds the row at the target scope and locks it', async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: IPM_ID }]);

      await expect(
        gateway.findBucketRowForUpdate(txClient(), candidate({ salePrice: 38 }), branchScope),
      ).resolves.toEqual({ ipmId: IPM_ID });

      const statement = statementOf(tx.$queryRaw);
      expect(statement.values).toEqual([COMPANY_ID, COMPANY_ID, BRANCH_ID, ITEM_ID, UOM_ID, 40, 38]);
      expect(statement.sql).toContain('FOR UPDATE');
      // A company-less line of this company's own item is the same price (review 2026-11-23 point 2):
      // taken when there is no company line, the company line first.
      expect(statement.sql).toContain('ipm_company_id IS NULL');
      expect(statement.sql).toContain('im.item_company_id =');
      expect(statement.sql).toContain('ORDER BY (ipm_company_id IS NULL)');
      // A predicate on the scope, so a BRANCH search can never find the chain row.
      expect(statement.sql).toContain('ipm_branch_id  IS NOT DISTINCT FROM');
    });

    it('searches the chain row with a null branch, and answers null when there is none', async () => {
      await expect(
        gateway.findBucketRowForUpdate(
          txClient(),
          candidate({ mrp: null, salePrice: null }),
          chainScope,
        ),
      ).resolves.toBeNull();

      expect(statementOf(tx.$queryRaw).values).toEqual([
        COMPANY_ID,
        COMPANY_ID,
        null,
        ITEM_ID,
        UOM_ID,
        null,
        null,
      ]);
    });
  });

  // S2 / S3 moved to PriceMasterWriter with their statements (notes 144):
  // see src/modules/Inventory/item-price-log/price-master-writer.service.spec.ts.

  // ── the audit snapshot ────────────────────────────────────────────────────
  describe('snapshotRows', () => {
    it('reads nothing for no rows', async () => {
      await expect(gateway.snapshotRows(txClient(), [])).resolves.toEqual(new Map());
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('keys each stored row by its id', async () => {
      tx.$queryRaw.mockResolvedValue([
        { id: IPM_ID, row: { ipm_id: IPM_ID, ipm_bucket_mrp: 40 } },
        { id: OTHER_IPM_ID, row: { ipm_id: OTHER_IPM_ID, ipm_bucket_mrp: null } },
      ]);

      const rows = await gateway.snapshotRows(txClient(), [IPM_ID, OTHER_IPM_ID]);

      expect(rows.get(IPM_ID)).toEqual({ ipm_id: IPM_ID, ipm_bucket_mrp: 40 });
      expect(rows.size).toBe(2);
      expect(statementOf(tx.$queryRaw).values).toEqual([[IPM_ID, OTHER_IPM_ID]]);
    });
  });

  // ── Q27 — priced with nothing on hand ─────────────────────────────────────
  describe('listNoStock', () => {
    it('reads nothing for no rows', async () => {
      await expect(gateway.listNoStock(txClient(), [], COMPANY_ID, BRANCH_ID)).resolves.toEqual([]);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('answers the written rows with nothing on hand, bucket values as numbers', async () => {
      tx.$queryRaw.mockResolvedValue([
        {
          bucketId: IPM_ID,
          itemId: ITEM_ID,
          itemCode: 'SALT',
          itemName: 'Salt 1 Kg',
          uomId: UOM_ID,
          unitName: 'PCS',
          mrp: dec(40),
          salePrice: null,
        },
        {
          bucketId: OTHER_IPM_ID,
          itemId: OTHER_ITEM_ID,
          itemCode: null,
          itemName: 'Rice 25 Kg',
          uomId: OTHER_UOM_ID,
          unitName: null,
          mrp: null,
          salePrice: dec('38.5'),
        },
      ]);

      await expect(
        gateway.listNoStock(txClient(), [IPM_ID, OTHER_IPM_ID], COMPANY_ID, BRANCH_ID),
      ).resolves.toEqual([
        {
          bucketId: IPM_ID,
          itemId: ITEM_ID,
          itemCode: 'SALT',
          itemName: 'Salt 1 Kg',
          uomId: UOM_ID,
          unitName: 'PCS',
          mrp: 40,
          salePrice: null,
        },
        {
          bucketId: OTHER_IPM_ID,
          itemId: OTHER_ITEM_ID,
          itemCode: null,
          itemName: 'Rice 25 Kg',
          uomId: OTHER_UOM_ID,
          unitName: null,
          mrp: null,
          salePrice: 38.5,
        },
      ]);
      const values = statementOf(tx.$queryRaw).values;
      expect(values).toContainEqual([IPM_ID, OTHER_IPM_ID]);
      expect(values).toContain(COMPANY_ID);
      expect(values).toContain(BRANCH_ID);
    });
  });
});
