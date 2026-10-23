import { Type } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { validateDto } from '../src/common/utils/request-payload-validation.util';
import { ItemsBrandMasterService } from '../src/modules/Inventory/items-brand-master/items-brand-master.service';
import { SaveItemBrandDto } from '../src/modules/Inventory/items-brand-master/dto/save-item-brand.dto';
import { ItemsGroupMasterService } from '../src/modules/Inventory/items-group-master/items-group-master.service';
import { SaveItemGroupDto } from '../src/modules/Inventory/items-group-master/dto/save-item-group.dto';
import { ItemsSectionMasterService } from '../src/modules/Inventory/items-section-master/items-section-master.service';
import { SaveItemSectionDto } from '../src/modules/Inventory/items-section-master/dto/save-item-section.dto';
import { ItemsCategoryMasterService } from '../src/modules/Inventory/items-category-master/items-category-master.service';
import { SaveItemCategoryDto } from '../src/modules/Inventory/items-category-master/dto/save-item-category.dto';
import {
  GodownsMasterService,
  MAIN_GODOWN_NAME,
} from '../src/modules/Inventory/godowns-master/godowns-master.service';
import { SaveGodownDto } from '../src/modules/Inventory/godowns-master/dto/save-godown.dto';
import { UnitsMasterService } from '../src/modules/Inventory/units-master/units-master.service';
import { SaveUnitDto } from '../src/modules/Inventory/units-master/dto/save-unit.dto';
import { ItemsQtyPriceMasterService } from '../src/modules/Inventory/items-qty-price-master/items-qty-price-master.service';
import { SaveItemQtyPriceDto } from '../src/modules/Inventory/items-qty-price-master/dto/save-item-qty-price.dto';
import { TaxRateMasterService } from '../src/modules/Inventory/tax-rate-master/tax-rate-master.service';
import { SaveTaxRateDto } from '../src/modules/Inventory/tax-rate-master/dto/save-tax-rate.dto';
import { StockTrackPolicyService } from '../src/modules/stocks/stock-track-policy/stock-track-policy.service';
import { priceWriterFor } from './helpers/price-writer';

/**
 * NOTES 139 (item masters, findings of the full live test, 2026-10-22) AGAINST
 * THE REAL DATABASE, in one rolled-back transaction like items-master-notes-137:
 * each body goes through the house pipe first, as the route does, then the
 * service, so a refusal shows the code the client would get.
 *
 *     npm run test:e2e -- item-masters-notes-139
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
  userId: string;
  branchA: string;
  branchB: string;
  unitId: string;
  gstUnitCode: string;
  /** Two items with no qty price slabs at all, each with a live unit row. */
  itemA: string;
  itemAUnit: string;
  itemB: string;
  itemBUnit: string;
}

