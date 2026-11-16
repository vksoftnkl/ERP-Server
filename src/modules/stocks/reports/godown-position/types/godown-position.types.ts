/**
 * Response shapes of stock/reports/godown-position (delivery tracking plan
 * §8.3, menu 306). Quantities are STRINGS with three decimals in the Qty-in
 * unit (the item's selling unit by default, Q16), weights strings with three
 * decimals in kg — never a float. Today only.
 */

/** "Reports › Stock Reports › Godown Stock Position" (migration 20261117100000_delivery_tracking). */
export const GODOWN_POSITION_MENU_ID = 306;

/** assertMenuRight builds `<prefix>_RIGHT_VIEW / _PRINT / _EXPORT` from this. */
export const GODOWN_POSITION_CODE_PREFIX = 'GODOWN_POSITION';

/**
 * The refusals. The branch / group / brand / item ones reuse the Stock
 * Summary's codes and wording (menu 306 shares its filter popup); only the
 * godown one is this report's own (plan §7.10).
 */
export const GODOWN_POSITION_ERROR = {
  RIGHT_VIEW: 'GODOWN_POSITION_RIGHT_VIEW',
  RIGHT_PRINT: 'GODOWN_POSITION_RIGHT_PRINT',
  RIGHT_EXPORT: 'GODOWN_POSITION_RIGHT_EXPORT',
  GODOWN_NOT_IN_BRANCH: 'GODOWN_POSITION_GODOWN_NOT_IN_BRANCH',
  BRANCH_NOT_IN_COMPANY: 'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY',
  GROUP_NOT_FOUND: 'STOCK_SUMMARY_GROUP_NOT_FOUND',
  BRAND_NOT_FOUND: 'STOCK_SUMMARY_BRAND_NOT_FOUND',
  ITEM_NOT_FOUND: 'STOCK_SUMMARY_ITEM_NOT_FOUND',
} as const;

export const POSITION_QTY_IN = ['SELLING', 'BASE'] as const;
export type PositionQtyIn = (typeof POSITION_QTY_IN)[number];

export const POSITION_BUCKETS = [
  'SALEABLE',
  'DAMAGED',
  'QUARANTINE',
  'EXPIRED',
  'SAMPLE',
  'ALL',
] as const;
export type PositionBucket = (typeof POSITION_BUCKETS)[number];

export const BEHIND_KINDS = ['BND', 'CHALLAN'] as const;
export type BehindKind = (typeof BEHIND_KINDS)[number];

export interface PositionRights {
  view: boolean;
  print: boolean;
  export: boolean;
}

export interface PositionHead {
  companyId: string;
  companyName: string | null;
  branchId: string;
  branchName: string | null;
  godownId: string | null;
  /** null = all godowns of the branch. */
  godownName: string | null;
  groupId: string | null;
  groupName: string | null;
  brandId: string | null;
  brandName: string | null;
  /** IST, 12-hour: "15/11/2026 07:42 PM". */
  asOf: string;
  /** YYYY-MM-DD (IST). */
  today: string;
  qtyIn: PositionQtyIn;
  bucket: PositionBucket;
  onlyToGive: boolean;
  hideZero: boolean;
  find: string;
}

export interface KgPkgs {
  kg: string;
  pkgs: string;
}

export interface PositionTiles {
  physical: KgPkgs & { rows: number };
  billedNotDelivered: KgPkgs & { bills: number };
  owned: KgPkgs;
  reserved: KgPkgs & { items: number };
  short: {
    items: number;
    first: {
      itemId: string;
      itemName: string;
      godownId: string;
      godownName: string | null;
      unitName: string;
      physical: string;
      billedNotDelivered: string;
    } | null;
  };
  challanOut: KgPkgs & { challans: number };
}

export interface LastGiven {
  refno: string | null;
  /** YYYY-MM-DD (IST). */
  date: string;
  sdnId: string | null;
  accYear: string | null;
}

export interface PositionRow {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  godownId: string;
  godownName: string | null;
  unitName: string;
  /** To-base factor of the Qty-in unit, 6 dp. */
  unitFactor: string;
  /** Owned + Billed not delivered. */
  physical: string;
  billedNotDelivered: string;
  /** stock_balance on hand. */
  owned: string;
  reserved: string;
  /** stock_balance available = Owned − Reserved. */
  freeToSell: string;
  /** Phase 2 (POD); always null now. */
  onVehicle: string | null;
  challanOut: string;
  physicalKg: string;
  lastGiven: LastGiven | null;
  /** Billed not delivered − Physical when positive (the books are below 0), else "0.000". */
  short: string;
  /** Σ of over-given pending (decision 46), as a positive qty; "0.000" when none. */
  overGiven: string;
  /** Physical = Owned + BND, and BND read from line quantities = BND read from the event base columns. */
  tie: boolean;
}

export interface PositionTotals {
  physicalKg: string;
  bndKg: string;
  ownedKg: string;
  reservedKg: string;
  freeKg: string;
  challanKg: string;
  rows: number;
  /** Every row ties. */
  tie: boolean;
}

export interface PositionPayload {
  head: PositionHead;
  tiles: PositionTiles;
  rows: PositionRow[];
  totals: PositionTotals;
  rights: PositionRights;
}

export interface BehindBillRow {
  billId: string;
  billAccYear: string;
  billRefno: string | null;
  billDate: string | null;
  days: number | null;
  custId: string | null;
  custName: string | null;
  areaName: string | null;
  mode: string;
  billItemId: string;
  lineNo: number;
  lotId: string | null;
  lotNo: string | null;
  billed: string;
  given: string;
  pending: string;
  lastGiven: LastGiven | null;
}

export interface BehindChallanRow {
  dcId: string;
  dcAccYear: string;
  dcRefno: string | null;
  dcDate: string | null;
  days: number | null;
  custId: string | null;
  custName: string | null;
  open: string;
  total: string;
}

export interface BehindLot {
  lotId: string | null;
  lotNo: string | null;
  owned: string;
  notDelivered: string;
  physical: string;
}

export interface BehindPayload {
  kind: BehindKind;
  itemId: string;
  itemName: string;
  godownId: string;
  godownName: string | null;
  unitName: string;
  unitFactor: string;
  rows: BehindBillRow[] | BehindChallanRow[];
  /** Σ pending (BND) or Σ open (CHALLAN) of the rows, Qty-in unit. */
  total: string;
  byLot: BehindLot[];
  sum: {
    owned: string;
    billedNotDelivered: string;
    physical: string;
    reserved: string;
    freeToSell: string;
  };
}

export interface PositionExportPayload {
  head: PositionHead;
  /** The applied filters as one sentence (the CSV's first line, the print heading). */
  printedAs: string;
  tiles: PositionTiles;
  rows: PositionRow[];
  totals: PositionTotals;
  totalRows: number;
}
