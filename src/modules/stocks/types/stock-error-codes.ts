/**
 * Notes 119 / 127 §5 — every refusal the stocks module (src/modules/stocks)
 * answers with carries one of these in `errors[].code`. The Qt client words its
 * box by the code alone, so a code is never reused for a different meaning;
 * every site with the SAME meaning shares one.
 *
 * One enum for the whole module — vouchers (opening, physical, adjustment
 * family, transfers), stock reasons, the CSV import, the posting engine,
 * selling prices, the balance reads and the track presets.
 */
export enum StockErrorCode {
  // ── a stock voucher: the document itself ──────────────────────────────────
  /** No stock voucher of this type with that id in that year (for this company/branch). */
  VOUCHER_NOT_FOUND = 'STOCK_VOUCHER_NOT_FOUND',
  /** The voucher has been soft-deleted; it cannot be edited or posted. */
  VOUCHER_DELETED = 'STOCK_VOUCHER_DELETED',
  /** Edit/post on a voucher that is not a DRAFT — a posted document accepts only cancel and print. */
  VOUCHER_NOT_DRAFT = 'STOCK_VOUCHER_NOT_DRAFT',
  /** Cancel on a voucher that is already cancelled. */
  VOUCHER_ALREADY_CANCELLED = 'STOCK_VOUCHER_ALREADY_CANCELLED',
  /** Cancel on a DRAFT, which has moved no stock — delete it instead. */
  VOUCHER_DRAFT_NOT_CANCELLABLE = 'STOCK_VOUCHER_DRAFT_NOT_CANCELLABLE',
  /** Delete on a voucher that is posted (has ledger rows) or already cancelled — cancel it instead. */
  VOUCHER_NOT_DELETABLE = 'STOCK_VOUCHER_NOT_DELETABLE',
  /** The voucher's status changed while the post/cancel waited for its lock — reload and decide again. */
  VOUCHER_STATUS_CHANGED = 'STOCK_VOUCHER_STATUS_CHANGED',
  /** Cancel sent without a reason. */
  CANCEL_REASON_REQUIRED = 'STOCK_CANCEL_REASON_REQUIRED',
  /** This voucher type cannot be saved through the route that was called. */
  VOUCHER_TYPE_NOT_ALLOWED = 'STOCK_VOUCHER_TYPE_NOT_ALLOWED',
  /** The document must name the godown the stock arrives in (to-godown). */
  TO_GODOWN_REQUIRED = 'STOCK_TO_GODOWN_REQUIRED',
  /** The document must name the godown the stock leaves from (from-godown). */
  FROM_GODOWN_REQUIRED = 'STOCK_FROM_GODOWN_REQUIRED',
  /** A to-branch on a document that does not leave the branch (only a transfer names one). */
  TO_BRANCH_NOT_ALLOWED = 'STOCK_TO_BRANCH_NOT_ALLOWED',
  /** The four source-document link fields are partly filled — all four or none. */
  LINK_INCOMPLETE = 'STOCK_LINK_INCOMPLETE',
  /** A document with no lines. */
  LINES_REQUIRED = 'STOCK_LINES_REQUIRED',
  /** Notes 143 #6 — the document date falls in another accounting year than the one it is filed under. */
  DOC_DATE_OUTSIDE_YEAR = 'STOCK_DOC_DATE_OUTSIDE_YEAR',
  /** Notes 143 #10 — the next 1000 numbers of the refno series are all taken; move the series on. */
  REFNO_SERIES_EXHAUSTED = 'STOCK_REFNO_SERIES_EXHAUSTED',
  /** A freeze on a document that is not a physical count. */
  FREEZE_NOT_ALLOWED = 'STOCK_FREEZE_NOT_ALLOWED',
  /** A stock freeze without both freezeFrom and freezeTo. */
  FREEZE_WINDOW_REQUIRED = 'STOCK_FREEZE_WINDOW_REQUIRED',
  /** freezeTo is not after freezeFrom. */
  FREEZE_WINDOW_ORDER = 'STOCK_FREEZE_WINDOW_ORDER',
  /** A godown is frozen for a physical count over the movement's time — post or cancel the count first. */
  GODOWN_FROZEN = 'STOCK_GODOWN_FROZEN',
  /** The device the document is raised on has no device_master row. */
  DEVICE_NOT_FOUND = 'STOCK_DEVICE_NOT_FOUND',
  /** The device the document is raised on is blocked or inactive. */
  DEVICE_BLOCKED = 'STOCK_DEVICE_BLOCKED',

