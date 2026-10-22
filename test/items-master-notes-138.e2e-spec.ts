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
import type { SaveItemCompositeDto } from '../src/modules/Inventory/items-master/dto/save-item-composite.dto';

/**
 * NOTES 138 (a saved item's base unit is locked, 2026-10-22) AGAINST THE REAL
 * DATABASE, in one rolled-back transaction like items-master-notes-137: the
 * stored base-row reads, both routes' refusals and the backfill.
 *
 *     npm run test:e2e -- items-master-notes-138
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
  groupId: string;
  unitA: string;
  unitB: string;
  unitC: string;
  userId: string;
}

describe('Item master, notes 138 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: ItemsMasterService;
  let iuc: ItemUnitConversionService;
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
      getCompanyId: () => fixture.companyId,
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
    const price = new ItemsPriceMasterService(db, audit, grid, ctx, buckets);
    const ean = new ItemsEanCodeMasterService(db, audit, grid, ctx);
    const reorder = new ItemsReorderMasterService(db, audit, grid, ctx);
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
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master
       WHERE itg_is_deleted = false AND itg_is_active = true ORDER BY itg_id LIMIT 1`;
    const units = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master
       WHERE unit_is_deleted = false AND unit_is_active = true ORDER BY unit_name LIMIT 3`;
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    if (!company || !group || units.length < 3 || !user) {
      throw new Error('Needs a company, an active item group, three active units and a user.');
    }
    return {
      companyId: company.comp_id,
      groupId: group.itg_id,
      unitA: units[0].unit_id,
      unitB: units[1].unit_id,
      unitC: units[2].unit_id,
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

  /** Base unit A, and B worth 10 of A. */
  const conversions = () => [
    { iuc_unit_id: fixture.unitA, iuc_is_base_unit: true, iuc_to_base_factor: 1, iuc_unit_slno: 0 },
    { iuc_unit_id: fixture.unitB, iuc_to_base_factor: 10, iuc_unit_slno: 1 },
  ];
  const create = (name: string, extra: Partial<SaveItemCompositeDto> = {}) =>
    attempt(() =>
      service.saveComposite({
        item_company_id: fixture.companyId,
        item_name_en: `${name} ${stamp}`,
        item_group_id: fixture.groupId,
        unit_conversions: conversions(),
        ...extra,
      }),
    );
  const update = (itemId: string, name: string, extra: Partial<SaveItemCompositeDto>) =>
    service.saveComposite({
      item_id: itemId,
      item_name_en: `${name} ${stamp}`,
      item_group_id: fixture.groupId,
      ...extra,
    });
  const header = async (itemId: string) =>
    (await tx.itemMaster.findUniqueOrThrow({ where: { itemId } })).itemBaseUnitId;

  it("A2. the first save's base row sets the header, whatever the payload left blank", async () => {
    const created = await create('N138 first');
    expect(created.item.item_base_unit_id).toBe(fixture.unitA);
    expect(await header(created.item.item_id)).toBe(fixture.unitA);
  });

  it('A1. /items refuses every change of a saved base unit, and writes nothing', async () => {
    const created = await create('N138 items');
    const itemId = created.item.item_id;
    const baseId = created.unit_conversions.find((row) => row.iuc_is_base_unit)!.iuc_id;
    const name = 'N138 items';

    expect(
      await refused(() =>
        update(itemId, name, {
          unit_conversions: [
            { iuc_unit_id: fixture.unitA, iuc_unit_slno: 0 },
            { iuc_unit_id: fixture.unitB, iuc_is_base_unit: true, iuc_unit_slno: 1 },
          ],
        }),
      ),
    ).toBe('409 ITEM_BASE_UNIT_LOCKED @unit_conversions.1.iuc_is_base_unit');
    expect(
      await refused(() =>
        update(itemId, name, {
          unit_conversions: [{ iuc_unit_id: fixture.unitB, iuc_to_base_factor: 10 }],
        }),
      ),
    ).toBe('409 ITEM_BASE_UNIT_LOCKED @unit_conversions');
    expect(
      await refused(() =>
        update(itemId, name, {
          unit_conversions: [
            { iuc_id: baseId, iuc_unit_id: fixture.unitC, iuc_is_base_unit: true },
            { iuc_unit_id: fixture.unitB, iuc_to_base_factor: 10, iuc_unit_slno: 1 },
          ],
        }),
      ),
    ).toBe('409 ITEM_BASE_UNIT_LOCKED @unit_conversions.0.iuc_unit_id');
    expect(await refused(() => update(itemId, name, { item_base_unit_id: fixture.unitB }))).toBe(
      '409 ITEM_BASE_UNIT_LOCKED @item_base_unit_id',
    );

    const after = await service.getComposite(itemId);
    expect(after.item.item_base_unit_id).toBe(fixture.unitA);
    expect(after.unit_conversions.filter((row) => row.iuc_is_base_unit)).toEqual([
      expect.objectContaining({ iuc_id: baseId, iuc_unit_id: fixture.unitA }),
    ]);
  });

  it('A1. /item-unit-conversions refuses the same, and will not delete the base row', async () => {
    const created = await create('N138 units');
    const itemId = created.item.item_id;
    const baseId = created.unit_conversions.find((row) => row.iuc_is_base_unit)!.iuc_id;
    const bId = created.unit_conversions.find((row) => row.iuc_unit_id === fixture.unitB)!.iuc_id;

    expect(
      await refused(() =>
        iuc.save({ iuc_id: baseId, iuc_item_id: itemId, iuc_unit_id: fixture.unitC }),
      ),
    ).toBe('409 ITEM_BASE_UNIT_LOCKED @iuc_unit_id');
    expect(
      await refused(() =>
        iuc.save({
          iuc_id: bId,
          iuc_item_id: itemId,
          iuc_unit_id: fixture.unitB,
          iuc_is_base_unit: true,
        }),
      ),
    ).toBe('409 ITEM_BASE_UNIT_LOCKED @iuc_is_base_unit');
    expect(
      await refused(() =>
        iuc.save([
          { iuc_item_id: itemId, iuc_unit_id: fixture.unitC, iuc_to_base_factor: 50 },
          {
            iuc_item_id: itemId,
            iuc_unit_id: fixture.unitB,
            iuc_id: bId,
            iuc_base_unit_id: fixture.unitB,
          },
        ]),
      ),
    ).toBe('409 ITEM_BASE_UNIT_LOCKED @1.iuc_base_unit_id');
    expect(await refused(() => iuc.delete(baseId))).toBe('409 ITEM_BASE_UNIT_LOCKED @iuc_id');

    // A new factor on another row is not a base change.
    const saved = await attempt(() =>
      iuc.save({
        iuc_id: bId,
        iuc_item_id: itemId,
        iuc_unit_id: fixture.unitB,
        iuc_to_base_factor: 15,
      }),
    );
    expect(saved).toMatchObject({ iuc_base_unit_id: fixture.unitA, iuc_to_base_factor: 15 });
  });

  it('still open on a saved item: factors, weight, a new unit, removing a non-base unit', async () => {
    const created = await create('N138 open');
    const itemId = created.item.item_id;
    const name = 'N138 open';

    const changed = await attempt(() =>
      update(itemId, name, {
        unit_conversions: [
          {
            iuc_unit_id: fixture.unitA,
            iuc_is_base_unit: true,
            iuc_uom_weight: 2,
            iuc_unit_slno: 0,
          },
          { iuc_unit_id: fixture.unitB, iuc_to_base_factor: 12, iuc_unit_slno: 1 },
          { iuc_unit_id: fixture.unitC, iuc_to_base_factor: 24, iuc_unit_slno: 2 },
        ],
      }),
    );
    const byUnit = new Map(changed.unit_conversions.map((row) => [row.iuc_unit_id, row]));
    expect(byUnit.get(fixture.unitA)).toMatchObject({ iuc_is_base_unit: true, iuc_uom_weight: 2 });
    expect(byUnit.get(fixture.unitB)).toMatchObject({ iuc_to_base_factor: 12 });
    expect(byUnit.get(fixture.unitC)).toMatchObject({
      iuc_base_unit_id: fixture.unitA,
      iuc_is_base_unit: false,
      iuc_to_base_factor: 24,
    });

    const removed = await attempt(() =>
      update(itemId, name, {
        unit_conversions: [
          { iuc_unit_id: fixture.unitA, iuc_is_base_unit: true, iuc_unit_slno: 0 },
          { iuc_unit_id: fixture.unitC, iuc_to_base_factor: 24, iuc_unit_slno: 2 },
        ],
      }),
    );
    expect(removed.unit_conversions.map((row) => row.iuc_unit_id).sort()).toEqual(
      [fixture.unitA, fixture.unitC].sort(),
    );
    expect(removed.item.item_base_unit_id).toBe(fixture.unitA);
  });

  it('an item with no unit rows is not locked; its first unit rows set the base, then it locks', async () => {
    const created = await create('N138 bare', {
      item_base_unit_id: fixture.unitA,
      unit_conversions: undefined,
    });
    const itemId = created.item.item_id;
    const name = 'N138 bare';
    expect(created.unit_conversions).toEqual([]);

    await attempt(() => update(itemId, name, { item_base_unit_id: fixture.unitB }));
    expect(await header(itemId)).toBe(fixture.unitB);

    await attempt(() =>
      update(itemId, name, {
        unit_conversions: [{ iuc_unit_id: fixture.unitC, iuc_is_base_unit: true }],
      }),
    );
    expect(await header(itemId)).toBe(fixture.unitC);

    expect(await refused(() => update(itemId, name, { item_base_unit_id: fixture.unitB }))).toBe(
      '409 ITEM_BASE_UNIT_LOCKED @item_base_unit_id',
    );
  });

  it('A2. a blank header beside a base row is filled by the next save, whatever it sends', async () => {
    const created = await create('N138 blank');
    const itemId = created.item.item_id;
    await tx.itemMaster.update({ where: { itemId }, data: { itemBaseUnitId: null } });

    await attempt(() => update(itemId, 'N138 blank', { item_base_unit_id: null }));
    expect(await header(itemId)).toBe(fixture.unitA);
  });

  it('A2. after the backfill no item header disagrees with its base row', async () => {
    const [row] = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n
        FROM inventory.item_master i
        JOIN inventory.item_unit_conversion c
          ON c.iuc_item_id = i.item_id AND c.iuc_is_base_unit AND NOT c.iuc_is_deleted
       WHERE i.item_base_unit_id IS DISTINCT FROM c.iuc_unit_id`;
    expect(row.n).toBe(0);
  });
});
