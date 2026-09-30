import { Prisma, PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { ConfiguredGridSqlService } from '../src/common/configured-grid-sql/configured-grid-sql.service';
import { ItemsGroupMasterService } from '../src/modules/Inventory/items-group-master/items-group-master.service';
import { ItemsBrandMasterService } from '../src/modules/Inventory/items-brand-master/items-brand-master.service';
import { ItemsSectionMasterService } from '../src/modules/Inventory/items-section-master/items-section-master.service';
import { ItemsCategoryMasterService } from '../src/modules/Inventory/items-category-master/items-category-master.service';
import { GodownsMasterService } from '../src/modules/Inventory/godowns-master/godowns-master.service';
import { SaveGodownDto } from '../src/modules/Inventory/godowns-master/dto/save-godown.dto';
import { UnitsMasterService } from '../src/modules/Inventory/units-master/units-master.service';
import { ItemsQtyPriceMasterService } from '../src/modules/Inventory/items-qty-price-master/items-qty-price-master.service';
import { TaxRateMasterService } from '../src/modules/Inventory/tax-rate-master/tax-rate-master.service';
import { StockTrackPolicyService } from '../src/modules/stocks/stock-track-policy/stock-track-policy.service';

/**
 * NOTES 70 — the item-related masters — against the real database, in one
 * rolled-back transaction like `items-master-notes-67.e2e-spec.ts`: the grid
 * SQL the migration repaired, the hierarchy rules (levels, loops, children),
 * DELETE vs RESTORE, the reference guards, the omitted-key merges, and the two
 * new unique rules.
 *
 *     npm run test:e2e -- item-masters-notes-70
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
  branchId: string;
  userId: string;
  unitId: string;
  groupId: string;
}

describe('Item masters, notes 70 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let fixture: Fixture;
  let groups: ItemsGroupMasterService;
  let brands: ItemsBrandMasterService;
  let sections: ItemsSectionMasterService;
  let categories: ItemsCategoryMasterService;
  let godowns: GodownsMasterService;
  let units: UnitsMasterService;
  let qtyPrices: ItemsQtyPriceMasterService;
  let taxes: TaxRateMasterService;
  let spSeq = 0;
  const stamp = Date.now().toString(36);
  const name = (what: string) => `ZT70-${what}-${stamp}`;

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
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    // The REAL audit service, so a delete/restore whose audit call is malformed
    // fails here and not first on the live box (notes 71 B1's lesson).
    const audit = new AuditLogService(db, ctx);
    groups = new ItemsGroupMasterService(
      db,
      audit,
      ctx,
      new StockTrackPolicyService(db, audit, ctx),
    );
    brands = new ItemsBrandMasterService(db, audit, ctx);
    sections = new ItemsSectionMasterService(db, audit, ctx);
    categories = new ItemsCategoryMasterService(db, audit, ctx);
    godowns = new GodownsMasterService(db, audit, ctx);
    units = new UnitsMasterService(db, audit, ctx);
    qtyPrices = new ItemsQtyPriceMasterService(db, audit, {} as never, ctx);
    taxes = new TaxRateMasterService(db, audit, ctx);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    const [scope] = await tx.$queryRaw<Array<{ comp: string; br: string }>>`
      SELECT br_comp_id AS comp, br_id AS br FROM public.branch_master
       WHERE br_is_deleted = false ORDER BY br_id LIMIT 1`;
    const [unit] = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master WHERE unit_is_deleted = false
       ORDER BY unit_name LIMIT 1`;
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master WHERE itg_is_deleted = false
       ORDER BY itg_id LIMIT 1`;
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    return {
      companyId: scope.comp,
      branchId: scope.br,
      userId: user.usr_id,
      unitId: unit.unit_id,
      groupId: group.itg_id,
    };
  }

  /** Runs `fn` inside a SAVEPOINT and rolls back to it on failure, then rethrows. */
  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw error;
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
  const groupLevel = async (id: string) =>
    (await tx.itemGroupMaster.findUniqueOrThrow({ where: { itgId: id } })).itgLevel;

  // ── A — the three list grids run and filter on the deleted flag ──────────
  it('A1-A3. grids 45, 50 and 67 bind their is_deleted token and filter by it', async () => {
    const grid = new ConfiguredGridSqlService(null as never, null as never);
    const cases: Array<[number, string, string]> = [
      [
        45,
        'iunit_is_deleted',
        'SELECT count(*) AS n FROM inventory.item_unit_master WHERE unit_is_deleted = $1',
      ],
      [
        50,
        'isec_is_deleted',
        'SELECT count(*) AS n FROM inventory.item_section_master WHERE sec_is_deleted = $1',
      ],
      [
        67,
        'iitem_is_deleted',
        'SELECT count(*) AS n FROM inventory.item_master WHERE item_is_deleted = $1',
      ],
    ];
    for (const [gridId, token, truth] of cases) {
      const [row] = await tx.$queryRaw<Array<{ grid_sql: string }>>`
        SELECT grid_sql FROM fixed.grid_details WHERE grid_id = ${gridId}`;
      for (const flag of [false, true]) {
        const bound = grid.bindGridParams(row.grid_sql, { [token]: flag });
        const rows = await tx.$queryRawUnsafe<unknown[]>(bound.sql, ...bound.params);
        const [expected] = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(truth, flag);
        expect({ gridId, flag, n: rows.length }).toEqual({ gridId, flag, n: Number(expected.n) });
      }
    }
  });

  // ── B — the hierarchy ─────────────────────────────────────────────────────
  it('B1/B2. levels are depths, and re-parenting re-levels the whole subtree', async () => {
    const root = await attempt(() => groups.save({ itg_name: name('root'), itg_level: 99 }));
    const mid = await attempt(() =>
      groups.save({ itg_name: name('mid'), itg_parent_id: root.itg_id }),
    );
    const leaf = await attempt(() =>
      groups.save({ itg_name: name('leaf'), itg_parent_id: mid.itg_id }),
    );
    expect([root.itg_level, mid.itg_level, leaf.itg_level]).toEqual([1, 2, 3]);

    await attempt(() =>
      groups.save({ itg_id: mid.itg_id, itg_name: name('mid'), itg_parent_id: null }),
    );
    expect(await groupLevel(mid.itg_id)).toBe(1);
    expect(await groupLevel(leaf.itg_id)).toBe(2);

    // An update that OMITS the parent keeps it — and keeps the caches.
    await attempt(() => groups.save({ itg_id: leaf.itg_id, itg_name: name('leaf2') }));
    const leafRow = await tx.itemGroupMaster.findUniqueOrThrow({ where: { itgId: leaf.itg_id } });
    expect(leafRow.itgParentId).toBe(mid.itg_id);
    const midRow = await tx.itemGroupMaster.findUniqueOrThrow({ where: { itgId: mid.itg_id } });
    expect(midRow.itgPathIdsCache).toEqual(expect.arrayContaining([mid.itg_id, leaf.itg_id]));
  });

  it('B3. a node cannot move under its own descendant, on any tree master', async () => {
    const a = await attempt(() => sections.save({ sec_name: name('secA') }));
    const b = await attempt(() =>
      sections.save({ sec_name: name('secB'), sec_parent_id: a.sec_id }),
    );
    const loop = await refusal(
      attempt(() =>
        sections.save({
          sec_id: a.sec_id,
          sec_name: name('secA'),
          sec_parent_id: b.sec_id,
        }),
      ),
    );
    expect(loop.status).toBe(400);
    expect(loop.body).toContain('own descendants');
    // Nothing moved, and both rows still carry their own id in the path cache.
    const [aRow, bRow] = await Promise.all([
      tx.itemSectionMaster.findUniqueOrThrow({ where: { secId: a.sec_id } }),
      tx.itemSectionMaster.findUniqueOrThrow({ where: { secId: b.sec_id } }),
    ]);
    expect(aRow.secParentId).toBeNull();
    expect(aRow.secPathIds).toContain(a.sec_id);
    expect(bRow.secPathIds).toContain(b.sec_id);
  });

  it('B4. a parent with live children, or a group live items use, is not deleted', async () => {
    const parent = await attempt(() => categories.save({ category_name: name('catP') }));
    await attempt(() =>
      categories.save({
        category_name: name('catC'),
        category_parent_id: parent.category_id,
      }),
    );
    const children = await refusal(attempt(() => categories.softDelete(parent.category_id)));
    expect(children.status).toBe(409);
    expect(children.body).toContain(name('catC'));

    const used = await refusal(attempt(() => groups.softDelete(fixture.groupId)));
    expect(used.status).toBe(409);
    expect(used.body).toMatch(/Used by \d+ items|live children/);
  });

  it('B5. a godown update that omits gdl_parent_id or gdl_name keeps them', async () => {
    const top = await attempt(() =>
      godowns.save({
        gdl_branch_id: fixture.branchId,
        gdl_name: name('WH'),
        gdl_type: 'WAREHOUSE',
      }),
    );
    const rack = await attempt(() =>
      godowns.save({
        gdl_branch_id: fixture.branchId,
        gdl_name: name('RACK'),
        gdl_type: 'RACK',
        gdl_parent_id: top.gdl_id,
      }),
    );
    expect([top.gdl_level, rack.gdl_level]).toEqual([1, 2]);

    // Through the real DTO transform, exactly as the controller builds it.
    const dto = plainToInstance(SaveGodownDto, { gdl_id: rack.gdl_id, gdl_sort: 7 });
    const saved = await attempt(() => godowns.save(dto));
    expect(saved).toMatchObject({ gdl_parent_id: top.gdl_id, gdl_name: name('RACK'), gdl_sort: 7 });

    // An explicit "" still makes it a root.
    const rooted = await attempt(() =>
      godowns.save(plainToInstance(SaveGodownDto, { gdl_id: rack.gdl_id, gdl_parent_id: '' })),
    );
    expect(rooted).toMatchObject({ gdl_parent_id: null, gdl_level: 1 });
  });

  it('B6. gdl_type outside the six kinds is refused by the DTO and by the database', async () => {
    const errors = await validate(
      plainToInstance(SaveGodownDto, {
        gdl_branch_id: fixture.branchId,
        gdl_name: 'x',
        gdl_type: 'BOGUS',
      }),
    );
    expect(errors.map((error) => error.property)).toContain('gdl_type');
    const db = await refusal(
      attempt(
        () =>
          tx.$executeRaw`UPDATE inventory.godown_locations SET gdl_type = 'BOGUS'
                        WHERE gdl_id = (SELECT gdl_id FROM inventory.godown_locations LIMIT 1)`,
      ),
    );
    expect(db.body).toContain('ck_gdl_type');
  });

  // ── C — delete is not a toggle; the guards ───────────────────────────────
  it('C1. DELETE twice is a 409, RESTORE brings it back, RESTORE twice is a 409', async () => {
    const brand = await attempt(() => brands.save({ brand_name: name('brand') }));
    await expect(attempt(() => brands.softDelete(brand.brand_id))).resolves.toMatchObject({
      deleted: true,
    });
    expect((await refusal(attempt(() => brands.softDelete(brand.brand_id)))).status).toBe(409);
    await expect(attempt(() => brands.restore(brand.brand_id))).resolves.toMatchObject({
      deleted: false,
    });
    expect((await refusal(attempt(() => brands.restore(brand.brand_id)))).status).toBe(409);
  });

  it('C1. restore puts the subtree back into the ancestors’ path caches; an orphan restore is refused', async () => {
    const parent = await attempt(() => brands.save({ brand_name: name('bP') }));
    const child = await attempt(() =>
      brands.save({ brand_name: name('bC'), brand_parent_id: parent.brand_id }),
    );
    const cache = async (id: string) =>
      (await tx.itemBrandMaster.findUniqueOrThrow({ where: { brand_id: id } })).brand_path_ids;
    expect(await cache(parent.brand_id)).toContain(child.brand_id);
    await attempt(() => brands.softDelete(child.brand_id));
    expect(await cache(parent.brand_id)).not.toContain(child.brand_id);
    await attempt(() => brands.restore(child.brand_id));
    expect(await cache(parent.brand_id)).toContain(child.brand_id);

    await attempt(() => brands.softDelete(child.brand_id));
    await attempt(() => brands.softDelete(parent.brand_id));
    const orphan = await refusal(attempt(() => brands.restore(child.brand_id)));
    expect(orphan.status).toBe(409);
    expect(orphan.body).toContain('parent');
  });

  it('C2. a unit a pack unit is built on is not deleted; unit_code fills unit_uqc (D1)', async () => {
    const base = await attempt(() => units.save({ unit_name: name('BASE'), unit_code: 'PCS' }));
    const baseRow = await tx.unit.findUniqueOrThrow({ where: { unit_id: base.unit_id } });
    expect(baseRow.unitUqc).toBe('PCS');
    await attempt(() =>
      units.save({
        unit_name: name('PACK'),
        unit_is_pack_unit: true,
        unit_base_unit_id: base.unit_id,
        unit_conversion: 10,
      }),
    );
    const used = await refusal(attempt(() => units.softDelete(base.unit_id)));
    expect(used.status).toBe(409);
    expect(used.body).toContain('pack units built on it');
  });

  it('C3. a tax rate a live item defaults to is not deleted', async () => {
    const [rate] = await tx.$queryRaw<Array<{ tax_id: string }>>`
      SELECT i.item_default_tax_id AS tax_id FROM inventory.item_master i
        JOIN inventory.tax_rate_master t ON t.tax_id = i.item_default_tax_id AND t.tax_is_deleted = false
       WHERE i.item_is_deleted = false LIMIT 1`;
    if (!rate) return;
    const used = await refusal(attempt(() => taxes.softDelete(rate.tax_id)));
    expect(used.status).toBe(409);
    expect(used.body).toContain('items (as their default tax)');
  });

  // ── D — contract gaps closed ─────────────────────────────────────────────
  it('D6. a live duplicate section name is a 409', async () => {
    await attempt(() => sections.save({ sec_name: name('dup') }));
    const dup = await refusal(attempt(() => sections.save({ sec_name: name('dup') })));
    expect(dup.status).toBe(409);
  });

  it('D7. re-posting one qty-price slab is a 409, not a second slab', async () => {
    const [iuc] = await tx.$queryRaw<Array<{ item: string; iuc: string }>>`
      SELECT iuc_item_id AS item, iuc_id AS iuc FROM inventory.item_unit_conversion
       WHERE iuc_is_deleted = false LIMIT 1`;
    const slab = {
      iqp_item_id: iuc.item,
      iqp_item_unit_id: iuc.iuc,
      iqp_from_qty: 7777,
      iqp_to_qty: 8888,
      iqp_price_mode: 'P',
      iqp_price: 1,
      iqp_effective_from: '2026-09-30',
    };
    await attempt(() => qtyPrices.save(slab as never));
    const again = await refusal(attempt(() => qtyPrices.save(slab as never)));
    expect(again.status).toBe(409);
  });

  it('D9. a tax-rate update may omit tax_name, and an omitted supersedes stays', async () => {
    const [rate] = await tx.$queryRaw<
      Array<{ tax_id: string; tax_name: string; tax_sort_order: number }>
    >`
      SELECT tax_id, tax_name, tax_sort_order FROM inventory.tax_rate_master
       WHERE tax_is_deleted = false ORDER BY tax_sort_order LIMIT 1`;
    const before = await tx.taxRateMaster.findUniqueOrThrow({ where: { taxId: rate.tax_id } });
    const saved = await attempt(() =>
      taxes.save({ tax_id: rate.tax_id, tax_sort_order: rate.tax_sort_order + 1 }),
    );
    expect(saved.tax_name).toBe(rate.tax_name);
    const after = await tx.taxRateMaster.findUniqueOrThrow({ where: { taxId: rate.tax_id } });
    expect(after.taxSupersedesId).toBe(before.taxSupersedesId);
    expect(after.taxSortOrder).toBe(rate.tax_sort_order + 1);
  });

  it('notes 71 B3. deleting a group retires its derived policy; restoring it derives it again', async () => {
    const [preset] = await tx.$queryRaw<Array<{ spt_id: string }>>`
      SELECT spt_id FROM stock.stock_track_preset
       WHERE spt_is_deleted = false AND spt_code = 'MRP_SELLING'`;
    const group = await attempt(() =>
      groups.save({ itg_name: name('policy'), itg_track_preset_id: preset.spt_id }),
    );
    const live = () =>
      tx.stockTrackPolicy.count({
        where: { stpScope: 'GROUP', stpGroupId: group.itg_id, stpIsDeleted: false },
      });
    expect(await live()).toBe(1);
    await attempt(() => groups.softDelete(group.itg_id));
    expect(await live()).toBe(0);
    await attempt(() => groups.restore(group.itg_id));
    expect(await live()).toBe(1);
  });
});