  // ── a stock voucher: its lines ────────────────────────────────────────────
  /** Two lines share one line number + split number. */
  LINE_DUPLICATE = 'STOCK_LINE_DUPLICATE',
  /** A quantity or free quantity below zero (quantities are magnitudes). */
  LINE_QTY_NEGATIVE = 'STOCK_LINE_QTY_NEGATIVE',
  /** A line with no quantity. */
  LINE_QTY_REQUIRED = 'STOCK_LINE_QTY_REQUIRED',
  /** A line that names no unit (uomId). */
  LINE_UNIT_REQUIRED = 'STOCK_LINE_UNIT_REQUIRED',
  /** Notes 143 #3 — baseQty is not qty × toBaseFactor (at numeric(18,6)). */
  LINE_BASE_QTY_MISMATCH = 'STOCK_LINE_BASE_QTY_MISMATCH',
  /** Notes 143 #3 — freeBaseQty (0 when omitted) is not freeQty × toBaseFactor. */
  LINE_FREE_BASE_QTY_MISMATCH = 'STOCK_LINE_FREE_BASE_QTY_MISMATCH',
  /** A per-line direction on a document that is not a stock adjustment. */
  LINE_DIRECTION_NOT_ALLOWED = 'STOCK_LINE_DIRECTION_NOT_ALLOWED',
  /** A line that must name its lot (transfer, move, write-off, despatch …) names none. */
  LINE_LOT_REQUIRED = 'STOCK_LINE_LOT_REQUIRED',
  /** A line chooses its own lot on a document whose lot the engine resolves. */
  LINE_LOT_NOT_ALLOWED = 'STOCK_LINE_LOT_NOT_ALLOWED',
  /** A negative weight. */
  LINE_WEIGHT_NEGATIVE = 'STOCK_LINE_WEIGHT_NEGATIVE',
  /** A split line (split > 1) with no batch number. */
  LINE_SPLIT_BATCH_REQUIRED = 'STOCK_LINE_SPLIT_BATCH_REQUIRED',
  /** Expiry date before the manufacture date. */
  LINE_EXPIRY_BEFORE_MFG = 'STOCK_LINE_EXPIRY_BEFORE_MFG',
  /** A cost rate on a line whose cost the engine stamps (e.g. a transfer). */
  LINE_COST_NOT_ALLOWED = 'STOCK_LINE_COST_NOT_ALLOWED',
  /** Stock brought in at cost 0 with no rate source that can derive a cost — type the cost. */
  LINE_COST_REQUIRED = 'STOCK_LINE_COST_REQUIRED',
  /** At post, an inward line's cost resolved to 0 from its rate source. */
  LINE_COST_UNRESOLVED = 'STOCK_LINE_COST_UNRESOLVED',
  /** A line sends a line id (sviId) on a new document. */
  LINE_ID_ON_NEW = 'STOCK_LINE_ID_ON_NEW',
  /** Two lines send the same line id. */
  LINE_ID_REPEATED = 'STOCK_LINE_ID_REPEATED',
  /** A line id that is no longer a line of this document — reload and save again. */
  LINE_ID_STALE = 'STOCK_LINE_ID_STALE',
  /** The post preflight found a problem on a line (the message says which). */
  LINE_NOT_POSTABLE = 'STOCK_LINE_NOT_POSTABLE',
  /** A line names a lot that does not exist. */
  LOT_NOT_FOUND = 'STOCK_LOT_NOT_FOUND',
  /** A line names a lot that belongs to another company. */
  LOT_OTHER_COMPANY = 'STOCK_LOT_OTHER_COMPANY',
  /** A line names a lot that belongs to a different item. */
  LOT_OTHER_ITEM = 'STOCK_LOT_OTHER_ITEM',
  /** A line takes more of a lot than the godown holds in that bucket. */
  INSUFFICIENT_STOCK = 'STOCK_INSUFFICIENT_STOCK',
  /** The movement would drive a holding negative and the item's policy is BLOCK. */
  NEGATIVE_BLOCKED = 'STOCK_NEGATIVE_BLOCKED',
  /**
   * A price save (Change Selling Price, menu 30, or the quick rate popup) by a
   * user without Edit on menu 30. Built by assertMenuRight as STOCK_PRICE_RIGHT_EDIT.
   */
  PRICE_RIGHT_EDIT = 'STOCK_PRICE_RIGHT_EDIT',
  /**
   * Notes 143 #4 — cancelling a stock voucher would drive a holding negative:
   * the stock it brought in has since moved out. Refused whatever the item's
   * policy; the fix is an adjustment, then the cancel.
   */
  CANCEL_WOULD_GO_NEGATIVE = 'STOCK_CANCEL_WOULD_GO_NEGATIVE',
  /** The item's issue strategy is MANUAL, so an outward line must name its lot. */
  PICK_MANUAL_LOT_REQUIRED = 'STOCK_PICK_MANUAL_LOT_REQUIRED',
  /** An outward line names no lot and the godown holds no matching stock to pick from. */
  PICK_NO_STOCK = 'STOCK_PICK_NO_STOCK',

