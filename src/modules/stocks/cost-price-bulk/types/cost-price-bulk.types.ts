/**
 * Cost Price – Bulk Change, menu 298 (plan
 * Shared/Prathap/schema/stock/plan-cost-price-bulk-change-2026-11-05.md §3).
 * The vocabulary of its three routes: every string here is an API contract the
 * Qt screen switches on.
 */

/** `fixed.menu_master` id; `assertMenuRight` builds COST_BULK_RIGHT_VIEW / _EDIT from the prefix. */
export const COST_BULK_MENU_ID = 298;
export const COST_BULK_RIGHT_PREFIX = 'COST_BULK';

/** Every refusal / warning code of the screen (wording: prisma/seed/Error_Messages.json). */
export const COST_BULK = {
  /** The item's effective track preset tracks batch, MRP, sale price or serial — or the old batch tick is on. */
  NOT_PLAIN_STOCK: 'COST_BULK_NOT_PLAIN_STOCK',
  /** The item is switched off. */
  INACTIVE: 'COST_BULK_INACTIVE',
  /** The unit has no headline price row in force today at this branch. */
  NO_PRICE_ROW: 'COST_BULK_NO_PRICE_ROW',
  /** The row sent is no longer the one in force today at this branch (deleted, ended, overridden, another branch's). */
  ROW_NOT_CURRENT: 'COST_BULK_ROW_NOT_CURRENT',
  /** The row's business columns changed since it was loaded (rowToken differs). */
  ROW_CHANGED: 'COST_BULK_ROW_CHANGED',
  /** A price is above the MRP (the row's new MRP when sent). Refusal. */
  ABOVE_MRP: 'COST_BULK_ABOVE_MRP',
  /** A price is below the Min (the row's new Min when sent). Refusal. */
  BELOW_MIN: 'COST_BULK_BELOW_MIN',
  /** A price is below the new cost: refusal under `restrict`, warning under `warning`, nothing under `allow`. */
  BELOW_COST: 'COST_BULK_BELOW_COST',
  /** A By User row whose cost changed but whose four prices are all the stored ones. Warning. */
  BY_USER_PRICES_KEPT: 'COST_BULK_BY_USER_PRICES_KEPT',
  /** More than MAX_COST_BULK_ROWS rows in one call. */
  TOO_MANY_ROWS: 'COST_BULK_TOO_MANY_ROWS',
  /** An all-branches (chain) row from a caller whose user type is not HQ. */
  CHAIN_NEEDS_HQ: 'COST_BULK_CHAIN_NEEDS_HQ',
  /** A recomputed markup exceeds what ipm_price_*_markup_perc (numeric(9,3)) holds — a mistyped tiny cost. */
  COST_TOO_LOW: 'COST_BULK_COST_TOO_LOW',
} as const;
export type CostBulkCode = (typeof COST_BULK)[keyof typeof COST_BULK];

/** The approved "item not found" code (one-item mode with an id that is not there). */
export const COST_BULK_ITEM_NOT_FOUND = 'LOOKUP_ITEM_NOT_FOUND';

/** The warnings a save may pass with `overrides[]` (the edit right is the override right). */
export const OVERRIDABLE_CODES: readonly string[] = [
  COST_BULK.BELOW_COST,
  COST_BULK.BY_USER_PRICES_KEPT,
];

/** One save is one part of at most this many rows; the client splits a bigger change. */
export const MAX_COST_BULK_ROWS = 1000;
/** One page of the grid. */
export const MAX_COST_BULK_PAGE = 1000;
export const DEFAULT_COST_BULK_PAGE = 1000;
/** The left-out list is capped; `leftOutTotal` / `leftOutCounts` always count all of them. */
export const MAX_LEFT_OUT = 1000;

/**
 * `ipm_profit_type` — the unit's own rule, as SaveItemPriceDto pins it
 * (items-price-master/dto/save-item-price.dto.ts). Only this screen
 * calculates from it, and the CLIENT does (plan §0): the server validates and
 * writes the prices it is sent.
 */
export const PROFIT_TYPES = ['By %', 'By Rs', 'By User'] as const;
export type ProfitType = (typeof PROFIT_TYPES)[number];
export const BY_USER: ProfitType = 'By User';

/** Why an item or a unit is not on the grid. */
export const LEFT_OUT_REASONS = [
  'NOT_PLAIN_STOCK',
  'OLD_BATCH_TICK',
  'NO_PRICE_ROW',
  'INACTIVE',
] as const;
export type LeftOutReason = (typeof LEFT_OUT_REASONS)[number];

/** The refusal code a left-out reason answers with in one-item mode. */
export const LEFT_OUT_CODE: Readonly<Record<LeftOutReason, CostBulkCode>> = {
  NOT_PLAIN_STOCK: COST_BULK.NOT_PLAIN_STOCK,
  OLD_BATCH_TICK: COST_BULK.NOT_PLAIN_STOCK,
  NO_PRICE_ROW: COST_BULK.NO_PRICE_ROW,
  INACTIVE: COST_BULK.INACTIVE,
};

/** BRANCH = this branch's own row; CHAIN = the all-branches row (ipm_branch_id NULL). */
export type CostBulkScope = 'BRANCH' | 'CHAIN';

