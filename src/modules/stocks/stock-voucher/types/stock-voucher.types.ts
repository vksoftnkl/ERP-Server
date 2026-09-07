import type { StockErrorDetail, StockErrorResponse } from 'src/common/utils/module-service.utils';

export type { StockErrorDetail, StockErrorResponse };

/**
 * The eleven members of ck_svh_voucher_type, as a TS union rather than a Prisma
 * enum. The column is `varchar + CHECK`, and a Prisma enum over a CHECK column
 * breaks silently the moment a twelfth value is added to the constraint — the
 * client keeps its stale member list and rejects rows the database accepts.
 */
export const STOCK_VOUCHER_TYPES = [
  'OPENING',
  'RECEIPT',
  'ISSUE',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'DAMAGE',
  'EXPIRY_WRITEOFF',
  'PHYSICAL',
  'REPACK_IN',
  'REPACK_OUT',
] as const;
export type StockVoucherType = (typeof STOCK_VOUCHER_TYPES)[number];

/** ck_svh_status. */
export const STOCK_VOUCHER_STATUSES = [
  'DRAFT',
  'POSTED',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELLED',
] as const;
export type StockVoucherStatus = (typeof STOCK_VOUCHER_STATUSES)[number];

/** ck_svi_bucket. */
export const STOCK_BUCKETS = [
  'SALEABLE',
  'DAMAGED',
  'QUARANTINE',
  'EXPIRED',
  'SAMPLE',
] as const;
export type StockBucket = (typeof STOCK_BUCKETS)[number];

/** ck_svh_rate_source. */
export const STOCK_RATE_SOURCES = [
  'AVG_COST',
  'LAST_PURCHASE',
  'LOT_COST',
  'MRP',
  'MANUAL',
] as const;
export type StockRateSource = (typeof STOCK_RATE_SOURCES)[number];

/** The `svh_link_src_module` this module stamps on anything it raises. */
export const STOCK_SRC_MODULE = 'STOCK';

/**
 * The per-type rules the shared service needs and that differ between the
 * eleven document types. One record per controller; the controller owns it, so
 * a payload can never reach in and change the type it is saved under.
 *
 * `requiresToGodown` / `requiresFromGodown` are checked BEFORE the engine sees
 * the document. ck_svh_godowns only demands that a movement names one side or
 * the other, so an OPENING with a from-godown and no to-godown satisfies the
 * constraint and then fails at post with a not_null_violation forty lines in.
 */
export interface StockVoucherTypeRules {
  voucherType: StockVoucherType;
  /** Prefix of the printed refno — `OPN` in `OPN/2026-2027/TILL-01/1`. */
  typeCode: string;
  /** Human name used in messages and the audit trail. */
  displayName: string;
  requiresToGodown: boolean;
  requiresFromGodown: boolean;
  /**
   * true when the movement brings stock IN, and therefore needs a cost — an
   * inward at rate 0 with no rate source values the whole holding at nothing.
   */
  isInward: boolean;
  /**
   * The `sml_txn_type` the two go-live reports scan for in stock_ledger.
   *
   * NOT derivable from `voucherType`, and that is the trap this field exists to
   * close. The ledger's vocabulary is finer than the document's: an ADJUSTMENT
   * posts ADJUST_PLUS *or* ADJUST_MINUS, a PHYSICAL posts PHYSICAL_PLUS or
   * PHYSICAL_MINUS, and a RECEIPT posts PURCHASE. OPENING happens to be the one
   * type whose document and ledger names coincide — so a report that assumed
   * they always did would return an empty page for every other screen and look
   * like the answer rather than the bug.
   */
  ledgerTxnType: string;

  /** The audit.audit_screen name rows from this controller are filed under. */
  auditScreenName: string;
  /**
   * Voucher types this route must refuse outright even if some future caller
   * hands them in. TRANSFER_* and REPACK_* post through their own routes
   * because they write stock_transit / a paired document that this service
   * knows nothing about.
   */
  refuseTypes?: readonly StockVoucherType[];
}

/** One line's worth of preflight verdict — §6. `problem` null means clean. */
export interface StockVoucherLineProblem {
  sviId: string;
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  problem: string | null;
}

export interface StockVoucherHeaderPayload {
  svhId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  deviceId: string;
  sessionId: string | null;
  voucherType: StockVoucherType;
  slno: string;
  refno: string;
  usrRefno: string | null;
  docDate: string;
  docDatetime: string;
  fromGodownId: string | null;
  fromGodownName: string | null;
  godownId: string | null;
  godownName: string | null;
  supplierId: string | null;
  status: StockVoucherStatus;
  lineCount: number;
  totalQty: number;
  totalValue: number;
  totalValueWot: number;
  postedOn: string | null;
  postedBy: string | null;
  postedByName: string | null;
  cancelledOn: string | null;
  cancelReason: string | null;
  rateSource: StockRateSource | null;
  remarks: string | null;
  isDeleted: boolean;
}

