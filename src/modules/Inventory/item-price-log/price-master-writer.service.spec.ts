import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import type { BucketPriceCandidate } from 'src/modules/stocks/selling-price-bulk/price-bucket.gateway';
import type { ScopeResolution } from 'src/modules/stocks/selling-price-bulk/selling-price-scope.helper';
import { PriceMasterWriter } from './price-master-writer.service';
import { PRICE_ORIGIN } from './types/price-change-log.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const IPM_ID = '01000000-0000-7000-8000-000000000041';
const OTHER_IPM_ID = '01000000-0000-7000-8000-000000000042';
const IQP_ID = '01000000-0000-7000-8000-000000000061';

const statementOf = (mock: jest.Mock, call = 0): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

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

/** A row as to_jsonb answers it. */
const ipmRow = (overrides: Record<string, unknown> = {}) => ({
  ipm_id: IPM_ID,
  ipm_item_id: ITEM_ID,
  ipm_sales_price_a: 38,
  ipm_is_deleted: false,
  ...overrides,
});

describe('PriceMasterWriter', () => {
  let tx: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    itemPriceMaster: { create: jest.Mock; update: jest.Mock };
    itemQtyPrice: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let changeLog: { snapshot: jest.Mock; record: jest.Mock };
  let writer: PriceMasterWriter;
  /** What the change log's snapshot answers, per call: before, then after. */
  let snapshots: Array<Map<string, Record<string, unknown>>>;

  const txClient = () => tx as unknown as Prisma.TransactionClient;
  const recorded = (call = 0) => changeLog.record.mock.calls[call][1] as Record<string, unknown>;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      itemPriceMaster: {
        create: jest.fn().mockResolvedValue({ ipmId: IPM_ID }),
        update: jest.fn().mockResolvedValue({ ipmId: IPM_ID }),
      },
      itemQtyPrice: {
        create: jest.fn().mockResolvedValue({ iqpId: IQP_ID }),
        update: jest.fn().mockResolvedValue({ iqpId: IQP_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    snapshots = [];
    changeLog = {
      snapshot: jest.fn(() => Promise.resolve(snapshots.shift() ?? new Map())),
      record: jest.fn().mockResolvedValue(true),
    };
    writer = new PriceMasterWriter(changeLog as never);
  });

  // ── the logging contract ──────────────────────────────────────────────────
  describe('every write is snapshotted around and recorded', () => {
    it('an update: before, the statement, after, one record with both', async () => {
      const before = ipmRow();
      const after = ipmRow({ ipm_sales_price_a: 36 });
      snapshots = [new Map([[IPM_ID, before]]), new Map([[IPM_ID, after]])];

      await writer.updatePrice(txClient(), PRICE_ORIGIN.ITEM_CARD, IPM_ID, { ipmSalesPriceA: 36 });

      expect(changeLog.snapshot.mock.calls.map((call) => call[1])).toEqual(['IPM', 'IPM']);
      expect(tx.itemPriceMaster.update).toHaveBeenCalledWith({
        where: { ipmId: IPM_ID },
        data: { ipmSalesPriceA: 36 },
      });
      // The before snapshot was taken BEFORE the statement ran.
      expect(changeLog.snapshot.mock.invocationCallOrder[0]).toBeLessThan(
        tx.itemPriceMaster.update.mock.invocationCallOrder[0],
      );
      expect(recorded()).toEqual({
        table: 'IPM',
        rowId: IPM_ID,
        origin: PRICE_ORIGIN.ITEM_CARD,
        before,
        after,
      });
    });

    it('a create records no row before', async () => {
      snapshots = [new Map([[IPM_ID, ipmRow()]])];

      await writer.createPrice(txClient(), PRICE_ORIGIN.ITEM_CARD, { ipmItemId: ITEM_ID } as never);

      expect(changeLog.snapshot).toHaveBeenCalledTimes(1);
      expect(recorded()).toMatchObject({ before: null, after: ipmRow() });
    });

    it('a re-key states REKEY and files under BUCKET_REKEY', async () => {
      const now = new Date('2026-10-23T07:00:00.000Z');

      await writer.rekeyPrice(txClient(), IPM_ID, { mrp: 40, salePrice: null }, now);

      expect(tx.itemPriceMaster.update).toHaveBeenCalledWith({
        where: { ipmId: IPM_ID },
        data: { ipmBucketMrp: 40, ipmBucketSp: null, ipmUpdatedOn: now },
      });
      expect(recorded()).toMatchObject({ action: 'REKEY', origin: PRICE_ORIGIN.BUCKET_REKEY });
    });

    it('a slab flip that lost the race (0 rows) records nothing', async () => {
      tx.itemQtyPrice.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        writer.setQtyPriceDeleted(txClient(), PRICE_ORIGIN.QTY_PRICE, IQP_ID, false, {
          iqpIsDeleted: true,
        }),
      ).resolves.toBe(0);

      expect(tx.itemQtyPrice.updateMany).toHaveBeenCalledWith({
        where: { iqpId: IQP_ID, iqpIsDeleted: false },
        data: { iqpIsDeleted: true },
      });
      expect(changeLog.record).not.toHaveBeenCalled();
    });

    it('a slab create / update file under IQP', async () => {
      await writer.createQtyPrice(txClient(), PRICE_ORIGIN.QTY_PRICE, {} as never, {});
      await writer.updateQtyPrice(txClient(), PRICE_ORIGIN.QTY_PRICE, IQP_ID, {}, {});

      expect(changeLog.record.mock.calls.map((call) => call[1].table)).toEqual(['IQP', 'IQP']);
      expect(changeLog.record.mock.calls.map((call) => call[1].rowId)).toEqual([IQP_ID, IQP_ID]);
    });

    it('a cancelled schedule carries its reason to the record', async () => {
      const origin = { ...PRICE_ORIGIN.CHANGE_SELLING_PRICE, reason: 'cancelled' };

      await writer.softDeletePriceRow(txClient(), IPM_ID, USER_ID, origin);
      await writer.extendPriceRowTo(txClient(), OTHER_IPM_ID, '2026-12-31', USER_ID, origin);

      expect(statementOf(tx.$executeRaw, 0).sql).toContain('SET ipm_is_deleted = true');
      expect(statementOf(tx.$executeRaw, 1).values).toEqual(['2026-12-31', USER_ID, OTHER_IPM_ID]);
      expect(changeLog.record.mock.calls.map((call) => call[1].origin)).toEqual([origin, origin]);
    });

    it('the split: the old row closes, the copy is inserted, each recorded', async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);

      await writer.closePriceRowBefore(txClient(), IPM_ID, '2026-11-01', USER_ID);
      await expect(
        writer.insertSplitPrice(txClient(), IPM_ID, candidate(), {
          from: '2026-11-01',
          to: '9999-12-31',
        }),
      ).resolves.toBe(OTHER_IPM_ID);

      expect(statementOf(tx.$executeRaw).sql).toContain('SET ipm_effective_to = ?::date - 1');
      expect(changeLog.record.mock.calls.map((call) => call[1].rowId)).toEqual([
        IPM_ID,
        OTHER_IPM_ID,
      ]);
      expect(recorded(1)).toMatchObject({
        before: null,
        origin: PRICE_ORIGIN.CHANGE_SELLING_PRICE,
      });
    });
  });

  // ── S2 / S3, moved from PriceBucketGateway with their statements ─────────
  // ── S2 — update ───────────────────────────────────────────────────────────
  describe('updateBucketPrice', () => {
    it('writes the levels it was sent, keeps the others, and stamps the cost it priced against', async () => {
      await expect(
        writer.updateBucketPrice(
          txClient(),
          IPM_ID,
          candidate({
            levels: [
              { level: 1, price: 38, priceWot: 32.20339, markupPerc: 49.019608 },
              { level: 3, price: 36, priceWot: 30.508475, markupPerc: 41.176471 },
            ],
            minPrice: 30,
            roundOff: 0.5,
          }),
        ),
      ).resolves.toBe(IPM_ID);

      expect(statementOf(tx.$executeRaw).values).toEqual([
        38,
        null,
        36,
        null,
        32.20339,
        null,
        30.508475,
        null,
        49.019608,
        null,
        41.176471,
        null,
        30,
        25.5,
        21.610169,
        // Plan 2026-11-05 §1 — no profit type sent: the row keeps its own.
        null,
        0.5,
        USER_ID,
        IPM_ID,
      ]);
      expect(statementOf(tx.$executeRaw).sql).toContain(
        'ipm_profit_type = COALESCE(?::varchar, ipm_profit_type)',
      );
    });

    it("keeps the stored profit type (the unit's rule) unless one is passed", async () => {
      await writer.updateBucketPrice(txClient(), IPM_ID, candidate());
      await writer.updateBucketPrice(txClient(), IPM_ID, { ...candidate(), profitType: null });
      await writer.updateBucketPrice(
        txClient(),
        IPM_ID,
        { ...candidate(), profitType: 'By %' },
        PRICE_ORIGIN.BULK_COST_CHANGE,
      );

      const typeOf = (call: number) => {
        const statement = statementOf(tx.$executeRaw, call);
        // the profit type is the 16th bound value, after min price, cost and cost w/o tax
        return statement.values[15];
      };
      expect(typeOf(0)).toBeNull();
      expect(typeOf(1)).toBeNull();
      expect(typeOf(2)).toBe('By %');
      // Never forced to By User any more.
      for (const call of [0, 1, 2]) {
        expect(statementOf(tx.$executeRaw, call).values).not.toContain('By User');
      }
      expect(changeLog.record.mock.calls[2][1].origin).toEqual(PRICE_ORIGIN.BULK_COST_CHANGE);
    });

    it('stores the nil-uuid actor as NULL, never as a user', async () => {
      await writer.updateBucketPrice(txClient(), IPM_ID, candidate({ actor: DEFAULT_ACTOR }));

      const values = statementOf(tx.$executeRaw).values;
      expect(values.at(-2)).toBeNull();
    });
  });

  // ── S3 — insert ───────────────────────────────────────────────────────────
  describe('insertBucketPrice', () => {
    it('inserts at the target scope, copying the attributes from the headline, and returns the new id', async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);

      await expect(
        writer.insertBucketPrice(txClient(), candidate({ salePrice: 38 }), branchScope),
      ).resolves.toBe(OTHER_IPM_ID);

      const statement = statementOf(tx.$queryRaw);
      expect(statement.values.slice(0, 6)).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        ITEM_ID,
        UOM_ID,
        25.5,
        21.610169,
      ]);
      // Plan 2026-11-05 §1 — the type is copied from the headline the
      // attributes come from; By User only when there is no headline.
      expect(statement.sql).toContain('COALESCE(?::varchar, h.ipm_profit_type, ?)');
      expect(statement.values).toContain('By User');
      expect(statement.values.filter((value) => value === USER_ID)).toHaveLength(2);
      // The bucket's own MRP becomes the row's max price and its bucket MRP, and
      // keys the two reads of its period's bounds (notes 140 C).
      expect(statement.values.filter((value) => value === 40)).toHaveLength(4);
      expect(statement.values).toContain(38);
      expect(statement.sql).toContain('RETURNING ipm_id');
      expect(statement.sql).toContain('hp.ipm_key_mrp = -1 AND hp.ipm_key_sp = -1');
      // No day named: the row fills its key's gap around CURRENT_DATE, open-ended
      // where the key has no closed or scheduled row.
      expect(statement.sql).toContain('CURRENT_DATE');
      expect(statement.sql).toContain("DATE '1900-01-01'");
      expect(statement.sql).toContain("DATE '9999-12-31'");
    });

    it("stores a passed profit type ahead of the headline's", async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);

      await writer.insertBucketPrice(
        txClient(),
        { ...candidate(), profitType: 'By Rs' },
        branchScope,
      );

      const statement = statementOf(tx.$queryRaw);
      const at = statement.values.indexOf('By Rs');
      expect(at).toBeGreaterThan(-1);
      // …followed by the fallback, used only when neither it nor the headline has one
      expect(statement.values[at + 1]).toBe('By User');
    });

    it('stores the nil-uuid actor as NULL on both stamps, at chain scope too', async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);

      await writer.insertBucketPrice(txClient(), candidate({ actor: DEFAULT_ACTOR }), chainScope);

      const values = statementOf(tx.$queryRaw).values;
      expect(values).not.toContain(DEFAULT_ACTOR);
      expect(values.slice(0, 2)).toEqual([COMPANY_ID, null]);
    });
  });

  // ── Qty-wise Prices plan 2026-11-05 §4.6 item 3 — a typed MRP on a headline ─
  describe('maxPrice (a typed MRP, headline candidates only)', () => {
    const headline = (maxPrice: number | null) => ({ ...candidate({ mrp: null }), maxPrice });

    it('S2 stores it on a headline, and the statement is unchanged without one', async () => {
      await writer.updateBucketPrice(txClient(), IPM_ID, headline(4600));
      await writer.updateBucketPrice(txClient(), IPM_ID, headline(null));
      await writer.updateBucketPrice(txClient(), IPM_ID, candidate({ mrp: null }));

      const typed = statementOf(tx.$executeRaw, 0);
      expect(typed.sql).toContain('ipm_max_price   = ?::numeric,');
      expect(typed.values).toContain(4600);
      for (const call of [1, 2]) {
        expect(statementOf(tx.$executeRaw, call).sql).not.toContain('ipm_max_price');
      }
      expect(statementOf(tx.$executeRaw, 1).values).toEqual(statementOf(tx.$executeRaw, 2).values);
    });

    it('never touches a bucket row: its max price is its bucket MRP', async () => {
      await writer.updateBucketPrice(txClient(), IPM_ID, { ...candidate(), maxPrice: 99 });
      const statement = statementOf(tx.$executeRaw);
      expect(statement.sql).not.toContain('ipm_max_price');
      expect(statement.values).not.toContain(99);
    });

    it("S3 and a split start from it, before the headline's / the origin row's own", async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);
      await writer.insertBucketPrice(txClient(), headline(4600), branchScope);
      const inserted = statementOf(tx.$queryRaw, 0);
      expect(inserted.sql).toContain('COALESCE(?::numeric, ?::numeric, h.ipm_max_price, 0)');
      expect(inserted.values).toContain(4600);

      await writer.insertBucketPrice(txClient(), headline(null), branchScope);
      expect(statementOf(tx.$queryRaw, 1).sql).toContain(
        'COALESCE(?::numeric, h.ipm_max_price, 0)',
      );

      await writer.insertSplitPrice(txClient(), IPM_ID, headline(4600), {
        from: '2026-12-01',
        to: '9999-12-31',
      });
      const split = statementOf(tx.$queryRaw, 2);
      expect(split.sql).not.toContain('o.ipm_max_price, COALESCE');
      expect(split.values).toContain(4600);
      await writer.insertSplitPrice(txClient(), IPM_ID, headline(null), {
        from: '2026-12-01',
        to: '9999-12-31',
      });
      expect(statementOf(tx.$queryRaw, 3).sql).toContain('o.ipm_max_price, COALESCE');
    });
  });

  // ── the split copies the origin row's type ─────────────────────────────────
  describe('insertSplitPrice', () => {
    it("copies the origin row's profit type, else By User", async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);

      await writer.insertSplitPrice(txClient(), IPM_ID, candidate(), {
        from: '2026-11-01',
        to: '9999-12-31',
      });

      const statement = statementOf(tx.$queryRaw);
      expect(statement.sql).toContain('COALESCE(?::varchar, o.ipm_profit_type, ?)');
      const at = statement.values.indexOf('By User');
      expect(statement.values[at - 1]).toBeNull();
    });
  });

  // ── Cost Price – Bulk Change: the in-place rewrite ─────────────────────────
  describe('rewritePriceRows', () => {
    const dec = (value: string) => new Prisma.Decimal(value);
    const level = (price: string, wot: string, markup: string) => ({
      price: dec(price),
      priceWot: dec(wot),
      markupPerc: dec(markup),
    });
    const rewrite = (overrides: Record<string, unknown> = {}) => ({
      ipmId: IPM_ID,
      costPrice: dec('152'),
      costWot: dec('144.761905'),
      maxPrice: dec('199'),
      minPrice: dec('150'),
      profitType: 'By %',
      levels: [
        level('167.5', '159.52381', '10.197368'),
        level('182.5', '173.809524', '20.065789'),
        level('0', '0', '0'),
        level('190', '180.952381', '25'),
      ] as const,
      ...overrides,
    });

    it('one UPDATE for all rows, decimals as exact text, the stamps, and one record per row', async () => {
      const before = new Map([
        [IPM_ID, ipmRow({ ipm_cost_price: 140 })],
        [OTHER_IPM_ID, ipmRow({ ipm_id: OTHER_IPM_ID })],
      ]);
      const after = new Map([
        [IPM_ID, ipmRow({ ipm_cost_price: 152 })],
        [OTHER_IPM_ID, ipmRow({ ipm_id: OTHER_IPM_ID, ipm_cost_price: 10 })],
      ]);
      snapshots = [before, after];

      const result = await writer.rewritePriceRows(
        txClient(),
        PRICE_ORIGIN.BULK_COST_CHANGE,
        [
          rewrite(),
          rewrite({ ipmId: OTHER_IPM_ID, reason: 'Ticked: below cost', profitType: 'By User' }),
        ],
        USER_ID,
      );

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      const statement = statementOf(tx.$executeRaw);
      expect(statement.sql).toContain('UPDATE inventory.item_price_master p');
      expect(statement.sql).toContain('ipm_profit_type         = v.profit_type');
      expect(statement.sql).toContain('ipm_max_price           = v.max_price');
      // round-off, the period and the bucket are never written
      expect(statement.sql).not.toMatch(/ipm_round_off|ipm_effective_|ipm_bucket_/);
      expect(statement.values[0]).toBe(USER_ID);
      expect(statement.values[1]).toEqual([IPM_ID, OTHER_IPM_ID]);
      expect(statement.values[2]).toEqual(['152', '152']);
      expect(statement.values[3]).toEqual(['144.761905', '144.761905']);
      expect(statement.values[6]).toEqual(['By %', 'By User']);
      expect(statement.values[7]).toEqual(['167.5', '167.5']);
      expect(statement.values[9]).toEqual(['0', '0']);
      expect(statement.values[18]).toEqual(['25', '25']);

      expect(changeLog.record).toHaveBeenCalledTimes(2);
      expect(recorded(0)).toEqual({
        table: 'IPM',
        rowId: IPM_ID,
        origin: PRICE_ORIGIN.BULK_COST_CHANGE,
        before: before.get(IPM_ID),
        after: after.get(IPM_ID),
      });
      expect(recorded(1).origin).toEqual({
        ...PRICE_ORIGIN.BULK_COST_CHANGE,
        reason: 'Ticked: below cost',
      });
      expect(result.before).toBe(before);
      expect(result.after).toBe(after);
    });

    it('no rows: no statement, no log', async () => {
      await expect(
        writer.rewritePriceRows(txClient(), PRICE_ORIGIN.BULK_COST_CHANGE, [], USER_ID),
      ).resolves.toEqual({ before: new Map(), after: new Map() });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(changeLog.snapshot).not.toHaveBeenCalled();
    });

    it('stores the nil-uuid actor as NULL', async () => {
      await writer.rewritePriceRows(
        txClient(),
        PRICE_ORIGIN.BULK_COST_CHANGE,
        [rewrite()],
        DEFAULT_ACTOR,
      );
      expect(statementOf(tx.$executeRaw).values[0]).toBeNull();
    });
  });

  // ── Cost Price – Bulk Change: a company copy of a company-shared row ───────
  describe('insertCompanyPriceRows', () => {
    const dec = (value: string) => new Prisma.Decimal(value);
    const level = (price: string) => ({
      price: dec(price),
      priceWot: dec('0'),
      markupPerc: dec('0'),
    });
    const copy = (overrides: Record<string, unknown> = {}) => ({
      ipmId: IPM_ID,
      costPrice: dec('152'),
      costWot: dec('144.761905'),
      maxPrice: dec('199'),
      minPrice: dec('150'),
      profitType: 'By %',
      levels: [level('167.5'), level('182.5'), level('175'), level('190')] as const,
      ...overrides,
    });

    it('inserts a company row from the shared one (its scope, period, attributes), logged as CREATE', async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);
      const created = ipmRow({ ipm_id: OTHER_IPM_ID, ipm_company_id: COMPANY_ID });
      snapshots = [new Map([[OTHER_IPM_ID, created]])];

      const result = await writer.insertCompanyPriceRows(
        txClient(),
        PRICE_ORIGIN.BULK_COST_CHANGE,
        COMPANY_ID,
        [copy({ reason: 'Ticked: below cost' })],
        USER_ID,
      );

      const statement = statementOf(tx.$queryRaw);
      expect(statement.sql).toContain('INSERT INTO inventory.item_price_master');
      // copied from the shared row, which must still be shared
      expect(statement.sql).toContain('FROM inventory.item_price_master o');
      expect(statement.sql).toContain('o.ipm_company_id IS NULL');
      expect(statement.sql).toContain(
        'o.ipm_branch_id, o.ipm_item_id, o.ipm_uc_unit_id, o.ipm_godown_id',
      );
      expect(statement.sql).toContain('o.ipm_round_off');
      // the shared row's period, clipped to the company's own rows of the key
      expect(statement.sql).toContain('GREATEST(o.ipm_effective_from');
      expect(statement.sql).toContain('LEAST(o.ipm_effective_to');
      expect(statement.sql).toContain('k.ipm_company_id = ?::uuid');
      expect(statement.values[0]).toBe(COMPANY_ID);
      expect(statement.values).toContain('152');
      expect(statement.values).toContain('By %');
      expect(statement.values.at(-1)).toBe(IPM_ID);
      // no UPDATE: the shared row itself is never written
      expect(tx.$executeRaw).not.toHaveBeenCalled();

      expect(recorded()).toEqual({
        table: 'IPM',
        rowId: OTHER_IPM_ID,
        origin: { ...PRICE_ORIGIN.BULK_COST_CHANGE, reason: 'Ticked: below cost' },
        before: null,
        after: created,
      });
      expect(result.get(IPM_ID)).toEqual({ ipmId: OTHER_IPM_ID, after: created });
    });

    it('a row that is no longer shared inserts nothing and logs nothing', async () => {
      tx.$queryRaw.mockResolvedValue([]);
      const result = await writer.insertCompanyPriceRows(
        txClient(),
        PRICE_ORIGIN.BULK_COST_CHANGE,
        COMPANY_ID,
        [copy()],
        USER_ID,
      );
      expect(result.size).toBe(0);
      expect(changeLog.record).not.toHaveBeenCalled();
    });
  });
});
