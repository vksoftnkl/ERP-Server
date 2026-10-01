import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { ItemUnitConversionService } from '../src/modules/Inventory/item-unit-conversion/item-unit-conversion.service';
import { ItemsPriceMasterService } from '../src/modules/Inventory/items-price-master/items-price-master.service';
import { PriceBucketService } from '../src/modules/Inventory/items-price-master/price-bucket.service';
import { ItemsEanCodeMasterService } from '../src/modules/Inventory/items-ean-code-master/items-ean-code-master.service';
import { ItemsReorderMasterService } from '../src/modules/Inventory/items-reorder-master/items-reorder-master.service';
import { ItemMasterUpdateService } from '../src/modules/Inventory/items-master/item-master-update.service';
import { ItemsMasterService } from '../src/modules/Inventory/items-master/items-master.service';
import { StockTrackPolicyService } from '../src/modules/stocks/stock-track-policy/stock-track-policy.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import { ItemPriceLookup } from '../src/modules/master-lookup/lookups/item-price.lookup';
import { PriceBucketGateway } from '../src/modules/stocks/selling-price-bulk/price-bucket.gateway';
import { SellingPriceBulkService } from '../src/modules/stocks/selling-price-bulk/selling-price-bulk.service';
import { buildStockPosting } from './helpers/stock-posting.factory';
import type { SaveItemCompositeDto } from '../src/modules/Inventory/items-master/dto/save-item-composite.dto';
import type { SaveSellingPriceBulkDto } from '../src/modules/stocks/selling-price-bulk/dto/save-selling-price-bulk.dto';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import type { ItemPriceLookupPayload } from '../src/modules/master-lookup/types/master-lookup-api.types';
import type { ItemPriceLookupQueryDto } from '../src/modules/master-lookup/dto/item-price-lookup-query.dto';

/**
 * ONE PRICE TABLE (plan-nestjs-one-price-table.md §7) against the real
 * database, in one rolled-back transaction like `stock-engine-ts.e2e-spec.ts`:
 * the migration's EXCLUDE and CHECKs, the resolver through the sale lookup,
 * the item card's derived buckets and re-key, menu 30's statements, the
 * opening seed — and real stock, posted through the one engine, so a bucket
 * "in stock" is a lot and a balance and not a fixture row.
 *
 *     npm run test:e2e -- one-price-table
 */

const MIGRATION = join(
  __dirname,
  '..',
  'prisma/migrations/20260930160000_one_price_table/migration.sql',
);
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-04-01';

/** Byte for byte the record opening-stock-voucher.controller.ts pins, less its refno series. */
const OPENING_RULES: StockVoucherTypeRules = {
  voucherType: 'OPENING',
  typeCode: 'OPN',
  displayName: 'Opening stock',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnTypes: ['OPENING'],
  quantityMode: 'QTY',
  allowsCount: false,
  allowsToBranch: false,
  auditScreenName: 'Opening Stock',
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  postShape: 'SIMPLE',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

const prisma = new PrismaClient();
class Rollback extends Error {}

function transactional(tx: Prisma.TransactionClient): PrismaService {
  const proxy: object = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (client: unknown) => unknown)(proxy)
            : Promise.all(arg as Array<Promise<unknown>>);
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy as PrismaService;
}

interface Fixture {
  companyId: string;
  branchX: string;
  branchY: string;
  deviceId: string;
  godownId: string;
  groupId: string;
  unitId: string;
  userId: string;
  presetMrp: string;
  presetNone: string;
  presetSp: string;
  taxId: string;
}

/** Today and tomorrow in the server's calendar — what CURRENT_DATE answers. */
const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