describe('Item masters, notes 139 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let fixture: Fixture;
  let brands: ItemsBrandMasterService;
  let groups: ItemsGroupMasterService;
  let sections: ItemsSectionMasterService;
  let categories: ItemsCategoryMasterService;
  let godowns: GodownsMasterService;
  let units: UnitsMasterService;
  let slabs: ItemsQtyPriceMasterService;
  let taxRates: TaxRateMasterService;
  let spSeq = 0;
  const stamp = Date.now().toString(36);
  const nameOf = (label: string) => `ZT-139 ${label} ${stamp}`;

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
      getCompanyId: () => fixture.companyId,
    } as unknown as RequestContextService;
    // Notes 144 — the real price writer: every price write lands a log row too.
    const priceWriter = priceWriterFor(ctx);
    const audit = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;
    const db = transactional(tx);
    brands = new ItemsBrandMasterService(db, audit, ctx);
    groups = new ItemsGroupMasterService(
      db,
      audit,
      ctx,
      new StockTrackPolicyService(db, audit, ctx),
    );
    sections = new ItemsSectionMasterService(db, audit, ctx);
    categories = new ItemsCategoryMasterService(db, audit, ctx);
    godowns = new GodownsMasterService(db, audit, ctx);
    units = new UnitsMasterService(db, audit, ctx);
    slabs = new ItemsQtyPriceMasterService(db, audit, {} as never, ctx, priceWriter);
    taxRates = new TaxRateMasterService(db, audit, ctx);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    const [company] = await tx.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys ORDER BY comp_id LIMIT 1`;
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    const branches = await tx.$queryRaw<Array<{ br_id: string }>>`
      SELECT br_id FROM public.branch_master WHERE br_is_deleted = false ORDER BY br_id LIMIT 2`;
    const [unit] = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master
       WHERE unit_is_deleted = false AND unit_is_active = true ORDER BY unit_name LIMIT 1`;
    const [gstUnit] = await tx.$queryRaw<Array<{ code: string }>>`
      SELECT item_gst_unit_code AS code FROM inventory.item_gst_units
       WHERE item_gst_unit_code IS NOT NULL ORDER BY 1 LIMIT 1`;
    const items = await tx.$queryRaw<Array<{ item_id: string; iuc_id: string }>>`
      SELECT DISTINCT ON (iuc.iuc_item_id) iuc.iuc_item_id::text AS item_id, iuc.iuc_id::text AS iuc_id
        FROM inventory.item_unit_conversion iuc
       WHERE iuc.iuc_is_deleted = false
         AND NOT EXISTS (SELECT 1 FROM inventory.item_qty_price q
                          WHERE q.iqp_item_id = iuc.iuc_item_id)
       ORDER BY iuc.iuc_item_id, iuc.iuc_is_base_unit DESC, iuc.iuc_id
       LIMIT 2`;
    if (!company || !user || branches.length < 2 || !unit || !gstUnit || items.length < 2) {
      throw new Error(
        'Needs a company, a user, two live branches, a live unit, a GST unit code and two ' +
          'items with a live unit row and no qty price slabs.',
      );
    }
    return {
      companyId: company.comp_id,
      userId: user.usr_id,
      branchA: branches[0].br_id,
      branchB: branches[1].br_id,
      unitId: unit.unit_id,
      gstUnitCode: gstUnit.code,
      itemA: items[0].item_id,
      itemAUnit: items[0].iuc_id,
      itemB: items[1].item_id,
      itemBUnit: items[1].iuc_id,
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
  /** "<status> <code> @<field>" of the refusal's first error; a non-HTTP error fails the test. */
  async function refused(fn: () => Promise<unknown>): Promise<string> {
    const error = await attempt(fn).then(
      () => {
        throw new Error('expected a refusal, got a success');
      },
      (e: unknown) => e,
    );
    const status = (error as { status?: number }).status;
    if (status === undefined) throw error;
    const response = (error as { response?: { errors?: Array<{ code: string; field: string }> } })
      .response;
    const first = response?.errors?.[0];
    return first
      ? `${status} ${first.code} @${first.field}`
      : `${status} ${JSON.stringify(response)}`;
  }
  /** The body through the house pipe, as the route receives it. */
  async function dto<T extends object>(body: object, metatype: Type<T>): Promise<T> {
    const out = await validateDto(body, metatype);
    if (!out) throw new Error('validateDto answered no body');
    return out;
  }
  const brand = async (body: object) => brands.save(await dto(body, SaveItemBrandDto));
  const group = async (body: object) => groups.save(await dto(body, SaveItemGroupDto));
  const section = async (body: object) => sections.save(await dto(body, SaveItemSectionDto));
  const category = async (body: object) => categories.save(await dto(body, SaveItemCategoryDto));
  const godown = async (body: object) => godowns.save(await dto(body, SaveGodownDto));
  const unit = async (body: object) => units.save(await dto(body, SaveUnitDto));
  const slab = async (body: object) => slabs.save(await dto(body, SaveItemQtyPriceDto));
  const taxRate = async (body: object) => taxRates.save(await dto(body, SaveTaxRateDto));

  interface NamedMaster {
    label: string;
    code: string;
    create: (name: string) => Promise<string>;
    remove: (id: string) => Promise<unknown>;
    restore: (id: string) => Promise<unknown>;
    field: string;
  }
  /** The four name-only masters, driven the same way. */
  const NAMED: readonly NamedMaster[] = [
    {
      label: 'brand',
      code: 'ITEM_BRAND',
      create: (name: string) => attempt(() => brand({ brand_name: name })).then((r) => r.brand_id),
      remove: (id: string) => brands.softDelete(id),
      restore: (id: string) => brands.restore(id),
      field: 'brand_name',
    },
    {
      label: 'group',
      code: 'ITEM_GROUP',
      create: (name: string) => attempt(() => group({ itg_name: name })).then((r) => r.itg_id),
      remove: (id: string) => groups.softDelete(id),
      restore: (id: string) => groups.restore(id),
      field: 'itg_name',
    },
    {
      label: 'section',
      code: 'ITEM_SECTION',
      create: (name: string) => attempt(() => section({ sec_name: name })).then((r) => r.sec_id),
      remove: (id: string) => sections.softDelete(id),
      restore: (id: string) => sections.restore(id),
      field: 'sec_name',
    },
    {
      label: 'category',
      code: 'ITEM_CATEGORY',
      create: (name: string) =>
        attempt(() => category({ category_name: name })).then((r) => r.category_id),
      remove: (id: string) => categories.softDelete(id),
      restore: (id: string) => categories.restore(id),
      field: 'category_name',
    },
  ];

  it('A1. a blank name is refused on brand, group, section and category; a padded one is stored trimmed', async () => {
    for (const m of NAMED) {
      expect(await refused(() => m.create('   '))).toBe(`400 VALIDATION_IS_NOT_EMPTY @${m.field}`);
    }
    const saved = await attempt(() => brand({ brand_name: `  ${nameOf('A1')}  ` }));
    expect(saved.brand_name).toBe(nameOf('A1'));
  });

  it("A2. a deleted record's name is free again; restoring the deleted one then clashes", async () => {
    for (const m of NAMED) {
      const name = nameOf(`A2 ${m.label}`);
      const first = await m.create(name);
      await attempt(() => m.remove(first));
      const second = await m.create(name);
      expect(second).not.toBe(first);
      expect(await refused(() => m.restore(first))).toBe(`409 ${m.code}_NAME_TAKEN @${m.field}`);
    }
    const name = nameOf('A2 godown');
    const first = await attempt(() => godown({ gdl_branch_id: fixture.branchA, gdl_name: name }));
    await attempt(() => godowns.softDelete(first.gdl_id));
    await attempt(() => godown({ gdl_branch_id: fixture.branchA, gdl_name: name }));
    expect(await refused(() => godowns.restore(first.gdl_id))).toBe(
      '409 GODOWN_NAME_TAKEN @gdl_name',
    );

    const unitName = `ZT139U${stamp}`;
    const oldUnit = await attempt(() => unit({ unit_name: unitName }));
    await attempt(() => units.softDelete(oldUnit.unit_id));
    await attempt(() => unit({ unit_name: unitName.toLowerCase() }));
    expect(await refused(() => units.restore(oldUnit.unit_id))).toBe(
      '409 UNIT_NAME_TAKEN @unit_name',
    );
  });

  it('A3. an unknown track preset or GST unit code is a 400 naming the field, not a 500', async () => {
    expect(
      await refused(() => group({ itg_name: nameOf('A3'), itg_track_preset_id: randomUUID() })),
    ).toBe('400 ITEM_GROUP_TRACK_PRESET_NOT_FOUND @itg_track_preset_id');
    expect(await refused(() => unit({ unit_name: `ZT139A3${stamp}`, unit_code: 'ZZZ' }))).toBe(
      '400 UNIT_CODE_NOT_FOUND @unit_code',
    );
    const saved = await attempt(() =>
      unit({ unit_name: `ZT139A3${stamp}`, unit_code: fixture.gstUnitCode }),
    );
    expect(saved.unit_code).toBe(fixture.gstUnitCode);
  });

  it('A4. qty price: a unit of another item, an overlap, a mode with no figure and 150 % are refused', async () => {
    const base = {
      iqp_item_id: fixture.itemA,
      iqp_item_unit_id: fixture.itemAUnit,
      iqp_effective_from: '2099-01-01',
      iqp_effective_to: '2099-01-31',
      iqp_disc_pct: 5,
    };
    const first = await attempt(() => slab({ ...base, iqp_from_qty: 1, iqp_to_qty: 10 }));

    expect(
      await refused(() => slab({ ...base, iqp_item_unit_id: fixture.itemBUnit, iqp_from_qty: 50 })),
    ).toBe('400 ITEM_QTY_PRICE_UNIT_NOT_OF_ITEM @iqp_item_unit_id');
    expect(await refused(() => slab({ ...base, iqp_from_qty: 5, iqp_to_qty: 15 }))).toBe(
      '409 ITEM_QTY_PRICE_OVERLAP @iqp_from_qty',
    );
    expect(
      await refused(() =>
        slab({ ...base, iqp_from_qty: 50, iqp_price_mode: 'F', iqp_disc_pct: null }),
      ),
    ).toBe('400 ITEM_QTY_PRICE_VALUE_REQUIRED @iqp_price');
    expect(await refused(() => slab({ ...base, iqp_from_qty: 50, iqp_disc_pct: 150 }))).toBe(
      '400 VALIDATION_MAX @iqp_disc_pct',
    );

    // The upper bound is exclusive, so 10–20 only touches 1–10; a slab after
    // the first one's last day may cover the same qty.
    const second = await attempt(() => slab({ ...base, iqp_from_qty: 10, iqp_to_qty: 20 }));
    await attempt(() =>
      slab({
        ...base,
        iqp_effective_from: '2099-02-01',
        iqp_effective_to: null,
        iqp_from_qty: 5,
        iqp_to_qty: 15,
      }),
    );

    // A ladder re-cut in one save is judged where it ends, not in the order sent.
    const recut = await attempt(async () =>
      slabs.save([
        await dto(
          { ...base, iqp_id: first.iqp_id, iqp_from_qty: 1, iqp_to_qty: 5 },
          SaveItemQtyPriceDto,
        ),
        await dto(
          { ...base, iqp_id: second.iqp_id, iqp_from_qty: 5, iqp_to_qty: 20 },
          SaveItemQtyPriceDto,
        ),
      ]),
    );
    expect(recut.map((r) => [r.iqp_from_qty, r.iqp_to_qty])).toEqual([
      [1, 5],
      [5, 20],
    ]);

    // A restore that would overlap a live slab is refused.
    await attempt(() => slabs.softDelete(second.iqp_id));
    await attempt(() => slab({ ...base, iqp_from_qty: 5, iqp_to_qty: 8 }));
    expect(await refused(() => slabs.restore(second.iqp_id))).toBe(
      '409 ITEM_QTY_PRICE_OVERLAP @iqp_id',
    );
  });

  it('B1 / B2 / B3. godown: an unknown branch, two top-level twins, a parent moved without its children', async () => {
    expect(
      await refused(() => godown({ gdl_branch_id: randomUUID(), gdl_name: nameOf('B1') })),
    ).toBe('400 GODOWN_BRANCH_NOT_FOUND @gdl_branch_id');

    await attempt(() => godown({ gdl_branch_id: fixture.branchA, gdl_name: nameOf('B2') }));
    expect(
      await refused(() =>
        godown({ gdl_branch_id: fixture.branchA, gdl_name: nameOf('B2').toLowerCase() }),
      ),
    ).toBe('409 GODOWN_NAME_TAKEN @gdl_name');

    const wh = await attempt(() =>
      godown({ gdl_branch_id: fixture.branchA, gdl_name: nameOf('B3 WH') }),
    );
    const child = await attempt(() =>
      godown({
        gdl_branch_id: fixture.branchA,
        gdl_parent_id: wh.gdl_id,
        gdl_name: nameOf('B3 rack'),
        gdl_type: 'RACK',
      }),
    );
    expect(await refused(() => godown({ gdl_id: wh.gdl_id, gdl_branch_id: fixture.branchB }))).toBe(
      '409 GODOWN_BRANCH_CHANGE_HAS_CHILDREN @gdl_branch_id',
    );

    await attempt(() => godowns.softDelete(child.gdl_id));
    const moved = await attempt(() =>
      godown({ gdl_id: wh.gdl_id, gdl_branch_id: fixture.branchB }),
    );
    expect(moved).toMatchObject({ gdl_branch_id: fixture.branchB, gdl_level: 1 });
  });

  it("B4. a godown's level is its depth from 1, the company seed's Main Godown included", async () => {
    const [{ off }] = await tx.$queryRaw<Array<{ off: number }>>`
      WITH RECURSIVE tree (id, lvl) AS (
          SELECT gdl_id, 1 FROM inventory.godown_locations WHERE gdl_parent_id IS NULL
          UNION ALL
          SELECT c.gdl_id, tree.lvl + 1
            FROM inventory.godown_locations c JOIN tree ON c.gdl_parent_id = tree.id
           WHERE tree.lvl < 64)
      SELECT count(*)::int AS off
        FROM inventory.godown_locations g JOIN tree ON tree.id = g.gdl_id
       WHERE g.gdl_level IS DISTINCT FROM tree.lvl`;
    expect(off).toBe(0);

    // Out of the way inside this rolled-back transaction, so the seed can name its own.
    await tx.$executeRaw`
      UPDATE inventory.godown_locations SET gdl_name = gdl_name || ${` ${stamp}`}
       WHERE gdl_branch_id = ${fixture.branchB}::uuid AND gdl_parent_id IS NULL
         AND lower(gdl_name) = lower(${MAIN_GODOWN_NAME})`;
    const seeded = await attempt(() =>
      godowns.seedMainGodown(tx, fixture.branchB, fixture.userId, new Date()),
    );
    expect(seeded.gdl_level).toBe(1);
  });

  it('B5. units: 9 decimals, a negative weight and a pack unit with no base unit are refused', async () => {
    const name = `ZT139B5${stamp}`;
    expect(await refused(() => unit({ unit_name: name, unit_decimal_count: 9 }))).toBe(
      '400 VALIDATION_MAX @unit_decimal_count',
    );
    expect(await refused(() => unit({ unit_name: name, unit_weight: -1 }))).toBe(
      '400 VALIDATION_MIN @unit_weight',
    );
    expect(await refused(() => unit({ unit_name: name, unit_is_pack_unit: true }))).toBe(
      '400 UNIT_PACK_BASE_REQUIRED @unit_is_pack_unit',
    );
    expect(
      await refused(() =>
        unit({ unit_name: name, unit_base_unit_id: randomUUID(), unit_conversion: 10 }),
      ),
    ).toBe('400 UNIT_BASE_NOT_FOUND @unit_base_unit_id');
    const pack = await attempt(() =>
      unit({
        unit_name: name,
        unit_decimal_count: 3,
        unit_is_pack_unit: true,
        unit_base_unit_id: fixture.unitId,
        unit_conversion: 10,
      }),
    );
    expect(pack).toMatchObject({ unit_decimal_count: 3, unit_is_pack_unit: true });
  });

  it('B6. names that differ only in case clash on brand, group, section, category, unit and godown', async () => {
    for (const m of NAMED) {
      await m.create(nameOf(`B6 ${m.label}`));
      expect(await refused(() => m.create(nameOf(`B6 ${m.label}`).toLowerCase()))).toBe(
        `409 ${m.code}_NAME_TAKEN @${m.field}`,
      );
    }
    await attempt(() => unit({ unit_name: `ZT139B6${stamp}` }));
    expect(await refused(() => unit({ unit_name: `zt139b6${stamp}` }))).toBe(
      '409 UNIT_NAME_TAKEN @unit_name',
    );
  });

  it('B7. a cleared optional text is stored as NULL, and no blank text is left on the box', async () => {
    const saved = await attempt(() =>
      brand({ brand_name: nameOf('B7'), brand_alias: 'al', brand_short: 'sh' }),
    );
    const cleared = await attempt(() =>
      brand({ brand_id: saved.brand_id, brand_name: nameOf('B7'), brand_short: '' }),
    );
    expect(cleared).toMatchObject({ brand_alias: 'al', brand_short: null });
    const grp = await attempt(() => group({ itg_name: nameOf('B7'), itg_short: '  ' }));
    expect(grp.itg_short).toBeNull();

    const [{ blank }] = await tx.$queryRaw<Array<{ blank: number }>>`
      SELECT ((SELECT count(*) FROM inventory.item_brand_master
                WHERE btrim(brand_alias) = '' OR btrim(brand_short) = '' OR btrim(brand_description) = '')
            + (SELECT count(*) FROM inventory.item_group_master
                WHERE btrim(itg_alias) = '' OR btrim(itg_short) = '' OR btrim(itg_description) = '')
            + (SELECT count(*) FROM inventory.item_section_master
                WHERE btrim(sec_alias) = '' OR btrim(sec_short) = '' OR btrim(sec_description) = '')
            + (SELECT count(*) FROM inventory.item_category_master
                WHERE btrim(category_alias) = '' OR btrim(category_short) = ''
                   OR btrim(category_description) = ''))::int AS blank`;
    expect(blank).toBe(0);
  });

  it('B8 / B9. tax rate: a deleted rate cannot be superseded; negatives answer their own codes', async () => {
    const old = await attempt(() => taxRate({ tax_name: nameOf('B8 old'), tax_rate_perc: 5 }));
    await attempt(() => taxRates.softDelete(old.tax_id));
    expect(
      await refused(() =>
        taxRate({ tax_name: nameOf('B8 new'), tax_rate_perc: 5, tax_supersedes_id: old.tax_id }),
      ),
    ).toBe('404 TAX_RATE_SUPERSEDED_NOT_FOUND @tax_supersedes_id');

    expect(await refused(() => taxRate({ tax_name: nameOf('B9'), tax_rate_perc: -1 }))).toBe(
      '400 TAX_RATE_PERC_OUT_OF_RANGE @tax_rate_perc',
    );
    expect(
      await refused(() =>
        taxRate({
          tax_name: nameOf('B9'),
          tax_rate_perc: 5,
          tax_cess_basis: 'PERCENT',
          tax_cess_perc: -1,
        }),
      ),
    ).toBe('400 TAX_RATE_CESS_NEGATIVE @tax_cess_perc');
  });
});