/** The rights block the screen enables Save and the warning ticks from. `override` IS `edit` (decided 2026-11-05). */
export interface CostBulkRights {
  view: boolean;
  edit: boolean;
  override: boolean;
}

/** One level of a grid row, as stored on the price row. */
export interface CostBulkLevel {
  level: 1 | 2 | 3 | 4;
  price: number;
  priceWot: number;
  markupPerc: number;
  /** fixed.price_levels.price_lvl_is_active: the screen shows and the checks judge only active levels. */
  active: boolean;
}

/** §3 — one grid row: one unit's headline price row in force today at this branch. */
export interface CostBulkRow {
  /** 1-based over the whole filter (page offset + position). */
  lineNo: number;
  ipmId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  barcode: string | null;
  /** inventory.item_unit_conversion.iuc_id. */
  uomId: string;
  unitName: string | null;
  unitSlno: number;
  /** The previous active unit by iuc_unit_slno (its iuc_id); null on the top unit. */
  parentUomId: string | null;
  parentUnitName: string | null;
  /** How many of this unit make one parent: the keyed step when it agrees with the to-base ratio, else the ratio. Null on the top unit. */
  unitsPerParent: number | null;
  /** iuc_to_base_factor of this unit, as stored. */
  toBaseFactor: number;
  /** iuc_unit_factor, as stored (the item card's step). */
  unitFactor: number;
  /** False when the to-base ratio and iuc_unit_factor disagree (to 2 dp). Always true on the top unit. */
  factorsAgree: boolean;
  priceScope: CostBulkScope;
  /**
   * The row in force is shared by every company (ipm_company_id NULL). A save
   * leaves it as it is and writes this company's own copy (companyCopy on the
   * saved row).
   */
  companyShared: boolean;
  profitType: string;
  roundOff: number;
  /** As of today, through item_tax_history. */
  taxPerc: number;
  costPrice: number;
  costWot: number;
  /** ipm_max_price. 0 = no MRP (no MRP check). */
  mrp: number;
  minPrice: number;
  levels: CostBulkLevel[];
  /** `YYYY-MM-DD` — the start of a later row of the same key (the SCHEDULED chip), else null. */
  scheduledFrom: string | null;
  /** A live qty-wise slab (item_qty_price) prices this item and unit here; the save leaves slabs alone. */
  hasQtySlabs: boolean;
  /** ipm_updated_on as stored (display only; null on a row never updated). */
  updatedOn: string | null;
  /** The concurrency token the save sends back: md5 of the row's business columns. */
  rowToken: string;
}

/** §3 — an item, or one unit of it, the load left out. */
export interface CostBulkLeftOut {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  /** Null = the whole item. */
  unitName: string | null;
  uomId: string | null;
  /** The effective preset's name, or "Plain stock" when the item has none. */
  trackedAs: string;
  reasonCode: LeftOutReason;
  reason: string;
}

export interface CostBulkListResult {
  items: CostBulkRow[];
  /** Grid rows for the whole filter. */
  total: number;
  /** Distinct items among them. */
  totalItems: number;
  page: number;
  limit: number;
  /** Page 1 only (else []); at most MAX_LEFT_OUT. */
  leftOut: CostBulkLeftOut[];
  leftOutTotal: number;
  leftOutCounts: Record<LeftOutReason, number>;
  /** The database's today, `YYYY-MM-DD` — the day every "in force" is read on. */
  today: string;
  belowCostPolicy: string;
  rights: CostBulkRights;
}

/** §1.5 — one note, the shape NexWarningStrip reads. */
export interface CostBulkNote {
  code: string;
  /** REFUSE on a refusal, WARN on a warning. */
  level: 'REFUSE' | 'WARN';
  message: string;
  field: string;
  /** The row's lineNo as sent (1-based). */
  line: number;
  ipmId: string;
  overridable: boolean;
}

export interface CostBulkCounts {
  /** Rows sent. */
  rows: number;
  /** Rows that would change (or did). */
  changed: number;
  /** Rows identical to what is stored — nothing to write. */
  unchanged: number;
  /** Rows with at least one refusal. */
  refused: number;
  /** Rows with at least one warning. */
  warned: number;
}

export interface CostBulkValidateResult {
  /** True when a save with these overrides would go through. */
  ok: boolean;
  refusals: CostBulkNote[];
  warnings: CostBulkNote[];
  rights: CostBulkRights;
  counts: CostBulkCounts;
  belowCostPolicy: string;
}

export interface CostBulkSavedRow extends CostBulkRow {
  /** True when this save wrote the row; false when it was unchanged. */
  written: boolean;
  /** The ipmId the request sent. `ipmId` differs from it only on a company copy. */
  sourceIpmId: string;
  /** The sent row was company-shared: `ipmId` is the company's new row that now shadows it. */
  companyCopy: boolean;
}

export interface CostBulkSaveResult {
  saved: number;
  unchanged: number;
  /** Every row sent, read back after the save, lineNo as sent. */
  rows: CostBulkSavedRow[];
  /** The warnings the save went through with (all ticked). */
  warnings: CostBulkNote[];
  refusals: CostBulkNote[];
  rights: CostBulkRights;
  counts: CostBulkCounts;
  belowCostPolicy: string;
}
