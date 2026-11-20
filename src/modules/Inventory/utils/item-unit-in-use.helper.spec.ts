import { Prisma } from '@prisma/client';
import type { InventoryWriteClient } from 'src/common/utils/module-service.utils';
import { rowUnitLock, unitRowsInUse } from './item-unit-in-use.helper';
import { baseRowRePick } from './item-base-unit.helper';

const ITEM = '019c6f6c-be87-7a11-8905-36092c46ba01';
const BAG = '019c6f6c-be87-7a11-8905-36092c46ba02';
const PC = '019c6f6c-be87-7a11-8905-36092c46ba03';
const GONE = '019c6f6c-be87-7a11-8905-36092c46ba04';

/** A client whose usage query answers `rows`; the item holds `ids` (removed ones included). */
function clientWith(ids: string[], rows: Array<{ iuc_id: string; used_by: string }>) {
  const findMany = jest.fn().mockResolvedValue(ids.map((iucId) => ({ iucId })));
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const client = {
    itemUnitConversion: { findMany },
    $queryRaw: queryRaw,
  } as unknown as InventoryWriteClient;
  return { client, findMany, queryRaw };
}

/** The SQL text and bound values of the usage statement. */
function statementOf(queryRaw: jest.Mock): { text: string; values: unknown[] } {
  const [strings, ...values] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql, values: sql.values };
}

describe('unitRowsInUse — item master review 11-20 Q2', () => {
  it('reads every unit row of the item, removed ones too, and asks nothing when there is none', async () => {
    const { client, findMany, queryRaw } = clientWith([], []);
    await expect(unitRowsInUse(client, ITEM)).resolves.toEqual({
      byRow: new Map(),
      itemUsed: false,
      itemUsedBy: [],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { iucItemId: ITEM },
      select: { iucId: true },
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('looks at live document and stock lines only, never the item card rows', async () => {
    const { client, queryRaw } = clientWith([BAG, PC, GONE], []);
    await unitRowsInUse(client, ITEM);
    const { text, values } = statementOf(queryRaw);
    for (const column of [
      'sml_uom_id',
      'svi_uom_id',
      'sbi_item_unit_id',
      'soi_item_unit_id',
      'sqi_item_unit_id',
      'sri_item_unit_id',
      'sdi_item_unit_id',
      'sdri_item_unit_id',
      'sdni_item_unit_id',
      'lgd_unit_id',
      'poi_uom_id',
      'gri_uom_id',
      'pii_uom_id',
      'psri_uom_id',
      'pri_uom_id',
      'vtx_unit_id',
    ]) {
      expect(text).toContain(`x.${column} = ANY(`);
    }
    expect(text).toContain('x.sbi_is_deleted = false');
    // The card's own set-up rows follow a corrected unit: they never count.
    expect(text).not.toMatch(/item_price_master|item_ean_codes|item_reorders|item_qty_price/);
    expect(values).toContainEqual([BAG, PC, GONE]);
  });

  it('collects what holds each row, in a fixed order, and the item as a whole', async () => {
    const { client } = clientWith(
      [BAG, PC, GONE],
      [
        { iuc_id: PC, used_by: 'sale bill' },
        { iuc_id: PC, used_by: 'stock' },
        { iuc_id: GONE, used_by: 'purchase invoice' },
      ],
    );
    const inUse = await unitRowsInUse(client, ITEM);
    expect(inUse.byRow.get(PC)).toEqual(['stock', 'sale bill']);
    expect(inUse.byRow.has(BAG)).toBe(false);
    expect(inUse.itemUsed).toBe(true);
    expect(inUse.itemUsedBy).toEqual(['stock', 'sale bill', 'purchase invoice']);
  });
});

describe('rowUnitLock', () => {
  const inUse = {
    byRow: new Map([[PC, ['sale bill']]]),
    itemUsed: true,
    itemUsedBy: ['sale bill'],
  };

  it('locks the base row once anything of the item is used, though the base row itself is not', () => {
    expect(rowUnitLock(inUse, { iuc_id: BAG, iuc_is_base_unit: true })).toEqual({
      locked: true,
      usedBy: ['sale bill'],
    });
  });

  it('locks another row only when it is used itself', () => {
    expect(rowUnitLock(inUse, { iuc_id: PC, iuc_is_base_unit: false }).locked).toBe(true);
    expect(rowUnitLock(inUse, { iuc_id: GONE, iuc_is_base_unit: false })).toEqual({
      locked: false,
      usedBy: [],
    });
  });

  it('leaves everything open on an item never used', () => {
    const none = { byRow: new Map(), itemUsed: false, itemUsedBy: [] };
    expect(rowUnitLock(none, { iuc_id: BAG, iuc_is_base_unit: true }).locked).toBe(false);
  });
});

describe('baseRowRePick', () => {
  const base = { iuc_id: BAG, iuc_unit_id: 'unit-bag' };

  it('is the unit a save gives the stored base row by its own id', () => {
    expect(baseRowRePick(base, [{ iuc_id: BAG, iuc_unit_id: 'unit-pc' }])).toBe('unit-pc');
  });

  it('is null when the base row keeps its unit, is not sent by id, or nothing is sent', () => {
    expect(baseRowRePick(base, [{ iuc_id: BAG, iuc_unit_id: 'unit-bag' }])).toBeNull();
    expect(baseRowRePick(base, [{ iuc_unit_id: 'unit-pc', iuc_is_base_unit: true }])).toBeNull();
    expect(baseRowRePick(base, undefined)).toBeNull();
  });
});
