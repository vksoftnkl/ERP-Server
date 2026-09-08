import type { StockErrorDetail, StockErrorResponse } from 'src/common/utils/module-service.utils';
import type { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';

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

/**
 * The two a SAVE may ask for, out of the five ck_svh_status allows.
 *
 * A save can leave a document as a draft, or save it and post it in one call.
 * It can never reach the other three: IN_TRANSIT and RECEIVED belong to the
 * transfer chain and are set by despatch and receipt, and CANCELLED is reached
 * by reversing a posted document — a status a save could assign would be a
 * cancellation with no reversal behind it.
 */
export const SAVEABLE_STOCK_VOUCHER_STATUSES = [
  'DRAFT',
  'POSTED',
] as const satisfies readonly StockVoucherStatus[];
export type SaveableStockVoucherStatus = (typeof SAVEABLE_STOCK_VOUCHER_STATUSES)[number];

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

/**
 * The rate sources the ENGINE can derive a cost from when the line carries none.
 *
 * MANUAL is deliberately absent, and that is the whole point of the set.
 * "Manual" means the storekeeper types the rate — there is nothing behind it for
 * fn_svh_post to read — so a MANUAL document whose line has cost 0 is an inward
 * valued at nothing, exactly the failure the zero-cost check exists to catch.
 * The plan's shorthand for that check is "inward with no cost rate and no rate
 * source", which reads as though any of the five excuses a zero; four of them
 * do, and treating MANUAL as the fifth would let the whole branch open at zero
 * value with the check reporting itself satisfied.
 */
export const DERIVABLE_RATE_SOURCES = [
  'AVG_COST',
  'LAST_PURCHASE',
  'LOT_COST',
  'MRP',
] as const satisfies readonly StockRateSource[];

/**
 * Every engine entry point a rule record may name, and the only values
 * `postFunction` may take.
 *
 * The name is interpolated into SQL through `Prisma.raw`, which does not
 * escape. It is a literal owned by a controller and no payload can reach it —
 * this list is what guarantees that stays true as rule records get copied.
 */
export const STOCK_POST_FUNCTIONS: readonly string[] = [
  'stock.fn_svh_post',
  'stock.fn_svh_post_transfer',
  'stock.fn_svh_receive_transfer',
];

/** The `svh_link_src_module` this module stamps on anything it raises. */
export const STOCK_SRC_MODULE = 'STOCK';

/**
 * What a LINE states.
 *
 * QTY   — the line states a quantity to MOVE (OPENING, RECEIPT, ISSUE …).
 *         `svi_qty` is the number, and it reaches the ledger as written.
 * COUNT — the line states what was FOUND. `svi_qty`, `svi_base_qty` and
 *         `svi_cost_rate` stay 0 for the whole document; the operator types
 *         `svi_counted_qty`, and `svi_diff_qty` — GENERATED as counted − book
 *         — is what reaches the ledger. Only PHYSICAL is COUNT today.
 *
 * This is not cosmetic. Under COUNT the zero-quantity refusal INVERTS: a rule
 * that reads "every line must have a quantity" refuses a count outright, one
 * error per line, at save.
 */
export const STOCK_QUANTITY_MODES = ['QTY', 'COUNT'] as const;
export type StockQuantityMode = (typeof STOCK_QUANTITY_MODES)[number];

/** The ledger txn types a PHYSICAL count posts — one document writes both. */
export const PHYSICAL_TXN_TYPES = ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'] as const;

/**
 * A count is valued in two directions by two different rules (§3.3 of the
 * physical plan), and only the OVERAGE side needs a rate from the document.
 * A shortage is relieved at what the stock cost us, stamped by
 * `fn_sml_cost_default` from the item's valuation policy — never by the
 * counter.
 */
export const PHYSICAL_DEFAULT_RATE_SOURCE: StockRateSource = 'AVG_COST';

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
  /**
   * Prefix of the printed refno — `OPN` in `OPN/2026-2027/TILL-01/1` — when
   * the type numbers itself. Ignored for the refno when `refnoVchrTypeId` is
   * set; still the type's short code in messages.
   */
  typeCode: string;
  /**
   * accounts.acc_voucher_types.vchr_type_id whose numbering format (prefix,
   * suffix, width, reset frequency) builds svh_refno through
   * accounts.acc_voucher_seq — `opn000000000001st` for the Opening Stock row.
   *
   * Absent means the self-contained `{typeCode}/{accYear}/{device}/{slno}`
   * scheme. svh_slno stays per device either way; only the printed number
   * moves to the branch-wide accounts counter, because ux_svh_refno is per
   * (company, branch, acc_year) and a per-device counter would let two tills
   * print the same number.
   */
  refnoVchrTypeId?: number;
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
   * The `sml_txn_type`s the ledger-side reports scan for in stock_ledger.
   *
   * NOT derivable from `voucherType`, and that is the trap this field exists to
   * close. The ledger's vocabulary is finer than the document's: an ADJUSTMENT
   * posts ADJUST_PLUS *or* ADJUST_MINUS, a PHYSICAL posts PHYSICAL_PLUS or
   * PHYSICAL_MINUS, and a RECEIPT posts PURCHASE. OPENING happens to be the one
   * type whose document and ledger names coincide — so a report that assumed
   * they always did would return an empty page for every other screen and look
   * like the answer rather than the bug.
   *
   * A LIST rather than a single value because PHYSICAL genuinely posts two, in
   * the same document: one line short, the next line over. A scalar here would
   * force every count report to pick a direction and silently drop the other.
   */
  ledgerTxnTypes: readonly string[];

  /**
   * QTY unless the type says otherwise — see StockQuantityMode.
   *
   * REQUIRED rather than defaulted, so the next five screens have to decide
   * what their lines state rather than inherit an answer that happens to suit
   * an opening.
   */
  quantityMode: StockQuantityMode;

  /**
   * Applied in createDraft / updateDraft when the header names no rateSource,
   * so the STORED document says out loud what it was valued at.
   *
   * AVG_COST for a count: found stock is worth what the rest of that item is
   * worth. MANUAL — the right default for an opening, where stock_item_cost is
   * empty — makes the engine refuse a count's overage line with
   * "is an inward with no cost rate; set one or set svh_rate_source".
   */
  defaultRateSource?: StockRateSource;

  /**
   * OPENING guards one opening per holding per year — a holding opened twice
   * is a branch that starts with twice its stock. A holding may be COUNTED any
   * number of times, each posting its own variance from the then-current book
   * figure, so the preflight's already-opened branch (and its expensive lot
   * lookup) must be off for a count.
   */
  allowsRepeatHolding?: boolean;

  /**
   * Whether this document type may send the PHYSICAL-only columns —
   * `bookQty` / `countedQty` on a line, and the `freezeStock` window on the
   * header.
   *
   * Gated rather than simply absent from the DTO because the DTO is SHARED by
   * all eleven types. An OPENING that sent a counted quantity would write
   * svi_counted_qty on a document that never counted anything, and
   * svi_diff_qty — GENERATED as counted minus book — would then post a variance
   * nobody entered. ck_svh_freeze likewise refuses a freeze with no window, so
   * a stray freezeStock on an opening fails at the database with a message
   * about a constraint rather than about the field.
   */
  allowsCount: boolean;

  /**
   * Whether this type may name `toBranchId`. Only a transfer leaves the branch;
   * on anything else it is a column that would make the document look like one.
   */
  allowsToBranch: boolean;

  /**
   * The engine function `post()` calls, schema-qualified.
   *
   * NOT derivable from `voucherType`, and pinning it here rather than branching
   * inside the service is what keeps the transfer screens out of `fn_svh_post`.
   * 19 refuses to post a TRANSFER_* by name (`0A000`), deliberately — so a
   * mis-wired record fails loudly at the first despatch instead of half-posting
   * a document the generic path does not know writes `stock_transit`.
   *
   * Three functions exist today:
   *   stock.fn_svh_post              OPENING, PHYSICAL, and the generic types
   *   stock.fn_svh_post_transfer     TRANSFER_OUT — writes the OUT ledger row
   *                                  and, inter-branch, the transit rows
   *   stock.fn_svh_receive_transfer  TRANSFER_IN — settles the transit rows
   */
  postFunction: string;

  /**
   * Whether a LINE names the lot it moves.
   *
   * THIS INVERTS AN EXISTING REFUSAL, which is why it is a rule and not a DTO
   * decorator. `fn_slt_resolve` owns lot identity on an OPENING — a
   * client-chosen lot there would let two documents open one holding under two
   * lots — so the service refuses a `lotId` on every QTY document today. A
   * TRANSFER does the opposite: it MOVES existing stock, the destination gets
   * the SAME `slt_id` so ageing does not reset, and `fn_slt_resolve` is never
   * called. A transfer line without a lot is refused by the engine forty lines
   * in with a `23502`; refused here it names the line.
   *
   * A COUNT also carries one, for a third reason again — its line comes off a
   * count sheet that already names the holding whose book figure it reconciles.
   */
  requiresLot?: boolean;

  /**
   * Whether the line's cost rate is STRIPPED before insert.
   *
   * Not "the client should not send one" — stripped, because on a transfer the
   * consequence of an honoured rate is a silently wrong ledger. A nonzero
   * `svi_cost_rate` makes `fn_sml_cost_default` bail (it only fills gaps) AND
   * `20_stock_transfer.sql`'s OUT insert omits the value columns, so the row
   * lands at that rate with **value 0** — reproduced in `REVIEW_2026-09-05.md`
   * as MUST-FIX 5. The policy cost is the only correct answer on a transfer:
   * cost travels with the stock and nobody re-enters it.
   *
   * A COUNT zeroes it too, for its own reason — see §3.3 of the physical plan.
   */
  zeroesLineCost?: boolean;

  /** The audit.audit_screen name rows from this controller are filed under. */
  auditScreenName: string;

  /**
   * The `tsl_src_doc_type` this screen's status trail is filed under in
   * public.txn_status_log.
   *
   * A RULE RATHER THAN A MAPPING OFF `voucherType`, because ck_tsl_src_doc_type
   * is a fourteen-value vocabulary shared with sales, purchase and accounts, and
   * only three of them describe a stock document at all: STOCK_TRANSFER,
   * STOCK_ADJUSTMENT and OTHER. Eleven voucher types have to land on three
   * values, so which one each takes is a business classification and not
   * something to be derived — an opening is filed as an adjustment because it
   * adjusts a holding from nothing to something, and a reader who disagrees can
   * change one line here rather than a switch buried in the service.
   */
  statusDocType: TxnStatusDocType;
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
  toBranchId: string | null;
  partyRef: string | null;
  linkSrcModule: string | null;
  linkSrcDocType: string | null;
  linkSrcDocId: string | null;
  linkSrcAccYear: string | null;
  syncDate: string | null;
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
  /**
   * The header reason every variance line inherits — a whole count explained
   * as "Shrinkage" without touching a line. NULL on every other type today.
   */
  reasonId: string | null;
  reasonName: string | null;
  /**
   * §11 — the freeze, and the only three columns a PHYSICAL uses alone.
   *
   * WALL CLOCK, NOT DOCUMENT DATE. tr_sml_freeze_guard compares the window to
   * now(): a back-dated entry still changes today's shelf. These are instants,
   * serialised with an offset.
   */
  freezeStock: boolean;
  freezeFrom: string | null;
  freezeTo: string | null;
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
  /** What the scanner read, verbatim. Echoed back, never resolved through. */
  barcode: string | null;
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
  weightQty: number;
  costRate: number;
  costRateWot: number;
  landedRate: number;
  taxPerc: number;
  syncDate: string | null;
  value: number;
  valueWot: number;
  /**
   * NULL while DRAFT and filled by the post — EXCEPT on a count, where it is
   * written at save because it is where the book figure came from. Not missing
   * data on the other types: it means "this line has not reached the ledger
   * yet", and the screen may render it as the tick that says it has. A count
   * screen must use `diffQty <> 0` plus POSTED for that instead.
   */
  lotId: string | null;

  // ── The count columns. NULL on every non-count line, and NULL is the ──────
  // ── right answer there: an opening line has no book figure to differ ──────
  // ── from. ────────────────────────────────────────────────────────────────
  /** Snapshot of stock_balance.sbl_on_hand_qty at save. Never refreshed. */
  bookQty: number | null;
  /** The one number the operator types. */
  countedQty: number | null;
  /**
   * GENERATED ALWAYS — counted − book. SIGNED, where every other quantity in
   * the engine is a magnitude, because it is not a quantity but a difference,
   * and it cannot be edited to zero to make a variance disappear.
   */
  diffQty: number | null;
  /** Per-line override of the header reason — the one pallet that was damaged. */
  reasonId: string | null;
  reasonName: string | null;
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

/**
 * What a save returns. `rowsPosted` is null when the save left a DRAFT and a
 * number when the same call posted it — the header carries the resulting status
 * and postedOn either way.
 */
export interface StockVoucherSaveResult extends StockVoucherPayload {
  rowsPosted: number | null;
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

/** §11 — what an import answers with: the reloaded document plus its verdict. */
export interface StockVoucherImportResult extends StockVoucherPayload {
  /** Data rows found in the file, blank rows excluded. */
  rowsRead: number;
  /** Lines actually written. Equal to rowsRead — a partial import is refused outright. */
  linesImported: number;
  /**
   * The §6 preflight, run immediately after the write. An import that resolved
   * cleanly can still produce lines the engine will refuse, and the operator
   * should see that in the same response rather than on a separate button.
   */
  problems: StockVoucherLineProblem[];
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

/**
 * §4 — one row of the GENERATED count sheet.
 *
 * The grain is `stock_balance`'s own: one line per godown × lot × bucket, NOT
 * per item. Two batches of MILK are two lines to count, because they are two
 * holdings.
 *
 * An item with NO balance row is not here, and must not be added: no book
 * quantity means no variance. Finding it on the shelf is an ADJUSTMENT.
 */
export interface StockCountSheetRow {
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  lotId: string;
  godownId: string;
  godownName: string | null;
  bucket: StockBucket;
  baseUomId: string;
  unitName: string | null;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  mrp: number | null;
  salePrice: number | null;
  serialNo: string | null;
  supplierId: string | null;
  /** sbl_on_hand_qty. The operator does not see it on a blind count. */
  bookQty: number;
  avgCostRate: number;
  stockValue: number;
  /** Always null — this is the column the screen fills. */
  countedQty: null;
}

/** §12 — the count as the LEDGER recorded it, which is not the document. */
export interface StockVarianceRow {
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  batchNo: string | null;
  txnType: string;
  direction: number;
  /** A MAGNITUDE — the sign lives in `direction` alone. */
  qty: number;
  signedBaseQty: number;
  costRate: number;
  costValue: number;
  reasonId: string | null;
  reasonName: string | null;
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
  /**
   * exclusion_violation — two rows claiming one bucket at one scope over one
   * overlapping period. `ex_smp_overlap` on stock.stock_mrp_price raises it
   * today; the transfer screens will meet it on their own range constraints.
   *
   * 409 rather than 422: the row being written is well formed, and the reason
   * it cannot land is the state of the table, not the content of the request.
   * A reload and a retry is the caller's fix, which is exactly what 409 means.
   */
  '23P01': 409,
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