  // ── buckets / "Move stock" ────────────────────────────────────────────────
  /** A stock move line names no bucket to move to. */
  MOVE_TO_BUCKET_REQUIRED = 'STOCK_MOVE_TO_BUCKET_REQUIRED',
  /** A stock move line moves stock into the bucket it is already in. */
  MOVE_SAME_BUCKET = 'STOCK_MOVE_SAME_BUCKET',
  /** A destination bucket on a document that is not a stock move. */
  TO_BUCKET_NOT_ALLOWED = 'STOCK_TO_BUCKET_NOT_ALLOWED',

  // ── physical count ────────────────────────────────────────────────────────
  /** bookQty/countedQty on a document that is not a physical count. */
  COUNT_FIELDS_NOT_ALLOWED = 'STOCK_COUNT_FIELDS_NOT_ALLOWED',
  /** A count line names a unit (a count is taken in the base unit). */
  COUNT_UNIT_NOT_ALLOWED = 'STOCK_COUNT_UNIT_NOT_ALLOWED',
  /** A count line sends a quantity to move instead of countedQty. */
  COUNT_QTY_NOT_ALLOWED = 'STOCK_COUNT_QTY_NOT_ALLOWED',
  /** A count line carries a cost rate. */
  COUNT_COST_NOT_ALLOWED = 'STOCK_COUNT_COST_NOT_ALLOWED',
  /** A count line sends its own book quantity. */
  COUNT_BOOK_QTY_NOT_ALLOWED = 'STOCK_COUNT_BOOK_QTY_NOT_ALLOWED',
  /** A count line has not been counted yet (no countedQty). */
  COUNT_NOT_COUNTED = 'STOCK_COUNT_NOT_COUNTED',
  /** A negative countedQty. */
  COUNT_QTY_NEGATIVE = 'STOCK_COUNT_QTY_NEGATIVE',
  /** A count line names no holding (lotId) — it must come from the count sheet. */
  COUNT_HOLDING_REQUIRED = 'STOCK_COUNT_HOLDING_REQUIRED',
  /** A count line is in a different godown than the count names. */
  COUNT_GODOWN_MISMATCH = 'STOCK_COUNT_GODOWN_MISMATCH',
  /** A count line's holding is gone from the godown — regenerate the count sheet. */
  COUNT_HOLDING_GONE = 'STOCK_COUNT_HOLDING_GONE',
  /** A count line's holding belongs to another item — regenerate the count sheet. */
  COUNT_HOLDING_OTHER_ITEM = 'STOCK_COUNT_HOLDING_OTHER_ITEM',
  /** A count sheet asked for on a document type that is not a physical count. */
  COUNT_SHEET_WRONG_TYPE = 'STOCK_COUNT_SHEET_WRONG_TYPE',

