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
        'By User',
        0.5,
        USER_ID,
        IPM_ID,
      ]);
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

    it('stores the nil-uuid actor as NULL on both stamps, at chain scope too', async () => {
      tx.$queryRaw.mockResolvedValue([{ ipmId: OTHER_IPM_ID }]);

      await writer.insertBucketPrice(txClient(), candidate({ actor: DEFAULT_ACTOR }), chainScope);

      const values = statementOf(tx.$queryRaw).values;
      expect(values).not.toContain(DEFAULT_ACTOR);
      expect(values.slice(0, 2)).toEqual([COMPANY_ID, null]);
    });
  });
});
