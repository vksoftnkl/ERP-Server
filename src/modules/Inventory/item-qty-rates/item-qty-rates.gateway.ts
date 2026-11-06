import { Injectable } from '@nestjs/common';
import { ItemPriceMaster, ItemQtyPrice, Prisma } from '@prisma/client';

type Client = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'itemPriceMaster' | 'itemQtyPrice' | 'itemMaster'
>;

/** One ACTIVE unit of the item, with the unit above it (previous active iuc_unit_slno). */
export interface QtyRatesUnitRecord {
  uomId: string;
  unitName: string | null;
  unitSlno: number;
  toBase: Prisma.Decimal;
  unitFactor: Prisma.Decimal;
  parentUomId: string | null;
  parentUnitName: string | null;
  parentToBase: Prisma.Decimal | null;
}

/** A price level 1–4 of fixed.price_levels. */
export interface QtyRatesLevelRecord {
  level: number;
  name: string;
  short: string | null;
  active: boolean;
}

/**
 * Every statement Qty-wise Prices + card rate (menu 244) reads ITSELF. It
 * writes nothing: the card goes through SellingPriceBulkService (PriceMasterWriter),
 * the slabs through ItemsQtyPriceMasterService (PriceMasterWriter). Which price
 * row answers is the TS resolver's call (price-resolver.ts) over the rows read
 * here — never a second copy of the rule in SQL.
 */