  // ── stock reasons ─────────────────────────────────────────────────────────
  /** No stock reason with that id visible to this company. */
  REASON_NOT_FOUND = 'STOCK_REASON_NOT_FOUND',
  /** The cited stock reason is inactive. */
  REASON_INACTIVE = 'STOCK_REASON_INACTIVE',
  /** The cited stock reason may not be used by this document type. */
  REASON_NOT_ALLOWED = 'STOCK_REASON_NOT_ALLOWED',
  /** The cited stock reason requires a remark and none was given. */
  REASON_REMARK_REQUIRED = 'STOCK_REASON_REMARK_REQUIRED',
  /** The cited reason brings stock IN where the stock must go OUT (e.g. a transit short). */
  REASON_WRONG_DIRECTION = 'STOCK_REASON_WRONG_DIRECTION',
  /** Saving a reason with a GL ledger that does not exist. */
  REASON_LEDGER_NOT_FOUND = 'STOCK_REASON_LEDGER_NOT_FOUND',
  /** Changing or deactivating a reason shared with every company (read-only here). */
  REASON_SHARED_READ_ONLY = 'STOCK_REASON_SHARED_READ_ONLY',
  /** Changing the code of a reason the ledger already cites. */
  REASON_CODE_LOCKED = 'STOCK_REASON_CODE_LOCKED',
  /** The company already has a reason with this code. */
  REASON_CODE_TAKEN = 'STOCK_REASON_CODE_TAKEN',

