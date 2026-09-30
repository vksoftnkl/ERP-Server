import { Prisma, PrismaClient } from '@prisma/client';
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
import { effectivePolicyLateral } from '../src/modules/stocks/stock-voucher/stock-voucher-posting.helper';
import { OpeningStockLookupService } from '../src/modules/stocks/opening-stock-voucher/opening-stock-lookup.service';
import { PriceBucketGateway } from '../src/modules/stocks/selling-price-bulk/price-bucket.gateway';
import type { SaveItemCompositeDto } from '../src/modules/Inventory/items-master/dto/save-item-composite.dto';

/**
 * NOTES 67 (re-check of notes 50), 68 and 69 AGAINST THE REAL DATABASE, in one
 * rolled-back transaction like `stock-adjustment.e2e-spec.ts`: what the unit
 * mocks cannot prove — the partial unique indexes, the price table's own
 * unique scope, Prisma's real error metadata, the tax_rate_master join and
 * the timestamp rule that decides which children a restore brings back.
 *
 *     npm run test:e2e -- items-master-notes-67
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
  companyId: string;
  branchX: string;
  branchY: string;
  groupId: string;
  unitA: string;
  unitB: string;
  taxId: string;
  taxName: string;
  userId: string;
}

describe('Item master, notes 67 / 68 / 69 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: ItemsMasterService;
  let policy: StockTrackPolicyService;
  let fixture: Fixture;
  let spSeq = 0;
  const stamp = Date.now().toString(36);

  beforeAll(async () => {
    await new Promise<void>((resolveReady, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            resolveReady();
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
      // A GROUP policy is filed under the request's company.
      getCompanyId: () => fixture.companyId,
    } as unknown as RequestContextService;
    const audit = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;
    const db = transactional(tx);
    const grid = {} as never;
    const iuc = new ItemUnitConversionService(db, audit, grid, ctx);
    // No setting overrides: sales.default_price_level reads its catalog default.
    const buckets = new PriceBucketService({
      resolveEffective: () => Promise.resolve([]),
    } as never);
    const price = new ItemsPriceMasterService(db, audit, grid, ctx, buckets);
    const ean = new ItemsEanCodeMasterService(db, audit, grid, ctx);
    const reorder = new ItemsReorderMasterService(db, audit, grid, ctx);
    policy = new StockTrackPolicyService(db, audit, ctx);
    service = new ItemsMasterService(
      db,
      audit,
      ctx,
      iuc,
      price,
      ean,
      reorder,
      new ItemMasterUpdateService(iuc, price, ean, reorder, buckets),
      policy,
      buckets,
    );
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    const [scope] = await tx.$queryRaw<Array<{ comp: string; branches: string[] }>>`
      SELECT br_comp_id AS comp, array_agg(br_id ORDER BY br_id) AS branches
        FROM public.branch_master WHERE br_is_deleted = false
       GROUP BY br_comp_id HAVING count(*) >= 2 LIMIT 1
    `;
    if (!scope) throw new Error('No company with two branches on this database.');
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master ORDER BY itg_id LIMIT 1`;
    const units = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master WHERE unit_is_deleted = false ORDER BY unit_name LIMIT 2`;
    const [tax] = await tx.$queryRaw<Array<{ tax_id: string; tax_name: string }>>`
      SELECT tax_id, tax_name FROM inventory.tax_rate_master
       WHERE tax_is_deleted = false AND tax_rate_perc > 0 ORDER BY tax_sort_order, tax_name LIMIT 1`;
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    return {
      companyId: scope.comp,
      branchX: scope.branches[0],
      branchY: scope.branches[1],
      groupId: group.itg_id,
      unitA: units[0].unit_id,
      unitB: units[1].unit_id,
      taxId: tax.tax_id,
      taxName: tax.tax_name,
      userId: user.usr_id,
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
  const refusal = (e: unknown) => ({
    status: (e as { status?: number }).status,
    body: JSON.stringify((e as { response?: unknown }).response ?? String(e)),
  });
  /** Children stamped by different saves must not share a millisecond. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  const base = (name: string): SaveItemCompositeDto => ({
    item_company_id: fixture.companyId,
    item_name_en: `${name} ${stamp}`,
    item_group_id: fixture.groupId,
    item_base_unit_id: fixture.unitA,
    item_default_tax_id: fixture.taxId,
    unit_conversions: [
      {
        iuc_unit_id: fixture.unitA,
        iuc_is_base_unit: true,
        iuc_is_default_unit: true,
        iuc_to_base_factor: 1,
      },
    ],
  });
  const priceRow = (branchId: string, extra: Record<string, unknown> = {}) => ({
    ipm_company_id: fixture.companyId,
    ipm_branch_id: branchId,
    ipm_uc_unit_id: fixture.unitA,
    ipm_profit_type: 'By %',
    ...extra,
  });

  let itemId: string;

  it("B1. a NEW branch's price with branch X's unit and godown is a new row; X's price is untouched", async () => {
    const created = await attempt(() =>
      service.saveComposite({
        ...base('N67 Soap'),
        prices: [priceRow(fixture.branchX, { ipm_sales_price_a: 10 })],
      }),
    );
    itemId = created.item.item_id;
    const x = created.prices[0];

    const saved = await attempt(() =>
      service.saveComposite({
        ...base('N67 Soap'),
        item_id: itemId,
        prices: [
          { ...x, ipm_uc_unit_id: fixture.unitA },
          priceRow(fixture.branchY, { ipm_sales_price_a: 12 }),
        ],
      }),
    );

    const byBranch = new Map(saved.prices.map((p) => [p.ipm_branch_id, p]));
    expect(saved.prices).toHaveLength(2);
    expect(byBranch.get(fixture.branchX)).toMatchObject({
      ipm_id: x.ipm_id,
      ipm_sales_price_a: 10,
    });
    expect(byBranch.get(fixture.branchY)?.ipm_id).not.toBe(x.ipm_id);
    expect(byBranch.get(fixture.branchY)?.ipm_sales_price_a).toBe(12);
    // Notes 50 #2: no actor in the payload → the request's user, not NULL.
    expect(byBranch.get(fixture.branchY)?.ipm_created_by).toBe(fixture.userId);
    expect(saved.unit_conversions[0].iuc_created_by).toBe(fixture.userId);
  });

  it('1. an update that omits company, base unit and packing list keeps them', async () => {
    const saved = await attempt(() =>
      service.saveComposite({
        item_id: itemId,
        item_name_en: `N67 Soap ${stamp}`,
        item_group_id: fixture.groupId,
      }),
    );
    expect(saved.item).toMatchObject({
      item_company_id: fixture.companyId,
      item_base_unit_id: fixture.unitA,
    });
  });

  it('B2. GET names the tax from tax_rate_master', async () => {
    const got = await service.getComposite(itemId);
    expect(got.item.item_default_tax_name).toBe(fixture.taxName);
  });

  it('4. a bad item_default_tax_id is reported against item_default_tax_id', async () => {
    const bad = await attempt(() =>
      service.saveComposite({
        ...base('N67 Bad tax'),
        item_default_tax_id: '019c6f6c-be87-7a11-8905-36092c46fe99',
      }),
    ).then(() => null, refusal);
    expect(bad?.status).toBe(400);
    expect(bad?.body).toContain('"field":"item_default_tax_id"');
  });

  it('8. an item with no preset gets no ITEM policy row', async () => {
    const rows = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM stock.stock_track_policy
       WHERE stp_scope = 'ITEM' AND stp_item_id = ${itemId}::uuid AND stp_is_deleted = false`;
    expect(Number(rows[0].n)).toBe(0);
  });

  it('5 / B4. delete is not a toggle; restore brings back only the children deleted with the item', async () => {
    // A second unit, an EAN, then a save that REMOVES the EAN and the second
    // unit on purpose — the old toggle-restore brought those back.
    const withEan = await attempt(() =>
      service.saveComposite({
        ...base('N67 Soap'),
        item_id: itemId,
        unit_conversions: [
          {
            iuc_unit_id: fixture.unitA,
            iuc_is_base_unit: true,
            iuc_is_default_unit: true,
            iuc_to_base_factor: 1,
          },
          { iuc_unit_id: fixture.unitB, iuc_base_unit_id: fixture.unitA, iuc_to_base_factor: 12 },
        ],
        ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `N67${stamp}OLD` }],
      }),
    );
    expect(withEan.ean_codes).toHaveLength(1);
    await tick();
    await attempt(() =>
      service.saveComposite({
        ...base('N67 Soap'),
        item_id: itemId,
        ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `N67${stamp}NEW` }],
      }),
    );
    await tick();

    const deleted = await attempt(() => service.softDeleteComposite(itemId));
    expect(deleted.item.deleted).toBe(true);
    const again = await attempt(() => service.softDeleteComposite(itemId)).then(
      () => null,
      refusal,
    );
    expect(again?.status).toBe(409);

    await tick();
    const restored = await attempt(() => service.restoreComposite(itemId));
    expect(restored.item.deleted).toBe(false);
    const got = await service.getComposite(itemId);
    expect(got.ean_codes.map((e) => e.ean_code)).toEqual([`N67${stamp}NEW`]);
    expect(got.unit_conversions.map((u) => u.iuc_unit_id)).toEqual([fixture.unitA]);
    expect(got.prices).toHaveLength(2);
    const notDeletedAgain = await attempt(() => service.restoreComposite(itemId)).then(
      () => null,
      refusal,
    );
    expect(notDeletedAgain?.status).toBe(409);
  });

  it("3. a deleted item's name and EAN are free again; restoring it over them is a 409 naming the name", async () => {
    await attempt(() => service.softDeleteComposite(itemId));
    const reuse = await attempt(() =>
      service.saveComposite({
        ...base('N67 Soap'),
        ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `N67${stamp}NEW` }],
      }),
    );
    expect(reuse.item.item_id).not.toBe(itemId);
    expect(reuse.ean_codes[0].ean_code).toBe(`N67${stamp}NEW`);

    const clash = await attempt(() => service.restoreComposite(itemId)).then(() => null, refusal);
    expect(clash?.status).toBe(409);
    expect(clash?.body).toContain('"field":"item_name_en"');
    const [row] = await tx.$queryRaw<Array<{ item_is_deleted: boolean }>>`
      SELECT item_is_deleted FROM inventory.item_master WHERE item_id = ${itemId}::uuid`;
    expect(row.item_is_deleted).toBe(true);
  });

  it('3. restoring an item whose EAN another live item has taken since is a 409 naming ean_codes', async () => {
    const other = await attempt(() =>
      service.saveComposite({
        ...base('N67 Brush'),
        ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `N67${stamp}BRUSH` }],
      }),
    );
    await tick();
    await attempt(() => service.softDeleteComposite(other.item.item_id));
    await attempt(() =>
      service.saveComposite({
        ...base('N67 Comb'),
        ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `N67${stamp}BRUSH` }],
      }),
    );

    const clash = await attempt(() => service.restoreComposite(other.item.item_id)).then(
      () => null,
      refusal,
    );
    expect(clash?.status).toBe(409);
    expect(clash?.body).toContain('"field":"ean_codes"');
  });

  it('B3. no price row holds a legacy profit type', async () => {
    const rows = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM inventory.item_price_master
       WHERE ipm_profit_type IN ('BY_PERCENT', 'BY_AMOUNT')`;
    expect(Number(rows[0].n)).toBe(0);
  });
  // ── notes 68: an item follows its group unless it names its own preset ────

  /** What the posting engine resolves for the item: ITEM → GROUP → COMPANY. */
  const resolvedSignature = async (id: string): Promise<string | null> => {
    const [row] = await tx.$queryRaw<Array<{ sig: string | null }>>`
      SELECT stp.stp_track_signature AS sig
        FROM inventory.item_master itm
        ${effectivePolicyLateral({
          companyId: Prisma.sql`${fixture.companyId}::uuid`,
          branchId: Prisma.sql`${fixture.branchX}::uuid`,
          itemId: Prisma.raw('itm.item_id'),
          itemGroupId: Prisma.raw('itm.item_group_id'),
          onDate: Prisma.sql`CURRENT_DATE`,
        })}
       WHERE itm.item_id = ${id}::uuid`;
    return row?.sig ?? null;
  };

  it("68. an item with no preset resolves to its group's preset, whatever its own flags say; its own preset (NONE too) wins", async () => {
    const [be] = await tx.$queryRaw<Array<{ spt_id: string }>>`
      SELECT spt_id FROM stock.stock_track_preset WHERE spt_track_signature = 'BE' AND spt_is_deleted = false LIMIT 1`;
    const [none] = await tx.$queryRaw<Array<{ spt_id: string }>>`
      SELECT spt_id FROM stock.stock_track_preset WHERE spt_code = 'NONE' AND spt_is_deleted = false LIMIT 1`;
    await attempt(() =>
      policy.syncFromItemGroup({ itgId: fixture.groupId, itgTrackPresetId: be.spt_id }, tx),
    );

    // Batch-based and negative stock off: flags that used to derive an ITEM
    // row ('B', BLOCK) and hide the group's BE.
    const flagged = await attempt(() =>
      service.saveComposite({
        ...base('N68 Paneer'),
        item_is_batch_based: true,
        item_allow_neg_stock: false,
      }),
    );
    const id = flagged.item.item_id;
    expect(await resolvedSignature(id)).toBe('BE');

    await attempt(() =>
      service.saveComposite({
        ...base('N68 Paneer'),
        item_id: id,
        item_track_preset_id: none.spt_id,
      }),
    );
    expect(await resolvedSignature(id)).toBe('N');

    await attempt(() =>
      service.saveComposite({
        ...base('N68 Paneer'),
        item_id: id,
        item_track_preset_id: null,
      }),
    );
    expect(await resolvedSignature(id)).toBe('BE');
    const live = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM stock.stock_track_policy
       WHERE stp_scope = 'ITEM' AND stp_item_id = ${id}::uuid AND stp_is_deleted = false`;
    expect(Number(live[0].n)).toBe(0);
  });
  // ── notes 69: a group's policy is shared, not filed at the login company ──

  it("69. a group saved under ANOTHER login company still gives the item's company its preset in /stock/opening/item-lookup", async () => {
    const [other] = await tx.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE comp_id <> ${fixture.companyId}::uuid LIMIT 1`;
    expect(other).toBeDefined();
    const [be] = await tx.$queryRaw<Array<{ spt_id: string }>>`
      SELECT spt_id FROM stock.stock_track_preset WHERE spt_track_signature = 'BE' AND spt_is_deleted = false LIMIT 1`;
    // The token's company is NOT the item's: VKPOS logs in as one company and
    // works in another.
    const loginOtherCompany = new StockTrackPolicyService(
      transactional(tx),
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      {
        getUserId: () => fixture.userId,
        getCompanyId: () => other.comp_id,
      } as unknown as RequestContextService,
    );
    const grp = await tx.itemGroupMaster.create({
      data: { itgName: `ZT-N69-GROUP ${stamp}`, itgTrackPresetId: be.spt_id },
      select: { itgId: true, itgTrackPresetId: true },
    });
    const synced = await attempt(() => loginOtherCompany.syncFromItemGroup(grp, tx));
    const [row] = await tx.$queryRaw<Array<{ company: string | null }>>`
      SELECT stp_company_id AS company FROM stock.stock_track_policy WHERE stp_id = ${synced.stp_id}::uuid`;
    expect(row.company).toBeNull();

    const item = await attempt(() =>
      service.saveComposite({
        ...base('N69 Ghee'),
        item_group_id: grp.itgId,
      }),
    );
    const lookup = new OpeningStockLookupService(
      transactional(tx),
      new PriceBucketGateway(transactional(tx)),
    );
    const found = await lookup.lookupItem({
      companyId: fixture.companyId,
      branchId: fixture.branchX,
      itemId: item.item.item_id,
      onDate: new Date().toISOString().slice(0, 10),
    });
    expect(found.trackSignature).toBe('BE');
  });
});