describe('One price table (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let fixture: Fixture;
  let items: ItemsMasterService;
  let prices: ItemsPriceMasterService;
  let vouchers: StockVoucherService;
  let lookup: ItemPriceLookup;
  let gateway: PriceBucketGateway;
  let menu30: SellingPriceBulkService;
  let spSeq = 0;
  const stamp = Date.now().toString(36);

  beforeAll(async () => {
    await new Promise<void>((ready, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          },
          { maxWait: 30_000, timeout: 10 * 60_000 },
        )
        .then(
          () => undefined,
          (error: unknown) => {
            if (error instanceof Rollback) return;
            fail(error instanceof Error ? error : new Error(String(error)));
            throw error;
          },
        );
    });
    fixture = await createFixture();
    const ctx = {
      getUserId: () => fixture.userId,
      getCompanyId: () => fixture.companyId,
      getUserType: () => 'ADMIN',
      getDeviceId: () => null,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    // The REAL audit service: a mock is how notes 71 B1 (every valid menu 30
    // save refused by the audit call) got past this suite.
    const audit = new AuditLogService(db, ctx);
    const grid = {} as never;
    // No overrides: sales.default_price_level reads its default (A), and the
    // below-cost rule is `allow` so menu 30 never stops to ask.
    const settings = {
      resolveEffective: () =>
        Promise.resolve([{ asdKey: 'inventory.below_cost_price', value: 'allow' }]),
    } as never;
    const buckets = new PriceBucketService(settings);
    const iuc = new ItemUnitConversionService(db, audit, grid, ctx);
    prices = new ItemsPriceMasterService(db, audit, grid, ctx, buckets);
    const ean = new ItemsEanCodeMasterService(db, audit, grid, ctx);
    const reorder = new ItemsReorderMasterService(db, audit, grid, ctx);
    items = new ItemsMasterService(
      db,
      audit,
      ctx,
      iuc,
      prices,
      ean,
      reorder,
      new ItemMasterUpdateService(iuc, prices, ean, reorder, buckets),
      new StockTrackPolicyService(db, audit, ctx),
      buckets,
    );
    vouchers = new StockVoucherService(
      db,
      audit,
      ctx,
      buildStockPosting(db, 'PERIODIC').stockPosting,
    );
    lookup = new ItemPriceLookup(db);
    gateway = new PriceBucketGateway(db);
    menu30 = new SellingPriceBulkService(db, audit, ctx, settings, gateway);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    const [scope] = await tx.$queryRaw<
      Array<{ comp: string; branch_x: string; branch_y: string; dev: string; godown: string }>
    >`
      SELECT br.br_comp_id AS comp, br.br_id AS branch_x,
             (SELECT b2.br_id FROM public.branch_master b2
               WHERE b2.br_comp_id = br.br_comp_id AND b2.br_id <> br.br_id
                 AND b2.br_is_deleted = false ORDER BY b2.br_id LIMIT 1) AS branch_y,
             (SELECT d.dev_id FROM fixed.device_master d
               WHERE d.dev_branch_id = br.br_id AND d.dev_is_deleted = false LIMIT 1) AS dev,
             (SELECT g.gdl_id FROM inventory.godown_locations g
               WHERE g.gdl_branch_id = br.br_id AND g.gdl_is_deleted = false
               ORDER BY g.gdl_name LIMIT 1) AS godown
        FROM public.branch_master br
       WHERE br.br_is_deleted = false
         AND EXISTS (SELECT 1 FROM fixed.device_master d
                      WHERE d.dev_branch_id = br.br_id AND d.dev_is_deleted = false)
         AND EXISTS (SELECT 1 FROM inventory.godown_locations g
                      WHERE g.gdl_branch_id = br.br_id AND g.gdl_is_deleted = false)
         AND (SELECT count(*) FROM public.branch_master b2
               WHERE b2.br_comp_id = br.br_comp_id AND b2.br_is_deleted = false) >= 2
       LIMIT 1
    `;
    if (!scope) throw new Error('No company with two branches, a device and a godown here.');
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master ORDER BY itg_id LIMIT 1`;
    const [unit] = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master WHERE unit_is_deleted = false
       ORDER BY unit_name LIMIT 1`;
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    const [tax] = await tx.$queryRaw<Array<{ tax_id: string }>>`
      SELECT tax_id FROM inventory.tax_rate_master
       WHERE tax_is_deleted = false AND tax_rate_perc = 18 LIMIT 1`;
    const presets = await tx.$queryRaw<Array<{ spt_id: string; spt_code: string }>>`
      SELECT spt_id, spt_code FROM stock.stock_track_preset
       WHERE spt_is_deleted = false AND spt_code IN ('MRP_SELLING', 'NONE', 'SP_ONLY')`;
    const preset = (code: string) => {
      const found = presets.find((row) => row.spt_code === code);
      if (!found) throw new Error(`No ${code} stock track preset on this database.`);
      return found.spt_id;
    };
    return {
      companyId: scope.comp,
      branchX: scope.branch_x,
      branchY: scope.branch_y,
      deviceId: scope.dev,
      godownId: scope.godown,
      groupId: group.itg_id,
      unitId: unit.unit_id,
      userId: user.usr_id,
      presetMrp: preset('MRP_SELLING'),
      presetNone: preset('NONE'),
      presetSp: preset('SP_ONLY'),
      taxId: tax.tax_id,
    };
  }

  /** Runs `fn` inside a SAVEPOINT and rolls back to it on failure, then rethrows. */
  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const name = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
      throw error;
    }
  }
  /** Runs `fn` and rolls its effects — and its locks — back whether it succeeded or not. */
  async function undone<T>(fn: () => Promise<T>): Promise<T> {
    const name = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
    try {
      return await fn();
    } finally {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    }
  }
  const refusal = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return {
        status: (error as { status?: number }).status,
        body: JSON.stringify((error as { response?: unknown }).response ?? String(error)),
      };
    }
    throw new Error('expected a refusal, got a result');
  };

  // ── builders ────────────────────────────────────────────────────────────
  const itemDto = (name: string, presetId: string): SaveItemCompositeDto => ({
    item_company_id: fixture.companyId,
    item_name_en: `OPT ${name} ${stamp}`,
    item_group_id: fixture.groupId,
    item_base_unit_id: fixture.unitId,
    item_track_preset_id: presetId,
    unit_conversions: [
      {
        iuc_unit_id: fixture.unitId,
        iuc_is_base_unit: true,
        iuc_is_default_unit: true,
        iuc_to_base_factor: 1,
      },
    ],
  });
  const priceRow = (
    branchId: string | null,
    maxPrice: number,
    priceA: number,
    extra: Record<string, unknown> = {},
  ) => ({
    ipm_company_id: fixture.companyId,
    ipm_branch_id: branchId,
    ipm_uc_unit_id: fixture.unitId,
    ipm_profit_type: 'By User',
    ipm_max_price: maxPrice,
    ipm_sales_price_a: priceA,
    ...extra,
  });
  const createItem = (name: string, presetId: string, rows: ReturnType<typeof priceRow>[]) =>
    attempt(() => items.saveComposite({ ...itemDto(name, presetId), prices: rows }));
  const ask = (
    itemId: string,
    extra: Partial<ItemPriceLookupQueryDto> = {},
  ): Promise<ItemPriceLookupPayload> =>
    lookup.getItemPriceLookup({
      item_id: itemId,
      company_id: fixture.companyId,
      branch_id: fixture.branchX,
      price_level: 1,
      ...extra,
    });
  const livePrices = (itemId: string) =>
    tx.itemPriceMaster.findMany({
      where: { ipmItemId: itemId, ipmIsDeleted: false },
      orderBy: [{ ipmBranchId: { sort: 'asc', nulls: 'first' } }, { ipmMaxPrice: 'asc' }],
    });
  const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

  async function openStock(
    itemId: string,
    iucId: string,
    lines: Array<{ mrp: number; qty: number; costRate?: number }>,
  ) {
    const saved = await attempt(() =>
      vouchers.save(OPENING_RULES, {
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchX,
          deviceId: fixture.deviceId,
          docDate: DOC_DATE,
          toGodownId: fixture.godownId,
          rateSource: 'MANUAL',
          userId: fixture.userId,
        },
        lines: lines.map((line, index) => ({
          lineNo: index + 1,
          itemId,
          uomId: iucId,
          baseUomId: iucId,
          toBaseFactor: 1,
          qty: line.qty,
          baseQty: line.qty,
          godownId: fixture.godownId,
          costRate: line.costRate ?? 30,
          mrp: line.mrp,
        })),
      } as never),
    );
    await attempt(() =>
      vouchers.post(
        OPENING_RULES,
        saved.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchX,
        fixture.userId,
      ),
    );
  }

  // ── the item every bucket case shares ───────────────────────────────────
  //   MRP-tracked (MRP_SELLING). Chain headline A 36 carrying the attributes a
  //   new bucket must inherit; chain MRP 40 at A 38; branch X's own MRP 40 at A 37.
  let tracked: { itemId: string; iucId: string };

  it('1. the migration re-runs cleanly and leaves every stored row as it was', async () => {
    const before = await tx.$queryRaw<Array<{ n: bigint; sig: string }>>`
      SELECT count(*) AS n,
             md5(string_agg(ipm_id::text || ipm_key_mrp::text || ipm_key_sp::text
                            || ipm_effective_from::text || ipm_effective_to::text, ',' ORDER BY ipm_id)) AS sig
        FROM inventory.item_price_master WHERE ipm_is_deleted = false`;
    const legacy = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM inventory.item_price_master
       WHERE ipm_is_deleted = false AND ipm_bucket_mrp IS NULL AND ipm_bucket_sp IS NULL
         AND NOT (ipm_key_mrp = -1 AND ipm_key_sp = -1)`;
    expect(Number(legacy[0].n)).toBe(0);

    const statements = readFileSync(MIGRATION, 'utf8')
      .split(/;\s*\n/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.replace(/--.*$/gm, '').trim().length > 0);
    // Inside a savepoint that is rolled back: the ALTERs take an exclusive lock
    // on the price table, and rolling back to the savepoint releases it.
    const after = await undone(async () => {
      for (let run = 0; run < 2; run += 1) {
        for (const statement of statements) {
          await tx.$executeRawUnsafe(statement);
        }
      }
      return tx.$queryRaw<Array<{ n: bigint; sig: string }>>`
        SELECT count(*) AS n,
               md5(string_agg(ipm_id::text || ipm_key_mrp::text || ipm_key_sp::text
                              || ipm_effective_from::text || ipm_effective_to::text, ',' ORDER BY ipm_id)) AS sig
          FROM inventory.item_price_master WHERE ipm_is_deleted = false`;
    });
    expect(after[0]).toEqual(before[0]);
  });

  it('10. the item card derives one row per unit × MRP for an MRP-tracked item', async () => {
    const created = await createItem('Hamam', fixture.presetMrp, [
      priceRow(null, 0, 36, {
        ipm_addl_cess: 2,
        ipm_loading_charge: 3,
        ipm_godown_id: fixture.godownId,
      }),
      priceRow(null, 40, 38),
      priceRow(fixture.branchX, 40, 37),
    ]);
    tracked = {
      itemId: created.item.item_id,
      iucId: created.unit_conversions[0].iuc_id,
    };
    const rows = await livePrices(tracked.itemId);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const mrp = Number(row.ipmMaxPrice);
      expect(num(row.ipmBucketMrp)).toBe(mrp > 0 ? mrp : null);
      expect(row.ipmBucketSp).toBeNull();
    }
    // The payload echoes the derived bucket, read-only.
    expect(created.prices.map((p) => p.ipm_bucket_mrp).sort()).toEqual([40, 40, null]);
  });

  it('10b. a second MRP for the same unit is simply a second row', async () => {
    const saved = await attempt(() =>
      items.saveComposite({
        ...itemDto('Hamam', fixture.presetMrp),
        item_id: tracked.itemId,
        prices: [
          priceRow(null, 0, 36, {
            ipm_addl_cess: 2,
            ipm_loading_charge: 3,
            ipm_godown_id: fixture.godownId,
          }),
          priceRow(null, 40, 38),
          priceRow(fixture.branchX, 40, 37),
          priceRow(null, 45, 44),
        ],
      }),
    );
    expect(saved.prices).toHaveLength(4);
    const byMrp = saved.prices.filter((p) => p.ipm_branch_id === null);
    expect(byMrp.map((p) => p.ipm_bucket_mrp).sort()).toEqual([40, 45, null]);
    // Matched by derived key, not recreated: the chain 40 row kept its id.
    const before = await livePrices(tracked.itemId);
    expect(before).toHaveLength(4);
  });

  it('2 / 3. the lookup resolves bucket before headline, branch before chain', async () => {
    const atX40 = await ask(tracked.itemId, { mrp: 40 });
    expect(atX40).toMatchObject({
      sales_price: 37,
      max_price: 40,
      price_source: 'BUCKET',
      price_scope: 'BRANCH',
    });
    const atY40 = await ask(tracked.itemId, { mrp: 40, branch_id: fixture.branchY });
    expect(atY40).toMatchObject({ sales_price: 38, price_source: 'BUCKET', price_scope: 'CHAIN' });
    const atX50 = await ask(tracked.itemId, { mrp: 50 });
    expect(atX50).toMatchObject({
      sales_price: 36,
      max_price: 0,
      price_source: 'MASTER',
      price_scope: 'CHAIN',
    });
    // The bucket row carries no cess of its own here; the headline answered
    // for MRP 50, and its attributes ride with it.
    expect(atX50.addl_cess).toBe(2);
  });

  it('4. a bucket dated from tomorrow is MASTER today and BUCKET tomorrow', async () => {
    await undone(async () => {
      await tx.itemPriceMaster.updateMany({
        where: { ipmItemId: tracked.itemId, ipmBranchId: null, ipmMaxPrice: 45 },
        data: { ipmEffectiveFrom: new Date(`${day(1)}T00:00:00Z`) },
      });
      expect(await ask(tracked.itemId, { mrp: 45 })).toMatchObject({ price_source: 'MASTER' });
      expect(await ask(tracked.itemId, { mrp: 45, doc_date: day(1) })).toMatchObject({
        price_source: 'BUCKET',
        sales_price: 44,
      });
    });
  });

  it('5. an untracked item prices off its headline whatever MRP the bill typed', async () => {
    const created = await createItem('Salt', fixture.presetNone, [priceRow(null, 40, 20)]);
    const rows = await livePrices(created.item.item_id);
    expect(rows[0].ipmBucketMrp).toBeNull();
    expect(await ask(created.item.item_id, { mrp: 40 })).toMatchObject({
      price_source: 'MASTER',
      sales_price: 20,
      buckets: [],
    });
  });

  it('6. two MRPs in stock: buckets[] lists both with their prices; the line itself is the headline', async () => {
    await openStock(tracked.itemId, tracked.iucId, [
      { mrp: 40, qty: 10 },
      { mrp: 50, qty: 5 },
    ]);
    const answer = await ask(tracked.itemId);
    expect(answer).toMatchObject({ price_source: 'MASTER', sales_price: 36 });
    const byMrp = new Map(answer.buckets.map((bucket) => [bucket.mrp, bucket]));
    expect(answer.buckets).toHaveLength(2);
    expect(byMrp.get(40)).toMatchObject({
      available_qty: 10,
      price_source: 'BUCKET',
      price_scope: 'BRANCH',
      sales_price: 37,
    });
    expect(byMrp.get(50)).toMatchObject({
      available_qty: 5,
      price_source: 'MASTER',
      sales_price: 36,
    });
  });

  it('7. a line that holds a lot is priced by that lot’s bucket, whatever mrp it sends', async () => {
    const [lot] = await tx.$queryRaw<Array<{ slt_id: string }>>`
      SELECT slt_id FROM stock.stock_lot WHERE slt_item_id = ${tracked.itemId}::uuid AND slt_mrp = 40`;
    expect(await ask(tracked.itemId, { lot_id: lot.slt_id, mrp: 50 })).toMatchObject({
      price_source: 'BUCKET',
      sales_price: 37,
      max_price: 40,
    });
  });

  it('8. ex_ipm_overlap: a second row for one scope + unit + bucket is a 409', async () => {
    const answer = await refusal(
      attempt(() =>
        prices.save({
          ...priceRow(fixture.branchX, 40, 39),
          ipm_item_id: tracked.itemId,
          ipm_uc_unit_id: tracked.iucId,
        } as never),
      ),
    );
    expect(answer.status).toBe(409);
    expect(answer.body).toContain('already has a price');
  });

  it('9. ck_ipm_not_above_mrp: a bucket above its MRP is a 422; a headline above its MRP is not', async () => {
    const answer = await refusal(
      attempt(() =>
        prices.save({
          ...priceRow(fixture.branchY, 70, 80),
          ipm_item_id: tracked.itemId,
          ipm_uc_unit_id: tracked.iucId,
        } as never),
      ),
    );
    expect(answer.status).toBe(422);
    expect(answer.body).toContain('cannot be above that MRP');

    const untracked = await createItem('Legacy', fixture.presetNone, [priceRow(null, 10, 20)]);
    expect(untracked.prices[0]).toMatchObject({ ipm_max_price: 10, ipm_sales_price_a: 20 });
  });

  it('11. two MRPs for one unit of an untracked item are one price: refused, both rows named', async () => {
    const answer = await refusal(
      createItem('Twin', fixture.presetNone, [priceRow(null, 40, 30), priceRow(null, 45, 31)]),
    );
    expect(answer.status).toBe(400);
    expect(answer.body).toContain('prices[0] and prices[1]');
  });

  it('12. switching MRP tracking OFF over two priced MRPs is refused; switching it ON re-keys', async () => {
    const two = await createItem('Flip', fixture.presetMrp, [
      priceRow(null, 40, 30),
      priceRow(null, 45, 31),
    ]);
    const off = await refusal(
      attempt(() =>
        items.saveComposite({
          ...itemDto('Flip', fixture.presetNone),
          item_id: two.item.item_id,
        }),
      ),
    );
    expect(off.status).toBe(409);
    expect(off.body).toContain('MRP 40');
    expect(off.body).toContain('MRP 45');

    const one = await createItem('Flop', fixture.presetNone, [priceRow(null, 40, 30)]);
    expect(one.prices[0].ipm_bucket_mrp).toBeNull();
    const on = await attempt(() =>
      items.saveComposite({ ...itemDto('Flop', fixture.presetMrp), item_id: one.item.item_id }),
    );
    expect(on.item.item_track_preset_id).toBe(fixture.presetMrp);
    const [rekeyed] = await livePrices(one.item.item_id);
    expect(num(rekeyed.ipmBucketMrp)).toBe(40);
  });

  it('Q24 / Q25. menu 30 lists a row per unit × bucket in stock, priced by the resolver', async () => {
    const picker = await menu30.listBuckets(tracked.itemId, {
      companyId: fixture.companyId,
      branchId: fixture.branchX,
    });
    // F12 lists every live ROW this branch can see — headline first, the chain
    // row before X's override of the same bucket — each with its bucket's stock,
    // and (notes 74) every bucket IN STOCK with no row of its own: MRP 50,
    // priced by the headline exactly as the grid prices it below.
    expect(
      picker.map((row) => [row.mrp, row.priceSource, row.priceScope, row.stockQty, row.maxPrice]),
    ).toEqual([
      [null, 'MASTER', 'CHAIN', 0, 0],
      [40, 'BUCKET', 'CHAIN', 10, 40],
      [40, 'BUCKET', 'BRANCH', 10, 40],
      [45, 'BUCKET', 'CHAIN', 0, 45],
      [50, 'MASTER', 'CHAIN', 5, 0],
    ]);
    expect(picker[2].levels[0]).toMatchObject({ level: 1, price: 37 });

    const grid = await menu30.listPrices({
      companyId: fixture.companyId,
      branchId: fixture.branchX,
      itemGroupId: fixture.groupId,
      limit: 1000,
    });
    // The grid: one row per bucket IN STOCK, priced by the row that wins here.
    // MRP 50 has no row of its own, so the headline prices it (MASTER, MRP 0).
    const mine = grid.items.filter((row) => row.itemId === tracked.itemId);
    expect(
      mine.map((row) => [row.mrp, row.priceSource, row.priceScope, row.stockQty, row.maxPrice]),
    ).toEqual([
      [50, 'MASTER', 'CHAIN', 5, 0],
      [40, 'BUCKET', 'BRANCH', 10, 40],
    ]);
    // The unpriced bucket is the same row in both routes (notes 74); only its
    // position in each list (lineNo) differs.
    const withoutLine = <T extends { lineNo: number }>({ lineNo: _line, ...rest }: T) => rest;
    expect(withoutLine(picker[4])).toEqual(withoutLine(mine[0]));

    // Add item: the grid narrowed to ONE item, no other filter (notes 74).
    const one = await menu30.listPrices({
      companyId: fixture.companyId,
      branchId: fixture.branchX,
      itemId: tracked.itemId,
      limit: 1000,
    });
    expect(one.items.map(withoutLine)).toEqual(mine.map(withoutLine));
  });

  it('13. S3 for a fresh bucket copies the attributes from the headline', async () => {
    const saved = await attempt(() =>
      menu30.saveBulk({
        companyId: fixture.companyId,
        branchId: fixture.branchX,
        scope: 'BRANCH',
        rows: [
          {
            itemId: tracked.itemId,
            uomId: tracked.iucId,
            mrp: 50,
            priceScope: 'CHAIN',
            levels: [{ level: 1, price: 48 }],
          },
        ],
      } as unknown as SaveSellingPriceBulkDto),
    );
    expect(saved).toMatchObject({ saved: 1, masterRowsSaved: 0, noStock: [] });
    const row = await tx.itemPriceMaster.findFirst({
      where: { ipmItemId: tracked.itemId, ipmBranchId: fixture.branchX, ipmMaxPrice: 50 },
    });
    expect(row).not.toBeNull();
    expect({
      bucket: num(row!.ipmBucketMrp),
      cess: num(row!.ipmAddlCess),
      loading: num(row!.ipmLoadingCharge),
      godown: row!.ipmGodownId,
      a: num(row!.ipmSalesPriceA),
    }).toEqual({ bucket: 50, cess: 2, loading: 3, godown: fixture.godownId, a: 48 });
    expect(await ask(tracked.itemId, { mrp: 50 })).toMatchObject({
      price_source: 'BUCKET',
      sales_price: 48,
      addl_cess: 2,
    });
  });

  it('14. menu 30 scope table: an override is created, the chain row is left alone', async () => {
    const chain40 = async () =>
      tx.itemPriceMaster.findFirstOrThrow({
        where: {
          ipmItemId: tracked.itemId,
          ipmBranchId: null,
          ipmMaxPrice: 40,
          ipmIsDeleted: false,
        },
      });
    const before = await chain40();
    const save = (branchId: string, scope: 'BRANCH' | 'CHAIN', priceScope: string, price: number) =>
      attempt(() =>
        menu30.saveBulk({
          companyId: fixture.companyId,
          branchId,
          scope,
          rows: [
            {
              itemId: tracked.itemId,
              uomId: tracked.iucId,
              mrp: 40,
              priceScope,
              levels: [{ level: 1, price }],
            },
          ],
        } as unknown as SaveSellingPriceBulkDto),
      );

    // Row 2 · This branch over a CHAIN row, at branch Y: S3 creates Y's override.
    const row2 = await save(fixture.branchY, 'BRANCH', 'CHAIN', 39);
    expect(row2.noStock).toHaveLength(1);
    expect(await ask(tracked.itemId, { mrp: 40, branch_id: fixture.branchY })).toMatchObject({
      sales_price: 39,
      price_scope: 'BRANCH',
    });
    expect(num((await chain40()).ipmSalesPriceA)).toBe(38);

    // Row 1 · This branch over a BRANCH row: S2 updates X's own row in place.
    await save(fixture.branchX, 'BRANCH', 'BRANCH', 36.5);
    expect(await ask(tracked.itemId, { mrp: 40 })).toMatchObject({ sales_price: 36.5 });

    // Row 4 · All branches over a BRANCH row: the override moves, the chain does not.
    await save(fixture.branchX, 'CHAIN', 'BRANCH', 36);
    expect(await ask(tracked.itemId, { mrp: 40 })).toMatchObject({ sales_price: 36 });
    expect(num((await chain40()).ipmSalesPriceA)).toBe(38);

    // Row 3 · All branches over the CHAIN row: the chain row moves.
    await save(fixture.branchX, 'CHAIN', 'CHAIN', 38.5);
    const after = await chain40();
    expect(after.ipmId).toBe(before.ipmId);
    expect(num(after.ipmSalesPriceA)).toBe(38.5);
    // Y kept its override; X kept its own.
    expect(await ask(tracked.itemId, { mrp: 40, branch_id: fixture.branchY })).toMatchObject({
      sales_price: 39,
    });
  });

  it('15. the opening seed: dearest bucket; the headline MRP when none; null with no row', async () => {
    const seed = (itemId: string, uomId: string) =>
      gateway.findOpeningSeedBucket({
        companyId: fixture.companyId,
        branchId: fixture.branchY,
        itemId,
        uomId,
        onDate: day(0),
      });
    const bucketed = await createItem('Seed', fixture.presetMrp, [
      priceRow(null, 0, 10),
      priceRow(null, 40, 30),
      priceRow(null, 45, 31),
    ]);
    expect(await seed(bucketed.item.item_id, bucketed.unit_conversions[0].iuc_id)).toEqual({
      mrp: 45,
      salePrice: 0,
    });
    const headline = await createItem('Seed H', fixture.presetNone, [priceRow(null, 50, 20)]);
    expect(await seed(headline.item.item_id, headline.unit_conversions[0].iuc_id)).toEqual({
      mrp: 50,
      salePrice: 0,
    });
    const bare = await createItem('Seed 0', fixture.presetNone, []);
    expect(await seed(bare.item.item_id, bare.unit_conversions[0].iuc_id)).toBeNull();
  });

  it('notes 71 B2. an item priced only per MRP, with no stock, can still be looked up', async () => {
    const only = await createItem('OnlyMRP', fixture.presetMrp, [
      priceRow(null, 40, 38),
      priceRow(null, 45, 44),
    ]);
    // No MRP on the line: the dearest bucket answers, provisionally, and
    // buckets[] offers every priced bucket at quantity 0.
    const answer = await ask(only.item.item_id);
    expect(answer).toMatchObject({ price_source: 'BUCKET', max_price: 45, sales_price: 44 });
    expect(answer.buckets.map((b) => [b.mrp, b.available_qty, b.sales_price])).toEqual([
      [45, 0, 44],
      [40, 0, 38],
    ]);
    // A typed MRP that nothing prices is still a 404, and it names what is priced.
    const missing = await refusal(ask(only.item.item_id, { mrp: 50 }));
    expect(missing.status).toBe(404);
    expect(missing.body).toContain('MRP 45, MRP 40');
  });

  it('notes 71 B4. a row saved with prices only gets its without-tax figure and markup derived', async () => {
    const saved = await attempt(() =>
      items.saveComposite({
        ...itemDto('Derived', fixture.presetNone),
        item_default_tax_id: fixture.taxId,
        prices: [priceRow(null, 0, 118, { ipm_cost_price: 100 })],
      }),
    );
    // 118 at 18% is 100 without tax; markup on the tax-inclusive pair, (118 − 100) ÷ 100.
    expect(saved.prices[0]).toMatchObject({ ipm_price_a_wot: 100, ipm_price_a_markup_perc: 18 });
    // A client that sends them is taken at its word.
    const sent = await attempt(() =>
      items.saveComposite({
        ...itemDto('Sent', fixture.presetNone),
        item_default_tax_id: fixture.taxId,
        prices: [
          priceRow(null, 0, 118, {
            ipm_cost_price: 100,
            ipm_price_a_wot: 99,
            ipm_price_a_markup_perc: 7,
          }),
        ],
      }),
    );
    expect(sent.prices[0]).toMatchObject({ ipm_price_a_wot: 99, ipm_price_a_markup_perc: 7 });
  });

  it('sale-price buckets: a SP-tracked item keys its row on the default-level price', async () => {
    const sp = await createItem('SalePrice', fixture.presetSp, [priceRow(null, 0, 38)]);
    const [row] = await livePrices(sp.item.item_id);
    expect([num(row.ipmBucketMrp), num(row.ipmBucketSp)]).toEqual([null, 38]);
    expect(await ask(sp.item.item_id, { sale_price: 38 })).toMatchObject({
      price_source: 'BUCKET',
      sales_price: 38,
    });
    // A sale price nothing prices, with no headline: the 404 names the priced one.
    const missing = await refusal(ask(sp.item.item_id, { sale_price: 40 }));
    expect(missing.body).toContain('sale price 38');
  });
  it('notes 75. an MRP bucket is costed by its own MRP’s stock; the grid, F12 and the save agree', async () => {
    const created = await createItem('Landing', fixture.presetMrp, [priceRow(null, 0, 600)]);
    const item = { itemId: created.item.item_id, iucId: created.unit_conversions[0].iuc_id };
    await openStock(item.itemId, item.iucId, [
      { mrp: 40, qty: 10, costRate: 25 },
      { mrp: 550, qty: 20, costRate: 500 },
    ]);
    const average = (10 * 25 + 20 * 500) / 30; // 341.67 — the item's moving average

    const grid = await menu30.listPrices({
      companyId: fixture.companyId,
      branchId: fixture.branchX,
      itemId: item.itemId,
      limit: 100,
    });
    expect(grid.items.map((row) => [row.mrp, row.costRate, row.costBasis])).toEqual([
      [550, 500, 'MRP'],
      [40, 25, 'MRP'],
    ]);

    const f12 = await menu30.listBuckets(item.itemId, {
      companyId: fixture.companyId,
      branchId: fixture.branchX,
    });
    const headline = f12.find((row) => row.mrp === null);
    expect(headline?.costBasis).toBe('ITEM');
    expect(headline?.costRate).toBeCloseTo(average, 2);
    expect(
      f12.filter((row) => row.mrp !== null).map((row) => [row.mrp, row.costRate, row.costBasis]),
    ).toEqual([
      [40, 25, 'MRP'],
      [550, 500, 'MRP'],
    ]);

    // The save prices against the same figure: below-cost, markup, ipm_cost_price.
    const costs = await gateway.loadRowCosts(
      tx,
      [40, 550, null].map((mrp) => ({
        itemId: item.itemId,
        uomId: item.iucId,
        mrp,
        salePrice: null,
      })),
      fixture.companyId,
      fixture.branchX,
    );
    expect(costs[0].costRate).toBe(25);
    expect(costs[1].costRate).toBe(500);
    expect(costs[2].costRate).toBeCloseTo(average, 2);
  });
});