  // ── the adjustment family (adjustment, issue, damage, expiry write-off, move, re-lot) ─
  /** No adjustment-family voucher with that id for this company and branch. */
  ADJ_NOT_FOUND = 'STOCK_ADJ_NOT_FOUND',
  /** The voucher is another module's stock movement (a sale bill's, a challan's), not an adjustment. */
  ADJ_OTHER_MODULE_DOC = 'STOCK_ADJ_OTHER_MODULE_DOC',
  /** An adjustment saved with another module's link (linkSrcModule). */
  ADJ_FOREIGN_LINK = 'STOCK_ADJ_FOREIGN_LINK',
  /** An adjustment that names no godown. */
  ADJ_GODOWN_REQUIRED = 'STOCK_ADJ_GODOWN_REQUIRED',
  /** An adjustment or move that names two different godowns — one document, one godown. */
  ADJ_ONE_GODOWN = 'STOCK_ADJ_ONE_GODOWN',
  /** An adjustment line in a different godown from the document's. */
  ADJ_LINE_OTHER_GODOWN = 'STOCK_ADJ_LINE_OTHER_GODOWN',
  /** An adjustment line carries a free quantity. */
  ADJ_FREE_QTY_NOT_ALLOWED = 'STOCK_ADJ_FREE_QTY_NOT_ALLOWED',
  /** An adjustment line has no quantity. */
  ADJ_QTY_REQUIRED = 'STOCK_ADJ_QTY_REQUIRED',
  /** A stock move line keyed with a negative quantity. */
  ADJ_MOVE_QTY_NEGATIVE = 'STOCK_ADJ_MOVE_QTY_NEGATIVE',
  /** An adjustment line names no reason, and the header names none either. */
  ADJ_REASON_REQUIRED = 'STOCK_ADJ_REASON_REQUIRED',
  /** A stock move cites a reason that is not a stock-move reason. */
  ADJ_MOVE_REASON_REQUIRED = 'STOCK_ADJ_MOVE_REASON_REQUIRED',
  /** A non-move document cites a stock-move-only reason — key it as Move stock. */
  ADJ_MOVE_REASON_NOT_ALLOWED = 'STOCK_ADJ_MOVE_REASON_NOT_ALLOWED',
  /** An outward-only document (issue, damage, write-off) cites a reason that brings stock IN. */
  ADJ_REASON_INWARD = 'STOCK_ADJ_REASON_INWARD',
  /** An IN reason cited with a negative quantity. */
  ADJ_REASON_SIGN_MISMATCH = 'STOCK_ADJ_REASON_SIGN_MISMATCH',
  /** A BOTH-direction reason cited with an unsigned quantity (+ in, − out). */
  ADJ_QTY_SIGN_REQUIRED = 'STOCK_ADJ_QTY_SIGN_REQUIRED',
  /** An expiry write-off of a lot with no expiry date — use a damage write-off. */
  ADJ_LOT_NO_EXPIRY = 'STOCK_ADJ_LOT_NO_EXPIRY',
  /** An expiry write-off of a lot that has not expired yet — use a damage write-off. */
  ADJ_LOT_NOT_EXPIRED = 'STOCK_ADJ_LOT_NOT_EXPIRED',
  /** The OUT half of a re-lot names no lot. */
  ADJ_RELOT_OUT_LOT_REQUIRED = 'STOCK_ADJ_RELOT_OUT_LOT_REQUIRED',
  /** A re-lot whose OUT and IN quantities differ for an item. */
  ADJ_RELOT_UNBALANCED = 'STOCK_ADJ_RELOT_UNBALANCED',
  /** A re-lot that moves stock from a lot back into the same lot. */
  ADJ_RELOT_SAME_LOT = 'STOCK_ADJ_RELOT_SAME_LOT',
  /** The halves of a re-lot are keyed in different base units. */
  ADJ_RELOT_UNIT_MISMATCH = 'STOCK_ADJ_RELOT_UNIT_MISMATCH',

  // ── transfers (despatch, receipt, short-settle) ───────────────────────────
  /** A within-branch transfer whose source and destination godowns are the same. */
  TRANSFER_SAME_GODOWN = 'STOCK_TRANSFER_SAME_GODOWN',
  /** An inter-branch transfer with two lines of one item, lot and bucket (they would become one transit row). */
  TRANSFER_LINE_CLASH = 'STOCK_TRANSFER_LINE_CLASH',
  /** An inter-branch transfer ships one item and lot in two buckets. */
  TRANSFER_MIXED_BUCKETS = 'STOCK_TRANSFER_MIXED_BUCKETS',
  /** No such despatch (TRANSFER_OUT). */
  TRANSFER_NOT_FOUND = 'STOCK_TRANSFER_NOT_FOUND',
  /** The despatch was deleted by the sending branch. */
  TRANSFER_DELETED = 'STOCK_TRANSFER_DELETED',
  /** The despatch was sent to another branch. */
  TRANSFER_OTHER_BRANCH = 'STOCK_TRANSFER_OTHER_BRANCH',
  /** The despatch is not in transit (already received, or never despatched). */
  TRANSFER_NOT_IN_TRANSIT = 'STOCK_TRANSFER_NOT_IN_TRANSIT',
  /** Short-settle on a despatch nothing of which has been received yet. */
  TRANSFER_NOTHING_RECEIVED = 'STOCK_TRANSFER_NOTHING_RECEIVED',
  /** Cancel of a despatch whose goods have left — receive and transfer back, or short-settle. */
  TRANSFER_NOT_CANCELLABLE = 'STOCK_TRANSFER_NOT_CANCELLABLE',
  /** A receipt that names no despatch. */
  RECEIPT_NO_TRANSFER = 'STOCK_RECEIPT_NO_TRANSFER',
  /** A receipt with no lines (nothing arrived is not a receipt). */
  RECEIPT_LINES_REQUIRED = 'STOCK_RECEIPT_LINES_REQUIRED',
  /** A receipt line for which nothing of that lot is in transit to that godown. */
  RECEIPT_NOT_IN_TRANSIT = 'STOCK_RECEIPT_NOT_IN_TRANSIT',
  /** A receipt line whose item and lot were shipped in more than one bucket. */
  RECEIPT_BUCKET_AMBIGUOUS = 'STOCK_RECEIPT_BUCKET_AMBIGUOUS',
  /** A receipt line received in a different bucket than it was shipped (other than DAMAGED). */
  RECEIPT_BUCKET_CHANGED = 'STOCK_RECEIPT_BUCKET_CHANGED',
  /** A receipt claims more than is still in transit. */
  RECEIPT_OVER_REMAINING = 'STOCK_RECEIPT_OVER_REMAINING',
  /** Cancel of a posted receipt — un-receiving is a reverse transfer. */
  RECEIPT_NOT_CANCELLABLE = 'STOCK_RECEIPT_NOT_CANCELLABLE',

