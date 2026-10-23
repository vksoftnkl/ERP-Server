import '../src/env.preload';

import { Type } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { validateDto } from '../src/common/utils/request-payload-validation.util';
import { ItemsPriceMasterService } from '../src/modules/Inventory/items-price-master/items-price-master.service';
import { PriceBucketService } from '../src/modules/Inventory/items-price-master/price-bucket.service';
import { SaveItemPriceDto } from '../src/modules/Inventory/items-price-master/dto/save-item-price.dto';
import { ItemsQtyPriceMasterService } from '../src/modules/Inventory/items-qty-price-master/items-qty-price-master.service';
import { SaveItemQtyPriceDto } from '../src/modules/Inventory/items-qty-price-master/dto/save-item-qty-price.dto';
import { PriceBucketGateway } from '../src/modules/stocks/selling-price-bulk/price-bucket.gateway';
import { SellingPriceBulkService } from '../src/modules/stocks/selling-price-bulk/selling-price-bulk.service';
import type { SaveSellingPriceBulkDto } from '../src/modules/stocks/selling-price-bulk/dto/save-selling-price-bulk.dto';
import { ItemPriceLogService } from '../src/modules/Inventory/item-price-log/item-price-log.service';
import { grantPriceEdit, priceWriterFor } from './helpers/price-writer';

/**
 * Notes 144 — the price change log, end to end, in ONE rolled-back
 * transaction against the live database: a price row changed from every
 * source (item card, Change Selling Price, bucket re-key, qty slabs), one log
 * row per change and none for a no-op, a bypass write caught by the gap count,
 * and the report's reads. Nothing it writes survives the run.
 */
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
  userId: string;
  companyId: string;
  branchId: string;
  ipmId: string;
  itemId: string;
  unitId: string;
  maxPrice: number;
  priceA: number;
  profitType: string;
}

interface LogRow {
  action: string;
  source: string;
  table: string;
  row_id: string;
  changed: string[];
  user_id: string | null;
  app: string;
  reason: string | null;
  sets: number;
}

