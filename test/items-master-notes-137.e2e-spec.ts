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
import { UiTableMasterService } from '../src/modules/fixed/ui-table-master/ui-table-master.service';
import type { SaveItemCompositeDto } from '../src/modules/Inventory/items-master/dto/save-item-composite.dto';
import type { SaveUiTableMasterDto } from '../src/modules/fixed/ui-table-master/dto/save-ui-table-master.dto';

/**
 * NOTES 137 (item master server audit, 2026-10-21) AGAINST THE REAL DATABASE,
 * in one rolled-back transaction like items-master-notes-67: the new indexes
 * and constraints, the raw SQL of the unique-key / company-move checks and
 * Prisma's real error shapes — what the unit mocks cannot prove.
 *
 *     npm run test:e2e -- items-master-notes-137
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
  companyA: string;
  companyB: string;
  branchX: string;
  branchY: string;
  branchOfB: string | null;
  godownNotX: string | null;
  groupId: string;
  otherGroupId: string;
  unitA: string;
  unitB: string;
  userId: string;
}

describe('Item master, notes 137 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: ItemsMasterService;
  let iuc: ItemUnitConversionService;
  let price: ItemsPriceMasterService;
  let ean: ItemsEanCodeMasterService;
  let reorder: ItemsReorderMasterService;
  let uiTables: UiTableMasterService;
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
      getCompanyId: () => fixture.companyA,
    } as unknown as RequestContextService;
    const audit = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;
    const db = transactional(tx);
    const grid = {} as never;
    iuc = new ItemUnitConversionService(db, audit, grid, ctx);
    const buckets = new PriceBucketService({
      resolveEffective: () => Promise.resolve([]),
    } as never);
    price = new ItemsPriceMasterService(db, audit, grid, ctx, buckets);
    ean = new ItemsEanCodeMasterService(db, audit, grid, ctx);
    reorder = new ItemsReorderMasterService(db, audit, grid, ctx);
    service = new ItemsMasterService(
      db,
      audit,
      ctx,
      iuc,
      price,
      ean,
      reorder,
      new ItemMasterUpdateService(iuc, price, ean, reorder, buckets),
      new StockTrackPolicyService(db, audit, ctx),
      buckets,
    );
    uiTables = new UiTableMasterService(db, audit, ctx);
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
    const [other] = await tx.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE comp_id <> ${scope.comp}::uuid
       ORDER BY comp_id LIMIT 1`;
    if (!other) throw new Error('No second company on this database.');
    const [branchOfB] = await tx.$queryRaw<Array<{ br_id: string }>>`
      SELECT br_id FROM public.branch_master
       WHERE br_comp_id = ${other.comp_id}::uuid AND br_is_deleted = false LIMIT 1`;
    const [godown] = await tx.$queryRaw<Array<{ gdl_id: string }>>`
      SELECT gdl_id FROM inventory.godown_locations
       WHERE gdl_is_deleted = false AND gdl_branch_id <> ${scope.branches[0]}::uuid LIMIT 1`;
    const groups = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master
       WHERE itg_is_deleted = false AND itg_is_active = true ORDER BY itg_id LIMIT 2`;
    const units = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master
       WHERE unit_is_deleted = false AND unit_is_active = true ORDER BY unit_name LIMIT 2`;
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    return {
      companyA: scope.comp,
      companyB: other.comp_id,
      branchX: scope.branches[0],
      branchY: scope.branches[1],
      branchOfB: branchOfB?.br_id ?? null,
      godownNotX: godown?.gdl_id ?? null,
      groupId: groups[0].itg_id,
      otherGroupId: groups[1].itg_id,
      unitA: units[0].unit_id,
      unitB: units[1].unit_id,
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
  /** The refusal's HTTP status and first `errors[].code`; a non-HTTP error fails the test. */
  async function refused(fn: () => Promise<unknown>): Promise<string> {
    const error = await attempt(fn).then(
      () => {
        throw new Error('expected a refusal, got a success');
      },
      (e: unknown) => e,
    );
    const status = (error as { status?: number }).status;
    if (status === undefined) throw error;
    const response = (error as { response?: { errors?: Array<{ code: string }> } }).response;
    return `${status} ${response?.errors?.[0]?.code ?? JSON.stringify(response)}`;
  }

  const conversions = (withB = false) => [
    {
      iuc_unit_id: fixture.unitA,
      iuc_is_base_unit: true,
      iuc_is_default_unit: true,
      iuc_to_base_factor: 1,
      iuc_unit_slno: 0,
    },
    ...(withB ? [{ iuc_unit_id: fixture.unitB, iuc_to_base_factor: 10, iuc_unit_slno: 1 }] : []),
  ];
  const base = (name: string, extra: Partial<SaveItemCompositeDto> = {}): SaveItemCompositeDto => ({
    item_company_id: fixture.companyA,
    item_name_en: `${name} ${stamp}`,
    item_group_id: fixture.groupId,
    item_base_unit_id: fixture.unitA,
    unit_conversions: conversions(),
    ...extra,
  });
  const create = (name: string, extra: Partial<SaveItemCompositeDto> = {}) =>
    attempt(() => service.saveComposite(base(name, extra)));

  it('A1. a child id of item A sent with item B is refused, and A keeps its rows', async () => {
    const a = await create('N137 A1 a', {
      ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `A1A${stamp}` }],
      prices: [{ ipm_uc_unit_id: fixture.unitA, ipm_profit_type: 'By %', ipm_sales_price_a: 5 }],
    });
    const b = await create('N137 A1 b');
    const asB = (extra: Partial<SaveItemCompositeDto>) =>
      service.saveComposite(base('N137 A1 b', { item_id: b.item.item_id, ...extra }));

    expect(
      await refused(() =>
        asB({
          ean_codes: [
            { ean_id: a.ean_codes[0].ean_id, ean_unit_id: fixture.unitA, ean_code: `A1A${stamp}` },
          ],
        }),
      ),
    ).toBe('400 ITEM_CHILD_NOT_OF_ITEM');
    expect(
      await refused(() =>
        asB({
          prices: [
            {
              ipm_id: a.prices[0].ipm_id,
              ipm_uc_unit_id: fixture.unitA,
              ipm_profit_type: 'By %',
              ipm_sales_price_a: 9,
            },
          ],
        }),
      ),
    ).toBe('400 ITEM_CHILD_NOT_OF_ITEM');
    // The standalone route loads by id AND item now.
    expect(
      await refused(() =>
        ean.save({
          ean_id: a.ean_codes[0].ean_id,
          ean_item_id: b.item.item_id,
          ean_unit_id: b.unit_conversions[0].iuc_id,
          ean_code: `A1A${stamp}`,
        }),
      ),
    ).toBe('404 ITEM_EAN_NOT_FOUND');

    const stillA = await service.getComposite(a.item.item_id);
    expect(stillA.ean_codes.map((r) => r.ean_code)).toEqual([`A1A${stamp}`]);
    expect(stillA.prices.map((r) => r.ipm_sales_price_a)).toEqual([5]);
  });

  it('A2. null makes an item shared again and clears its days; a move to another company may clear the branch', async () => {
    const created = await create('N137 A2', {
      item_branch_id: fixture.branchX,
      item_expiry_days: 30,
    });
    const id = created.item.item_id;

    const moved = await attempt(() =>
      service.saveComposite(
        base('N137 A2', { item_id: id, item_company_id: fixture.companyB, item_branch_id: null }),
      ),
    );
    expect(moved.item).toMatchObject({ item_company_id: fixture.companyB, item_branch_id: null });

    const shared = await attempt(() =>
      service.saveComposite(
        base('N137 A2', { item_id: id, item_company_id: null, item_expiry_days: null }),
      ),
    );
    expect(shared.item).toMatchObject({ item_company_id: null, item_expiry_days: null });
  });

  it('A4. removing a unit removes its prices, EAN codes and reorders; the unit route refuses while they live', async () => {
    const created = await create('N137 A4', {
      unit_conversions: conversions(true),
      prices: [{ ipm_uc_unit_id: fixture.unitB, ipm_profit_type: 'By %', ipm_sales_price_a: 50 }],
      ean_codes: [{ ean_unit_id: fixture.unitB, ean_code: `A4B${stamp}` }],
      reorders: [{ ir_branch_id: fixture.branchX, ir_unit_id: fixture.unitB, ir_min_level: 1 }],
    });
    const iucB = created.unit_conversions.find((r) => r.iuc_unit_id === fixture.unitB)!.iuc_id;

    expect(await refused(() => iuc.delete(iucB))).toBe('409 UNIT_CONV_IN_USE');

    await attempt(() => service.saveComposite(base('N137 A4', { item_id: created.item.item_id })));
    const after = await service.getComposite(created.item.item_id);
    expect(after.unit_conversions.map((r) => r.iuc_unit_id)).toEqual([fixture.unitA]);
    expect(after.prices).toHaveLength(0);
    expect(after.ean_codes).toHaveLength(0);
    expect(after.reorders).toHaveLength(0);
    // Soft deleted, not gone — and the barcode is free for another item.
    expect(await tx.itemEanCode.count({ where: { eanUcUnitId: iucB, eanIsDeleted: true } })).toBe(
      1,
    );
  });

  it('B1 / B2. two branches may hold the same reorder key; one branch may not hold it twice, NULLs included; an update that omits the unit keeps it', async () => {
    const created = await create('N137 B1', {
      reorders: [
        { ir_branch_id: fixture.branchX, ir_min_level: 1 },
        { ir_branch_id: fixture.branchY, ir_min_level: 2 },
      ],
    });
    expect(created.reorders).toHaveLength(2);
    expect(
      await refused(() =>
        reorder.save({ ir_item_id: created.item.item_id, ir_branch_id: fixture.branchX }),
      ),
    ).toBe('409 ITEM_REORDER_DUPLICATE');

    const iucA = created.unit_conversions[0].iuc_id;
    const withUnit = await attempt(() =>
      reorder.save({ ir_item_id: created.item.item_id, ir_unit_id: iucA, ir_min_level: 3 }),
    );
    const updated = await attempt(() =>
      reorder.save({ ir_id: withUnit.ir_id, ir_item_id: created.item.item_id, ir_min_level: 4 }),
    );
    expect(updated).toMatchObject({ ir_unit_id: iucA, ir_min_level: 4 });
  });

  it('B3 / B8. EAN codes are unique in any case; one payload may not carry one code twice', async () => {
    await create('N137 B3 p', {
      ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `ab${stamp}` }],
    });
    expect(
      await refused(() =>
        service.saveComposite(
          base('N137 B3 q', {
            ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `AB${stamp}` }],
          }),
        ),
      ),
    ).toBe('409 ITEM_EAN_CODE_TAKEN');
    expect(
      await refused(() =>
        service.saveComposite(
          base('N137 B8', {
            ean_codes: [
              { ean_unit_id: fixture.unitA, ean_code: `dup${stamp}` },
              { ean_unit_id: fixture.unitA, ean_code: `DUP${stamp}` },
            ],
          }),
        ),
      ),
    ).toBe('400 ITEM_DUPLICATE_CHILD_ROWS');
    expect(
      await refused(() =>
        service.saveComposite(
          base('N137 B8 units', {
            unit_conversions: [...conversions(), { iuc_unit_id: fixture.unitA }],
          }),
        ),
      ),
    ).toBe('400 ITEM_DUPLICATE_CHILD_ROWS');
  });

  it('B5 / B6. name, code and SKU are unique per company in any case; a shared item clashes with every company', async () => {
    await create('N137 Rice', { item_code: `C-${stamp}`, item_sku: `S-${stamp}` });

    expect(await refused(() => service.saveComposite(base('n137 RICE')))).toBe(
      '409 ITEM_NAME_TAKEN',
    );
    const otherCompany = await create('N137 RICE', {
      item_company_id: fixture.companyB,
      item_code: `c-${stamp}`,
      item_sku: `s-${stamp}`,
    });
    expect(otherCompany.item.item_company_id).toBe(fixture.companyB);
    expect(
      await refused(() => service.saveComposite(base('n137 rice', { item_company_id: null }))),
    ).toBe('409 ITEM_NAME_TAKEN');
    expect(
      await refused(() => service.saveComposite(base('N137 code', { item_code: `c-${stamp}` }))),
    ).toBe('409 ITEM_CODE_TAKEN');
    expect(
      await refused(() => service.saveComposite(base('N137 sku', { item_sku: `s-${stamp}` }))),
    ).toBe('409 ITEM_SKU_TAKEN');
    // A shared item with a fresh name and code passes.
    const shared = await create('N137 shared', { item_company_id: null });
    expect(shared.item.item_company_id).toBeNull();
    // And then no company may take its name.
    expect(
      await refused(() =>
        service.saveComposite(base('N137 SHARED', { item_company_id: fixture.companyB })),
      ),
    ).toBe('409 ITEM_NAME_TAKEN');
  });

  it("B5. a header barcode may not be another live item's EAN code", async () => {
    await create('N137 bc owner', {
      ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `BC${stamp}` }],
    });
    expect(
      await refused(() =>
        service.saveComposite(base('N137 bc thief', { item_default_barcode: `bc${stamp}` })),
      ),
    ).toBe('409 ITEM_BARCODE_TAKEN');
  });

  it('B7. a header base unit other than the base conversion row is refused', async () => {
    expect(
      await refused(() =>
        service.saveComposite(base('N137 B7', { item_base_unit_id: fixture.unitB })),
      ),
    ).toBe('400 ITEM_BASE_UNIT_MISMATCH');
  });

  it('B9. an unknown brand, or a group that is not active, is refused', async () => {
    expect(
      await refused(() =>
        service.saveComposite(
          base('N137 B9 brand', { item_brand_id: '019c6f6c-be87-7a11-8905-36092c46ffff' }),
        ),
      ),
    ).toBe('400 ITEM_UNKNOWN_BRAND');
    await tx.$executeRaw`
      UPDATE inventory.item_group_master SET itg_is_active = false
       WHERE itg_id = ${fixture.otherGroupId}::uuid`;
    expect(
      await refused(() =>
        service.saveComposite(base('N137 B9 group', { item_group_id: fixture.otherGroupId })),
      ),
    ).toBe('400 ITEM_REFERENCE_RETIRED');
  });

  it("C2. the actor is the token's user, whatever the body names", async () => {
    const created = await create('N137 C2', {
      item_created_by: 'someone-else',
      ean_codes: [{ ean_unit_id: fixture.unitA, ean_code: `C2${stamp}`, ean_created_by: 'x' }],
    });
    expect(created.item.item_created_by).toBe(fixture.userId);
    expect(created.ean_codes[0].ean_created_by).toBe(fixture.userId);
  });

  it('C3. an item does not move into a company while another company holds its prices; moving them along passes', async () => {
    const created = await create('N137 C3', {
      prices: [
        {
          ipm_company_id: fixture.companyA,
          ipm_uc_unit_id: fixture.unitA,
          ipm_profit_type: 'By %',
          ipm_sales_price_a: 7,
        },
      ],
    });
    const id = created.item.item_id;
    expect(
      await refused(() =>
        service.saveComposite(base('N137 C3', { item_id: id, item_company_id: fixture.companyB })),
      ),
    ).toBe('409 ITEM_COMPANY_MOVE_BLOCKED');

    const moved = await attempt(() =>
      service.saveComposite(
        base('N137 C3', {
          item_id: id,
          item_company_id: fixture.companyB,
          prices: [
            {
              ipm_id: created.prices[0].ipm_id,
              ipm_company_id: fixture.companyB,
              ipm_uc_unit_id: fixture.unitA,
              ipm_profit_type: 'By %',
              ipm_sales_price_a: 7,
            },
          ],
        }),
      ),
    );
    expect(moved.item.item_company_id).toBe(fixture.companyB);
    expect(moved.prices[0].ipm_company_id).toBe(fixture.companyB);
  });

  it("C4. a price row of another company, another company's branch or another branch's godown is refused", async () => {
    const priceOf = (extra: Record<string, unknown>) =>
      service.saveComposite(
        base('N137 C4', {
          prices: [{ ipm_uc_unit_id: fixture.unitA, ipm_profit_type: 'By %', ...extra } as never],
        }),
      );
    expect(await refused(() => priceOf({ ipm_company_id: fixture.companyB }))).toBe(
      '400 ITEM_PRICE_OTHER_COMPANY',
    );
    if (fixture.branchOfB) {
      expect(await refused(() => priceOf({ ipm_branch_id: fixture.branchOfB }))).toBe(
        '400 ITEM_PRICE_BRANCH_OTHER_COMPANY',
      );
    }
    if (fixture.godownNotX) {
      expect(
        await refused(() =>
          priceOf({ ipm_branch_id: fixture.branchX, ipm_godown_id: fixture.godownNotX }),
        ),
      ).toBe('400 ITEM_PRICE_GODOWN_OUT_OF_SCOPE');
    }
  });

  it("D1. a child DELETE only deletes; nothing is written under a deleted item or another item's unit", async () => {
    const created = await create('N137 D1', {
      prices: [{ ipm_uc_unit_id: fixture.unitA, ipm_profit_type: 'By %' }],
    });
    const other = await create('N137 D1 other');
    const ipmId = created.prices[0].ipm_id;
    expect(await attempt(() => price.delete(ipmId))).toEqual({ ipm_id: ipmId, deleted: true });
    expect(await refused(() => price.delete(ipmId))).toBe('409 ITEM_PRICE_ALREADY_DELETED');

    expect(
      await refused(() =>
        reorder.save({
          ir_item_id: created.item.item_id,
          ir_unit_id: other.unit_conversions[0].iuc_id,
        }),
      ),
    ).toBe('400 ITEM_REORDER_UNIT_NOT_OF_ITEM');

    await attempt(() => service.softDeleteComposite(other.item.item_id));
    expect(
      await refused(() =>
        ean.save({
          ean_item_id: other.item.item_id,
          ean_unit_id: other.unit_conversions[0].iuc_id,
          ean_code: `D1${stamp}`,
        }),
      ),
    ).toBe('400 ITEM_EAN_ITEM_NOT_LIVE');
  });

  it('D2. a restore whose price now overlaps a live one is a 409, not a 500', async () => {
    const created = await create('N137 D2', {
      prices: [{ ipm_uc_unit_id: fixture.unitA, ipm_profit_type: 'By %', ipm_sales_price_a: 3 }],
    });
    await attempt(() => service.softDeleteComposite(created.item.item_id));
    await tx.$executeRaw`
      INSERT INTO inventory.item_price_master
             (ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_profit_type)
      SELECT ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id, ipm_profit_type
        FROM inventory.item_price_master WHERE ipm_id = ${created.prices[0].ipm_id}::uuid`;
    expect(await refused(() => service.restoreComposite(created.item.item_id))).toBe(
      '409 ITEM_RESTORE_CLASH',
    );
  });

  it("D3. an item packed into another item's packing list is not deleted", async () => {
    const packed = await create('N137 D3 packed');
    await create('N137 D3 pack', { item_packing_item_ids: [packed.item.item_id] });
    expect(await refused(() => service.softDeleteComposite(packed.item.item_id))).toBe(
      '409 ITEM_IN_USE',
    );
  });

  it('D3. the open-document and scheme references are valid SQL against this database', async () => {
    const plain = await create('N137 D3 plain');
    await expect(
      attempt(() => service.softDeleteComposite(plain.item.item_id)),
    ).resolves.toMatchObject({ item: { deleted: true } });
  });

  it('D7. a price row written with no profit type holds one the API accepts', async () => {
    const [col] = await tx.$queryRaw<Array<{ column_default: string }>>`
      SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'inventory' AND table_name = 'item_price_master'
         AND column_name = 'ipm_profit_type'`;
    expect(col.column_default).toBe("'By User'::character varying");
  });

  it('E. a UI table save may not leave two live columns on one number; a swap in one save passes', async () => {
    const table = (extra: Partial<SaveUiTableMasterDto>) =>
      uiTables.save({ uiTblName: `N137 grid ${stamp}`, ...extra } as SaveUiTableMasterDto);
    expect(
      await refused(() =>
        table({
          uiTblColumns: [
            { uiTblClmName: 'a', uiTblClmNo: '1' },
            { uiTblClmName: 'b', uiTblClmNo: '1' },
          ],
        } as never),
      ),
    ).toBe('409 UI_TABLE_COLUMN_NO_DUPLICATE');

    const created = await attempt(() =>
      table({
        uiTblColumns: [
          { uiTblClmName: 'a', uiTblClmNo: '1' },
          { uiTblClmName: 'b', uiTblClmNo: '2' },
        ],
      } as never),
    );
    const [a, b] = created.columns;
    // The 2026-10-12 trap: a create-style save that appends a used number.
    expect(
      await refused(() =>
        table({
          uiTblId: created.uiTblId,
          uiTblColumns: [{ uiTblClmName: 'c', uiTblClmNo: '2' }],
        } as never),
      ),
    ).toBe('409 UI_TABLE_COLUMN_NO_DUPLICATE');

    const swapped = await attempt(() =>
      table({
        uiTblId: created.uiTblId,
        uiTblColumns: [
          { uiTblClmId: a.uiTblClmId, uiTblClmName: 'a', uiTblClmNo: '2' },
          { uiTblClmId: b.uiTblClmId, uiTblClmName: 'b', uiTblClmNo: '1' },
        ],
      } as never),
    );
    expect(swapped.columns.map((c) => `${c.uiTblClmName}${c.uiTblClmNo}`)).toEqual(['b1', 'a2']);
    // ex_ui_tbl_clm_no checked now rather than at commit: the swap left it clean ...
    await attempt(() => tx.$executeRawUnsafe('SET CONSTRAINTS fixed.ex_ui_tbl_clm_no IMMEDIATE'));
    // ... and a row that bypasses the service is refused by the database itself.
    const error = await attempt(
      () =>
        tx.$executeRaw`
        INSERT INTO fixed.ui_table_columns (ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name)
        VALUES (${BigInt(created.uiTblId)}, 1, 'dup')`,
    ).catch((e: unknown) => e);
    expect(String((error as Error).message)).toMatch(/ex_ui_tbl_clm_no|23P01/);
    await tx.$executeRawUnsafe('SET CONSTRAINTS fixed.ex_ui_tbl_clm_no DEFERRED');
  });
});