  // ── CSV import ────────────────────────────────────────────────────────────
  /** No file was uploaded. */
  IMPORT_FILE_MISSING = 'STOCK_IMPORT_FILE_MISSING',
  /** The uploaded file is over the size limit. */
  IMPORT_FILE_TOO_LARGE = 'STOCK_IMPORT_FILE_TOO_LARGE',
  /** The file is empty, or has a header row but no data rows. */
  IMPORT_FILE_EMPTY = 'STOCK_IMPORT_FILE_EMPTY',
  /** The file is missing required columns. */
  IMPORT_COLUMNS_MISSING = 'STOCK_IMPORT_COLUMNS_MISSING',
  /** The document has no godown and a row names none. */
  IMPORT_NO_GODOWN = 'STOCK_IMPORT_NO_GODOWN',
  /** A row's item code matches no item. */
  IMPORT_ITEM_NOT_FOUND = 'STOCK_IMPORT_ITEM_NOT_FOUND',
  /** A row's item code matches more than one item. */
  IMPORT_ITEM_AMBIGUOUS = 'STOCK_IMPORT_ITEM_AMBIGUOUS',
  /** A row's unit is not one of the item's units. */
  IMPORT_UNIT_NOT_FOUND = 'STOCK_IMPORT_UNIT_NOT_FOUND',
  /** A row's unit name matches more than one of the item's conversions. */
  IMPORT_UNIT_AMBIGUOUS = 'STOCK_IMPORT_UNIT_AMBIGUOUS',
  /** The row's item has no base unit. */
  IMPORT_NO_BASE_UNIT = 'STOCK_IMPORT_NO_BASE_UNIT',
  /** A row's unit has no usable conversion factor. */
  IMPORT_UNIT_FACTOR_INVALID = 'STOCK_IMPORT_UNIT_FACTOR_INVALID',
  /** A row's godown matches no godown in this branch. */
  IMPORT_GODOWN_NOT_FOUND = 'STOCK_IMPORT_GODOWN_NOT_FOUND',
  /** A row's godown matches more than one godown. */
  IMPORT_GODOWN_AMBIGUOUS = 'STOCK_IMPORT_GODOWN_AMBIGUOUS',
  /** A row's supplier matches no supplier. */
  IMPORT_SUPPLIER_NOT_FOUND = 'STOCK_IMPORT_SUPPLIER_NOT_FOUND',
  /** A row's supplier matches more than one supplier. */
  IMPORT_SUPPLIER_AMBIGUOUS = 'STOCK_IMPORT_SUPPLIER_AMBIGUOUS',
  /** A row's quantity is not a number. */
  IMPORT_QTY_INVALID = 'STOCK_IMPORT_QTY_INVALID',
  /** A row's cost rate is not a number. */
  IMPORT_COST_INVALID = 'STOCK_IMPORT_COST_INVALID',
  /** A row's manufacture or expiry date is not a recognised date. */
  IMPORT_DATE_INVALID = 'STOCK_IMPORT_DATE_INVALID',

