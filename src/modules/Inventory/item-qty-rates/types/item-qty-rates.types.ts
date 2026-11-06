import type { ItemQtyPricePayload } from '../../items-qty-price-master/types/item-qty-price-api.types';
import type { LeftOutReason } from '../../../stocks/cost-price-bulk/types/cost-price-bulk.types';
import type {
  BelowCostPolicy,
  CostBasis,
  PriceScope,
  PriceSource,
  SellingPriceSaveResult,
} from '../../../stocks/selling-price-bulk/types/selling-price-bulk.types';

/**
 * Qty-wise Prices + Cost + Card Rate, one form, one Save — menu 244 (plan
 * 2026-11-05 §4.1–§4.3, addenda 1 and 2). The API shapes.
 */

/** The form's menu: its user_menus flags gate both routes; the card rows log "via" it. */
export const QTY_RATES_MENU_ID = 244;

/** One save is one item: a few units, a ladder of slabs. Generous, never a catalogue. */
export const MAX_QTY_RATES_CARD_ROWS = 200;
export const MAX_QTY_RATES_SLABS = 500;

/** §4.1 `item`. */
export interface QtyRatesItem {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  barcode: string | null;
  /** As of the database's today (item_tax_history, else the item's default). */
  taxPerc: number;
  /** item_incl_tax — the card's tax footing (slab ₹ amounts are moved to it). */
  inclTax: boolean;
  hasCess: boolean;
  /** No preset tracking batch / MRP / sale price / serial and no old batch tick (menu 298's rule). */
  plainStock: boolean;
  /** The effective preset's name, else "Plain stock". */
  trackedAs: string;
  /** Menu 298's leftOutReasonOf: null | INACTIVE | NOT_PLAIN_STOCK | OLD_BATCH_TICK. */
  leftOutReason: Exclude<LeftOutReason, 'NO_PRICE_ROW'> | null;
}

/** §4.1 `rights` — what the screen unlocks (the server checks each again on save). */
export interface QtyRatesRights {
  /** Menu 244 VIEW. */
  view: boolean;
  /** Menu 244 CREATE — a new slab line. */
  createSlab: boolean;
  /** Menu 244 EDIT — a saved slab changed. */
  editSlab: boolean;
  /** Menu 244 DELETE — Delete slab. */
  deleteSlab: boolean;
  /** Menu 30 (Change Selling Price) EDIT — the card band. */
  editCard: boolean;
  /** isHqUserType (Q9) — a slab for all branches. */
  allBranchSlab: boolean;
}

/** One ACTIVE price level 1–4 of fixed.price_levels. */
export interface QtyRatesLevel {
  level: number;
  name: string;
  short: string | null;
}

/** One level of a card row: the stored price, its w/o-tax figure and markup against `cardCost`. */
export interface QtyRatesUnitLevel {
  level: number;
  price: number;
  priceWot: number;
  markupPerc: number;
}

/**
 * §4.1 `units[]` — one card row: a /stock/price-bulk grid row of the item (one
 * per active unit × live bucket at this branch, the headline when the item
 * tracks no bucket), plus the unit chain and the row's own figures.
 */
export interface QtyRatesUnit {
  lineNo: number;
  uomId: string;
  unitName: string | null;
  unitSlno: number;
  /** The unit above (previous active iuc_unit_slno), null on the top unit. */
  parentUomId: string | null;
  parentUnitName: string | null;
  /** How many of this unit make one of the parent (menu 298's unitLink). */
  unitsPerParent: number | null;
  factorsAgree: boolean;
  /** The price row that answers (ipm_id), null when none does. Echo it back. */
  bucketId: string | null;
  priceScope: PriceScope | null;
  priceSource: PriceSource;
  /** The bucket key, echoed back on save; both null = the headline. */
  mrp: number | null;
  salePrice: number | null;
  /** The answering row's ipm_max_price — the MRP column. */
  maxPrice: number;
  stockQty: number;
  /** As /stock/price-bulk: this MRP's stock, else the item average, else the row's own. */
  costRate: number;
  costWot: number;
  costBasis: CostBasis | null;
  /** costRate when it is a stock figure (costBasis ITEM / MRP), else null. Shown, never written. */
  stockAvg: number | null;
  /** The answering row's own ipm_cost_price / ipm_cost_wot; null with no row. */
  rowCost: number | null;
  rowCostWot: number | null;
  /**
   * The cost the Cost column shows and the slab check judges by: rowCost on a
   * Plain-stock headline row, else costRate (what Quick Rate shows).
   */
  cardCost: number;
  profitType: string | null;
  roundOff: number;
  minPrice: number;
  /** Levels 1–4 (inactive ones too: the screen hides them). */
  levels: QtyRatesUnitLevel[];
  /** plainStock && headline row && rights.editCard. */
  costEditable: boolean;
  mrpEditable: boolean;
  /** `YYYY-MM-DD` — a later dated row takes over that day; null when none. */
  scheduledFrom: string | null;
}

/** §4.1 — GET /item-qty-prices/get-with-rates. */
export interface QtyRatesView {
  item: QtyRatesItem;
  rights: QtyRatesRights;
  /** inventory.below_cost_price, resolved: restrict | warning | allow. */
  belowCostPolicy: BelowCostPolicy;
  /** The database's today, `YYYY-MM-DD`. */
  today: string;
  levels: QtyRatesLevel[];
  units: QtyRatesUnit[];
  /** The item's live slabs, every scope, as /item-qty-prices/get returns them. */
  slabs: ItemQtyPricePayload[];
}

export type QtyRatesProblemSource = 'CARD' | 'SLAB';

/** REFUSE stops the save; ASK needs `confirmed`; INFO is reported only (below cost under `allow`). */
export type QtyRatesSeverity = 'REFUSE' | 'ASK' | 'INFO';

/** §4.2 — one thing a card row or a slab breaks, for the below-cost popup / the refusal box. */
export interface QtyRatesProblem {
  source: QtyRatesProblemSource;
  code: string;
  severity: QtyRatesSeverity;
  /** The card row's lineNo (CARD), else null. */
  lineNo: number | null;
  /** The slab's index in slabs[] when it was sent, else null. */
  slabIndex: number | null;
  /** The slab's iqp_id when it has one (a stored slab not sent is named by it). */
  iqpId: string | null;
  uomId: string;
  unitName: string | null;
  level: number | null;
  /** The price judged: the card level price, or the slab's price each. */
  price: number | null;
  cost: number | null;
  /** The request path the screen selects (rates.rows.N.levels, slabs.N, iqp_id). */
  field: string;
  message: string;
}

/** §4.2 — POST /item-qty-prices/save-with-rates. */
export interface QtyRatesSaveResult {
  /** True: nothing was written; re-post the same body with `confirmed: true` to save. */
  needsConfirm: boolean;
  /** What /stock/price-bulk answers for the card rows; null when none were sent (or asking). */
  rates: SellingPriceSaveResult | null;
  /** The slab rows written (empty when asking). */
  slabs: ItemQtyPricePayload[];
  deletedSlabIds: string[];
  problems: QtyRatesProblem[];
  belowCostPolicy: BelowCostPolicy;
}