@Injectable()
export class ItemQtyRatesGateway {
  /**
   * One save per item at a time: the advisory lock the slab writer's overlap
   * check takes (hashtext('inventory.item_qty_price'), hashtext(item)) — taken
   * FIRST, so two saves of one item queue instead of deadlocking over each
   * other's slab and price rows, and the checks judge what is really there.
   * Transaction-scoped and re-entrant: the writer taking it again is a no-op.
   */
  async lockItem(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, itemId: string): Promise<void> {
    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT count(pg_advisory_xact_lock(hashtext('inventory.item_qty_price'), hashtext(${itemId}::uuid::text)))::int AS locked`;
  }

  /** Price levels 1–4, `fixed.price_levels` (the screens' list, not inventory.item_price_levels). */
  async levels(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  ): Promise<QtyRatesLevelRecord[]> {
    const rows = await client.$queryRaw<
      Array<{ id: number; name: string | null; short: string | null; active: boolean | null }>
    >`
      SELECT price_lvl_id::int AS id, price_lvl_name AS name, price_lvl_short AS short,
             (price_lvl_is_active IS TRUE AND "price_lvl_isDeleted" IS NOT TRUE) AS active
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4`;
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return [1, 2, 3, 4].map((level) => ({
      level,
      name: byId.get(level)?.name?.trim() || `Price ${'ABCD'[level - 1]}`,
      short: byId.get(level)?.short?.trim() || null,
      active: byId.get(level)?.active === true,
    }));
  }

  /**
   * The item's ACTIVE units in iuc_unit_slno order, each with the unit above
   * it — menu 298's chain (a child unit follows its parent ÷ units per parent).
   */
  async units(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    itemId: string,
  ): Promise<QtyRatesUnitRecord[]> {
    const rows = await client.$queryRaw<
      Array<{
        uom_id: string;
        unit_name: string | null;
        unit_slno: number | null;
        to_base: Prisma.Decimal | null;
        unit_factor: Prisma.Decimal | null;
        parent_uom_id: string | null;
        parent_unit_name: string | null;
        parent_to_base: Prisma.Decimal | null;
      }>
    >`
      SELECT iuc.iuc_id AS uom_id, u.unit_name, iuc.iuc_unit_slno AS unit_slno,
             iuc.iuc_to_base_factor AS to_base, iuc.iuc_unit_factor AS unit_factor,
             LAG(iuc.iuc_id)             OVER w AS parent_uom_id,
             LAG(u.unit_name)            OVER w AS parent_unit_name,
             LAG(iuc.iuc_to_base_factor) OVER w AS parent_to_base
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE iuc.iuc_item_id = ${itemId}::uuid
         AND iuc.iuc_is_active = true
         AND iuc.iuc_is_deleted = false
      WINDOW w AS (ORDER BY iuc.iuc_unit_slno, iuc.iuc_id)
       ORDER BY iuc.iuc_unit_slno, iuc.iuc_id`;
    const one = new Prisma.Decimal(1);
    return rows.map((row) => ({
      uomId: row.uom_id,
      unitName: row.unit_name,
      unitSlno: row.unit_slno ?? 0,
      toBase: row.to_base ?? one,
      unitFactor: row.unit_factor ?? one,
      parentUomId: row.parent_uom_id,
      parentUnitName: row.parent_unit_name,
      parentToBase: row.parent_uom_id ? (row.parent_to_base ?? one) : null,
    }));
  }

  /**
   * Every live price row of the item this company and branch can see — this
   * company's or shared, this branch's or all branches' — every period: the TS
   * resolver picks today's (and finds the scheduled ones) from them, as the
   * sale lookup does.
   */
  async priceRows(
    client: Pick<Prisma.TransactionClient, 'itemPriceMaster'>,
    itemId: string,
    companyId: string,
    branchId: string,
  ): Promise<ItemPriceMaster[]> {
    return client.itemPriceMaster.findMany({
      where: {
        ipmItemId: itemId,
        ipmIsDeleted: false,
        AND: [
          { OR: [{ ipmCompanyId: companyId }, { ipmCompanyId: null }] },
          { OR: [{ ipmBranchId: branchId }, { ipmBranchId: null }] },
        ],
      },
      orderBy: [{ ipmId: 'asc' }],
    });
  }

  /** The item's live slabs, every scope. */
  async liveSlabs(
    client: Pick<Prisma.TransactionClient, 'itemQtyPrice'>,
    itemId: string,
  ): Promise<ItemQtyPrice[]> {
    return client.itemQtyPrice.findMany({
      where: { iqpItemId: itemId, iqpIsDeleted: false },
      orderBy: [{ iqpItemUnitId: 'asc' }, { iqpFromQty: 'asc' }, { iqpId: 'asc' }],
    });
  }

  /** item_default_barcode — display only. */
  async barcode(
    client: Pick<Prisma.TransactionClient, 'itemMaster'>,
    itemId: string,
  ): Promise<string | null> {
    const item = await client.itemMaster.findUnique({
      where: { itemId },
      select: { itemDefaultBarcode: true },
    });
    return item?.itemDefaultBarcode ?? null;
  }

  /**
   * Review fix C-f — the item line's group and brand names, display only:
   * item_master.item_group_id → item_group_master.itg_name (fk
   * item_master_item_group_id_fkey) and item_master.item_brand_id →
   * item_brand_master.brand_name (no FK; the column the item card and the
   * price grids filter by). Null when the item has none (or the row is gone).
   */
  async groupAndBrand(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    itemId: string,
  ): Promise<{ groupName: string | null; brandName: string | null }> {
    const [row] = await client.$queryRaw<
      Array<{ groupName: string | null; brandName: string | null }>
    >`
      SELECT NULLIF(btrim(g.itg_name), '')   AS "groupName",
             NULLIF(btrim(b.brand_name), '') AS "brandName"
        FROM inventory.item_master i
        LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
        LEFT JOIN inventory.item_brand_master b ON b.brand_id = i.item_brand_id
       WHERE i.item_id = ${itemId}::uuid`;
    return { groupName: row?.groupName ?? null, brandName: row?.brandName ?? null };
  }

  /** The database's today, `YYYY-MM-DD` (the session's Asia/Kolkata day). */
  async today(client: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<string> {
    const [row] = await client.$queryRaw<
      Array<{ today: string }>
    >`SELECT CURRENT_DATE::text AS today`;
    return row.today;
  }
}

export type { Client as QtyRatesClient };