  // ── the opening-line item lookup ──────────────────────────────────────────
  /** No such item. */
  OPENING_ITEM_NOT_FOUND = 'STOCK_OPENING_ITEM_NOT_FOUND',
  /** The item is inactive. */
  OPENING_ITEM_INACTIVE = 'STOCK_OPENING_ITEM_INACTIVE',
  /** The item belongs to another company. */
  OPENING_ITEM_OTHER_COMPANY = 'STOCK_OPENING_ITEM_OTHER_COMPANY',
  /** The item belongs to another branch. */
  OPENING_ITEM_OTHER_BRANCH = 'STOCK_OPENING_ITEM_OTHER_BRANCH',
  /** The item is a service item (no stock to open). */
  OPENING_ITEM_SERVICE = 'STOCK_OPENING_ITEM_SERVICE',
  /** The item has no unit conversion at all. */
  OPENING_ITEM_NO_UNIT = 'STOCK_OPENING_ITEM_NO_UNIT',
  /** The unit sent is not one of the item's conversions. */
  OPENING_UNIT_NOT_OF_ITEM = 'STOCK_OPENING_UNIT_NOT_OF_ITEM',
  /** No unit sent and the item has no default unit. */
  OPENING_NO_DEFAULT_UNIT = 'STOCK_OPENING_NO_DEFAULT_UNIT',
  /** The unit's base unit has no conversion row of its own on the item. */
  OPENING_BASE_UNIT_MISSING = 'STOCK_OPENING_BASE_UNIT_MISSING',

  // ── accounts posting of a stock voucher ───────────────────────────────────
  /** The accounts voucher needs a user to be posted by and the request carries none. */
  ACCOUNTS_USER_REQUIRED = 'STOCK_ACCOUNTS_USER_REQUIRED',

  // ── selling prices (bulk) ─────────────────────────────────────────────────
  /** A non-HQ user saving prices for all branches (CHAIN scope). */
  PRICE_CHAIN_HQ_ONLY = 'STOCK_PRICE_CHAIN_HQ_ONLY',
  /** A row's unit is not one of its item's units. */
  PRICE_UNIT_NOT_OF_ITEM = 'STOCK_PRICE_UNIT_NOT_OF_ITEM',
  /** Two rows of one save price the same bucket at the same scope. */
  PRICE_DUPLICATE_BUCKET = 'STOCK_PRICE_DUPLICATE_BUCKET',
  /** A selling price above the bucket's MRP. */
  PRICE_ABOVE_MRP = 'STOCK_PRICE_ABOVE_MRP',
  /** A selling price below the item's minimum price. */
  PRICE_BELOW_MIN = 'STOCK_PRICE_BELOW_MIN',
  /** A selling price below cost under inventory.below_cost_price = restrict. */
  PRICE_BELOW_COST = 'STOCK_PRICE_BELOW_COST',
  /** Another price already covers this bucket at this scope for an overlapping period. */
  PRICE_OVERLAP = 'STOCK_PRICE_OVERLAP',
  /** A bucket row's MRP and max price differ. */
  PRICE_BUCKET_MRP_MISMATCH = 'STOCK_PRICE_BUCKET_MRP_MISMATCH',
  /** An MRP bucket at zero. */
  PRICE_BUCKET_MRP_ZERO = 'STOCK_PRICE_BUCKET_MRP_ZERO',
  /** A sale-price bucket at zero. */
  PRICE_BUCKET_SP_ZERO = 'STOCK_PRICE_BUCKET_SP_ZERO',
  /** A negative selling price. */
  PRICE_NEGATIVE = 'STOCK_PRICE_NEGATIVE',
  /** effectiveFrom before today: bills already made at the old price would change meaning (notes 140 A). */
  PRICE_FROM_IN_PAST = 'STOCK_PRICE_FROM_IN_PAST',
  /** effectiveFrom more than a year ahead — a typo in the year, most likely (notes 140 A). */
  PRICE_FROM_TOO_FAR = 'STOCK_PRICE_FROM_TOO_FAR',
  /** No live price row with that id to cancel (notes 140 B). */
  PRICE_SCHEDULE_NOT_FOUND = 'STOCK_PRICE_SCHEDULE_NOT_FOUND',
  /** The scheduled price is already in force: cancelling it would rewrite past bills (notes 140 B). */
  PRICE_SCHEDULE_STARTED = 'STOCK_PRICE_SCHEDULE_STARTED',

