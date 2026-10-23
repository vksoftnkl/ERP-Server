import type { Prisma } from '@prisma/client';

/**
 * Notes 144 — the vocabulary of inventory.item_price_change_log. Each set
 * mirrors a CHECK of the table (migration 20261023120000), so a value added
 * here without the migration fails at the constraint, not at a comparison.
 */

/** ck_ipcl_table — IPM item_price_master, IQP item_qty_price. */
export const PRICE_TABLES = ['IPM', 'IQP'] as const;
export type PriceTable = (typeof PRICE_TABLES)[number];

/** ck_ipcl_action. RESTORE is shaped like UPDATE (before and after both kept). */
export const PRICE_CHANGE_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'REKEY'] as const;
export type PriceChangeAction = (typeof PRICE_CHANGE_ACTIONS)[number];

/** ck_ipcl_source — which screen or process made the change. */
export const PRICE_CHANGE_SOURCES = [
  'ITEM_CARD',
  'CHANGE_SELLING_PRICE',
  'QTY_PRICE',
  'BUCKET_REKEY',
  'IMPORT',
] as const;
export type PriceChangeSource = (typeof PRICE_CHANGE_SOURCES)[number];

/** ck_ipcl_app. */
export type PriceChangeApp = 'DESKTOP' | 'WEB' | 'API' | 'SYSTEM';

/** A row as `to_jsonb` answers it: raw column names, numerics as JSON numbers. */
export type PriceRowSnapshot = Prisma.JsonObject;

/** Where a write came from: the source, the menu it was made on, and why when that is known. */
export interface PriceWriteOrigin {
  source: PriceChangeSource;
  menuId: number | null;
  /** Free text the screen or the process gives (a confirmed below-cost price, a cancelled schedule). */
  reason?: string | null;
}

/** `fixed.menu_master` ids of the screens that change prices. */
export const PRICE_MENU_ID = {
  ITEM_MASTER: 29,
  CHANGE_SELLING_PRICE: 30,
  QTY_PRICE: 244,
  /** Notes 144 — the Price Change Log report: its VIEW right is the report's access. */
  PRICE_CHANGE_LOG: 290,
} as const;

/** The origins every writer call names — one per screen. */
export const PRICE_ORIGIN = {
  ITEM_CARD: { source: 'ITEM_CARD', menuId: PRICE_MENU_ID.ITEM_MASTER },
  CHANGE_SELLING_PRICE: {
    source: 'CHANGE_SELLING_PRICE',
    menuId: PRICE_MENU_ID.CHANGE_SELLING_PRICE,
  },
  QTY_PRICE: { source: 'QTY_PRICE', menuId: PRICE_MENU_ID.QTY_PRICE },
  // A re-key runs inside an item card save (its tracking changed).
  BUCKET_REKEY: { source: 'BUCKET_REKEY', menuId: PRICE_MENU_ID.ITEM_MASTER },
} as const satisfies Record<string, PriceWriteOrigin>;

/** One change to record: the row before and after the statement that changed it. */
export interface PriceChangeEntry {
  table: PriceTable;
  rowId: string;
  origin: PriceWriteOrigin;
  before: PriceRowSnapshot | null;
  after: PriceRowSnapshot | null;
  /** Only REKEY is ever stated: every other action is read off before / after. */
  action?: 'REKEY';
}

/** Where a price applies, read off the row (after, or before for a delete). */
export interface PriceChangeScope {
  companyId: string | null;
  branchId: string | null;
  itemId: string | null;
  unitId: string | null;
  godownId: string | null;
  partyId: string | null;
  priceLevel: number | null;
  bucketMrp: number | null;
  bucketSp: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}