export interface StockVoucherLinePayload {
  sviId: string;
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  uomId: string;
  baseUomId: string;
  toBaseFactor: number;
  godownId: string;
  godownName: string | null;
  bucket: StockBucket;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  mrp: number | null;
  salePrice: number | null;
  serialNo: string | null;
  supplierId: string | null;
  qty: number;
  baseQty: number;
  freeQty: number;
  freeBaseQty: number;
  costRate: number;
  costRateWot: number;
  taxPerc: number;
  value: number;
  valueWot: number;
  /**
   * NULL while DRAFT and filled by the post. Not missing data — it means "this
   * line has not reached the ledger yet".
   */
  lotId: string | null;
  remarks: string | null;
}

export interface StockVoucherPayload {
  header: StockVoucherHeaderPayload;
  lines: StockVoucherLinePayload[];
}

export interface StockVoucherListItem {
  svhId: string;
  accYear: string;
  refno: string;
  usrRefno: string | null;
  docDate: string;
  godownId: string | null;
  godownName: string | null;
  status: StockVoucherStatus;
  lineCount: number;
  totalQty: number;
  totalValue: number;
  totalValueWot: number;
  postedOn: string | null;
  rateSource: StockRateSource | null;
  remarks: string | null;
}

export interface StockVoucherListResult {
  items: StockVoucherListItem[];
  meta: { limit: number; offset: number; count: number };
}

export interface StockVoucherPostResult extends StockVoucherPayload {
  rowsPosted: number;
  status: StockVoucherStatus;
  postedOn: string | null;
}

export interface StockVoucherCancelResult extends StockVoucherPayload {
  rowsReversed: number;
  status: StockVoucherStatus;
  cancelledOn: string | null;
}

export interface StockVoucherDeleteResult {
  svhId: string;
  accYear: string;
  deleted: true;
}

export interface StockVoucherSuccessResponse<TData> {
  success: true;
  message: string;
  data: TData;
}

/** Q4 — every stockable item with no OPENING movement in this branch and year. */
export interface PendingOpeningItem {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  baseUomId: string | null;
  unitName: string | null;
  trackSignature: string | null;
}

/** Q5 — what the branch started with, what it holds now, the difference. */
export interface OpeningReconcileRow {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  openingQty: number;
  openingValue: number;
  currentQty: number;
  currentValue: number;
  diffQty: number;
  diffValue: number;
}

export interface PagedResult<TRow> {
  items: TRow[];
  meta: { limit: number; offset: number; count: number };
}

/**
 * The SQLSTATE → HTTP map of §12 of the plan.
 *
 * THE TRAP this exists for: a RAISE from inside a PL/pgSQL function does not
 * reach Prisma as its own SQLSTATE. It arrives as a
 * PrismaClientKnownRequestError whose `code` is **P2010** for every one of
 * these, with the real SQLSTATE in `error.meta.code` and the engine's text in
 * `error.meta.message`. A filter that switches on `error.code` therefore sees
 * one value for eight distinct failures and answers with one useless message.
 */
export const STOCK_ENGINE_SQLSTATE_STATUS: Readonly<Record<string, number>> = {
  /** no_data_found — voucher / year not found. */
  P0002: 404,
  /** restrict_violation — deleted; not DRAFT; not POSTED. */
  '23001': 409,
  /** unique_violation — holding already opened this year; refno/slno collision. */
  '23505': 409,
  /** check_violation — no quantity; inward with no cost rate; no lines. */
  '23514': 422,
  /** not_null_violation — an OPENING with no svh_to_godown_id. */
  '23502': 422,
  /** foreign_key_violation — bad item / uom / godown / device. */
  '23503': 422,
  /** feature_not_supported — TRANSFER_* / REPACK_* posted through this route. */
  '0A000': 409,
};

/**
 * fn_sml_apply refuses to drive a holding negative under
 * stp_allow_negative = 'BLOCK'. That is correct behaviour — cancelling an
 * opening after stock has been sold from it SHOULD fail — so it is a 409 that
 * names the item, not a 500. The engine raises it as a check_violation, which
 * would otherwise map to 422; this fragment is what tells the two apart.
 */
export const NEGATIVE_STOCK_MESSAGE_FRAGMENT = 'would go negative';