  // ── balance reads and presets ─────────────────────────────────────────────
  /** No item stock balance row for the scope asked. */
  BALANCE_NOT_FOUND = 'STOCK_BALANCE_NOT_FOUND',
  /** No item batch stock row for the scope asked. */
  BATCH_STOCK_NOT_FOUND = 'STOCK_BATCH_STOCK_NOT_FOUND',
  /** No item price master row for the item and unit. */
  ITEM_PRICE_NOT_FOUND = 'STOCK_ITEM_PRICE_NOT_FOUND',
  /** No stock track preset with that id. */
  PRESET_NOT_FOUND = 'STOCK_PRESET_NOT_FOUND',

  // ── the database refused (the engine's SQLSTATE, translated by the filters) ─
  /** no_data_found (P0002) — the voucher or year the database looked for is not there. */
  DB_NOT_FOUND = 'STOCK_DB_NOT_FOUND',
  /** restrict_violation (23001) — the row is deleted or not in the state the write needs. */
  DB_RESTRICTED = 'STOCK_DB_RESTRICTED',
  /** unique_violation (23505) — the row already exists (refno / holding collision). */
  DB_DUPLICATE = 'STOCK_DB_DUPLICATE',
  /** exclusion_violation (23P01) — another row already covers an overlapping period. */
  DB_OVERLAP = 'STOCK_DB_OVERLAP',
  /** check_violation (23514) — a value breaks a rule of the table. */
  DB_CHECK_FAILED = 'STOCK_DB_CHECK_FAILED',
  /** not_null_violation (23502) — a required value is missing. */
  DB_VALUE_MISSING = 'STOCK_DB_VALUE_MISSING',
  /** foreign_key_violation (23503) — an id names nothing (item, unit, godown, device). */
  DB_BAD_REFERENCE = 'STOCK_DB_BAD_REFERENCE',
  /** feature_not_supported (0A000) — this document type cannot go through this route. */
  DB_NOT_SUPPORTED = 'STOCK_DB_NOT_SUPPORTED',
}

/** The code for a database refusal, by its SQLSTATE (see STOCK_ENGINE_SQLSTATE_STATUS). */
export const STOCK_DB_ERROR_CODES: Readonly<Record<string, StockErrorCode>> = {
  P0002: StockErrorCode.DB_NOT_FOUND,
  '23001': StockErrorCode.DB_RESTRICTED,
  '23505': StockErrorCode.DB_DUPLICATE,
  '23P01': StockErrorCode.DB_OVERLAP,
  '23514': StockErrorCode.DB_CHECK_FAILED,
  '23502': StockErrorCode.DB_VALUE_MISSING,
  '23503': StockErrorCode.DB_BAD_REFERENCE,
  '0A000': StockErrorCode.DB_NOT_SUPPORTED,
};