describe('Price change log, notes 144 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let db: PrismaService;
  let release: () => void;
  let txDone: Promise<void>;
  let fixture: Fixture;
  let prices: ItemsPriceMasterService;
  let buckets: PriceBucketService;
  let slabs: ItemsQtyPriceMasterService;
  let menu30: SellingPriceBulkService;
  let report: ItemPriceLogService;

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
    // A price save needs Edit on menu 30 (quick rate popup plan, 2026-10-23).
    await grantPriceEdit(tx, fixture.userId);
    const ctx = {
      getUserId: () => fixture.userId,
      getCompanyId: () => fixture.companyId,
      getUserType: () => 'ADMIN',
      getDeviceId: () => null,
      getIpAddress: () => '127.0.0.1',
    } as unknown as RequestContextService;
    const priceWriter = priceWriterFor(ctx);
    db = transactional(tx);
    const audit = new AuditLogService(db, ctx);
    const settings = {
      resolveEffective: () =>
        Promise.resolve([{ asdKey: 'inventory.below_cost_price', value: 'allow' }]),
    } as never;
    buckets = new PriceBucketService(settings, priceWriter);
    prices = new ItemsPriceMasterService(db, audit, {} as never, ctx, buckets, priceWriter);
    slabs = new ItemsQtyPriceMasterService(db, audit, {} as never, ctx, priceWriter);
    menu30 = new SellingPriceBulkService(
      db,
      audit,
      ctx,
      settings,
      new PriceBucketGateway(db),
      priceWriter,
    );
    report = new ItemPriceLogService(db, ctx);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  /** A shared, all-branches headline row of an item with one live price row and no item policy. */
  async function createFixture(): Promise<Fixture> {
    const [row] = await tx.$queryRaw<
      Array<{
        ipm_id: string;
        item_id: string;
        unit_id: string;
        max_price: number;
        price_a: number;
        profit_type: string;
      }>
    >`
      SELECT p.ipm_id::text, p.ipm_item_id::text AS item_id, p.ipm_uc_unit_id::text AS unit_id,
             p.ipm_max_price::float8 AS max_price, p.ipm_sales_price_a::float8 AS price_a,
             p.ipm_profit_type AS profit_type
        FROM inventory.item_price_master p
        JOIN inventory.item_master i ON i.item_id = p.ipm_item_id
       WHERE p.ipm_is_deleted = false AND p.ipm_company_id IS NULL AND p.ipm_branch_id IS NULL
         AND p.ipm_bucket_mrp IS NULL AND p.ipm_bucket_sp IS NULL
         AND p.ipm_max_price > 10 AND p.ipm_sales_price_a > 1
         AND p.ipm_sales_price_a < p.ipm_max_price
         AND CURRENT_DATE BETWEEN p.ipm_effective_from AND p.ipm_effective_to
         AND i.item_is_active AND NOT i.item_is_deleted AND NOT COALESCE(i.item_is_service, false)
         AND NOT EXISTS (SELECT 1 FROM stock.stock_track_policy s WHERE s.stp_item_id = i.item_id)
         AND (SELECT count(*) FROM inventory.item_price_master o
               WHERE o.ipm_item_id = i.item_id AND o.ipm_is_deleted = false) = 1
       LIMIT 1`;
    const [scope] = await tx.$queryRaw<Array<{ comp: string; branch: string; usr: string }>>`
      SELECT br.br_comp_id::text AS comp, br.br_id::text AS branch,
             (SELECT usr_id::text FROM public.user_master WHERE usr_is_deleted = false
               ORDER BY usr_id LIMIT 1) AS usr
        FROM public.branch_master br WHERE br.br_is_deleted = false ORDER BY br.br_id LIMIT 1`;
    if (!row || !scope) {
      throw new Error('Needs one shared headline price row of an untracked item, and a branch.');
    }
    // The report's right, for this run only.
    await tx.$executeRaw`
      INSERT INTO public.user_menus (um_user_id, um_menu_id, um_can_view, um_created_by)
      VALUES (${scope.usr}::uuid, 290, true, ${scope.usr}::uuid)`;
    return {
      userId: scope.usr,
      companyId: scope.comp,
      branchId: scope.branch,
      ipmId: row.ipm_id,
      itemId: row.item_id,
      unitId: row.unit_id,
      maxPrice: row.max_price,
      priceA: row.price_a,
      profitType: row.profit_type,
    };
  }

  async function dto<T extends object>(body: object, metatype: Type<T>): Promise<T> {
    const out = await validateDto(body, metatype);
    if (!out) throw new Error('validateDto answered no body');
    return out;
  }

  /** Every log row of the fixture item, oldest first. */
  const log = () => tx.$queryRaw<LogRow[]>`
    SELECT ipcl_action AS action, ipcl_source AS source, ipcl_price_table AS table,
           ipcl_row_id::text AS row_id, ipcl_changed AS changed, ipcl_user_id::text AS user_id,
           ipcl_app AS app, ipcl_reason AS reason,
           (SELECT count(DISTINCT ipcl_change_set_id)::int FROM inventory.item_price_change_log
             WHERE ipcl_item_id = ${fixture.itemId}::uuid) AS sets
      FROM inventory.item_price_change_log
     WHERE ipcl_item_id = ${fixture.itemId}::uuid
     ORDER BY ipcl_id`;

  const itemCard = (overrides: Record<string, unknown> = {}) =>
    dto(
      {
        ipm_id: fixture.ipmId,
        ipm_item_id: fixture.itemId,
        ipm_uc_unit_id: fixture.unitId,
        ipm_profit_type: fixture.profitType,
        ...overrides,
      },
      SaveItemPriceDto,
    );

  it('1. the item card: an update logs one row, the same save again logs none', async () => {
    const newPrice = Math.round((fixture.priceA - 0.5) * 100) / 100;
    await prices.save(await itemCard({ ipm_sales_price_a: newPrice }));
    await prices.save(await itemCard({ ipm_sales_price_a: newPrice }));

    const rows = await log();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'UPDATE',
      source: 'ITEM_CARD',
      table: 'IPM',
      row_id: fixture.ipmId,
      user_id: fixture.userId,
      app: 'API',
    });
    // The price, and the level figures the card re-derives from it (fillLevelFigures).
    expect(rows[0].changed).toContain('ipm_sales_price_a');
    expect(rows[0].changed.every((column) => /^ipm_(sales_price|price)_a/.test(column))).toBe(true);
  });

  it('2. Change Selling Price from a bill line: a new branch row, CREATE, "via" the bill', async () => {
    const saved = await menu30.saveBulk({
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      scope: 'BRANCH',
      rows: [
        {
          itemId: fixture.itemId,
          uomId: fixture.unitId,
          priceScope: 'CHAIN',
          levels: [{ level: 1, price: Math.round((fixture.priceA - 1) * 100) / 100 }],
        },
      ],
      // Saved from the quick rate popup on a bill line (plan 2026-10-23 §3.3).
      originMenuId: 12,
    } as unknown as SaveSellingPriceBulkDto);

    expect(saved.saved).toBe(1);
    const rows = await log();
    expect(rows.slice(1)).toEqual([
      expect.objectContaining({
        action: 'CREATE',
        source: 'CHANGE_SELLING_PRICE',
        table: 'IPM',
        reason: 'via Sales Entry (menu 12)',
      }),
    ]);
  });

  it('3. qty slabs: create, update, delete, restore — one row each', async () => {
    const base = {
      iqp_item_id: fixture.itemId,
      iqp_item_unit_id: fixture.unitId,
      iqp_effective_from: '2099-01-01',
      iqp_effective_to: '2099-01-31',
      iqp_from_qty: 1,
      iqp_to_qty: 10,
      iqp_disc_pct: 5,
    };
    const created = await slabs.save(await dto(base, SaveItemQtyPriceDto));
    await slabs.save(
      await dto({ ...base, iqp_id: created.iqp_id, iqp_disc_pct: 6 }, SaveItemQtyPriceDto),
    );
    await slabs.softDelete(created.iqp_id);
    await slabs.restore(created.iqp_id);

    const slabRows = (await log()).filter((row) => row.table === 'IQP');
    expect(slabRows.map((row) => row.action)).toEqual(['CREATE', 'UPDATE', 'DELETE', 'RESTORE']);
    expect(slabRows.every((row) => row.source === 'QTY_PRICE')).toBe(true);
    expect(slabRows[1].changed).toEqual(['iqp_disc_pct']);
  });

  it('4. a write round the writer is a gap; the re-key that heals it is logged as REKEY', async () => {
    // A bypass on purpose — the one thing the guard test forbids in src/.
    await tx.$executeRaw`
      UPDATE inventory.item_price_master SET ipm_bucket_mrp = ipm_max_price
       WHERE ipm_id = ${fixture.ipmId}::uuid`;
    const gaps = await report.gaps({});
    expect(gaps.sample).toEqual(
      expect.arrayContaining([
        { priceTable: 'IPM', rowId: fixture.ipmId, itemId: fixture.itemId, reason: 'DIFFERS' },
      ]),
    );

    await buckets.rekeyItem(db, fixture.itemId);

    const rekey = (await log()).filter((row) => row.action === 'REKEY');
    expect(rekey).toEqual([
      expect.objectContaining({
        source: 'BUCKET_REKEY',
        row_id: fixture.ipmId,
        changed: ['ipm_bucket_mrp'],
      }),
    ]);
    const after = await report.gaps({});
    expect(after.sample.filter((gap) => gap.rowId === fixture.ipmId)).toEqual([]);
    expect(after.total).toBe(0);
  });

  it('5. the item card delete and restore', async () => {
    await prices.toggleDelete(fixture.ipmId);
    await prices.toggleDelete(fixture.ipmId);

    const card = (await log()).filter(
      (row) => row.source === 'ITEM_CARD' && row.row_id === fixture.ipmId,
    );
    expect(card.map((row) => row.action)).toEqual(['UPDATE', 'DELETE', 'RESTORE']);
  });

  it('6. the report reads what was written', async () => {
    const today = (await tx.$queryRaw<Array<{ d: string }>>`SELECT CURRENT_DATE::text AS d`)[0].d;
    const range = { companyId: fixture.companyId, fromDate: today, toDate: today };

    const list = await report.list({ ...range, itemId: fixture.itemId, limit: 100 });
    const all = await log();
    expect(list.meta.total).toBe(all.length);
    expect(list.items[0]).toMatchObject({ itemId: fixture.itemId, userId: fixture.userId });

    const slabsOnly = await report.list({ ...range, itemId: fixture.itemId, priceTable: 'IQP' });
    expect(slabsOnly.meta.total).toBe(4);

    const [day] = await report.days({ ...range, itemId: fixture.itemId });
    expect(day).toMatchObject({
      day: today,
      changes: all.length,
      slabChanges: 4,
      items: 1,
      users: 1,
    });

    const history = await report.itemHistory({ itemId: fixture.itemId });
    expect(history).toHaveLength(all.length);

    const first = history.at(-1)!;
    const detail = await report.get({ ipclId: first.ipclId });
    expect(detail.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'ipm_sales_price_a', label: 'Price A' }),
        expect.objectContaining({ column: 'ipm_price_a_wot', label: 'Price A (w/o tax)' }),
      ]),
    );
    expect(detail.fields.map((field) => field.column)).toEqual(first.changed);

    // Notes 145 — every list row carries the same before → after pairs as the detail.
    for (const row of list.items) {
      expect(row.fields).toEqual((await report.get({ ipclId: row.ipclId })).fields);
    }
    const card = list.items.find((row) => row.ipclId === first.ipclId)!;
    // Price A first, its companions after it (notes 145's order).
    expect(card.fields[0]).toMatchObject({
      column: 'ipm_sales_price_a',
      before: fixture.priceA,
      after: Math.round((fixture.priceA - 0.5) * 100) / 100,
    });
    const priceA = await report.list({
      ...range,
      itemId: fixture.itemId,
      field: 'ipm_sales_price_a',
    });
    expect(priceA.items.map((row) => row.ipclId)).toContain(first.ipclId);
    expect(priceA.items.every((row) => row.changed.includes('ipm_sales_price_a'))).toBe(true);
    // One transaction here, so one change set — a real save is one per request.
    expect(all[0].sets).toBe(1);
  });
});
