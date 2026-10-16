/**
 * Notes 119 / 127 §5 — the sale order's own refusal codes (`errors[].code`);
 * the client words its box by the code alone. A refusal whose meaning is shared
 * by every sales document (not found, line number twice, a required field …)
 * answers the shared SALES_ERROR_CODES member instead (posting/types/
 * posting.types.ts). One meaning per code: a site with a new meaning gets a new
 * member, never an old one.
 */
export enum SaleOrderErrorCode {
  // ─── field shape ──────────────────────────────────────────────────────────
  /** A date field on the order was not a valid ISO date. */
  INVALID_DATE = 'SALE_ORDER_INVALID_DATE',
  /** A vocabulary field (doc/order type, priority, status, free type, line status …) held a value outside its list. */
  VALUE_NOT_ALLOWED = 'SALE_ORDER_VALUE_NOT_ALLOWED',
  /** An amount or quantity on the order or a line was below 0. */
  NEGATIVE_VALUE = 'SALE_ORDER_NEGATIVE_VALUE',
  /** soiSize was sent as a blank string (omit it or send null). */
  SIZE_BLANK = 'SALE_ORDER_SIZE_BLANK',

  // ─── advance roll-ups (ck_so_advance_*) ──────────────────────────────────
  /** soAdvanceBalanceAmt was sent and is not received − adjusted − refunded − forfeited. */
  ADVANCE_BALANCE_MISMATCH = 'SALE_ORDER_ADVANCE_BALANCE_MISMATCH',
  /** The advance roll-ups use more than was received (the derived balance would be negative). */
  ADVANCE_OVERUSED = 'SALE_ORDER_ADVANCE_OVERUSED',
  /** soAdvancePolicy is PERC but soAdvancePerc is 0 or less. */
  ADVANCE_PERC_REQUIRED = 'SALE_ORDER_ADVANCE_PERC_REQUIRED',
  /** soAdvancePolicy is FIXED but soAdvanceRequired is 0 or less. */
  ADVANCE_AMOUNT_REQUIRED = 'SALE_ORDER_ADVANCE_AMOUNT_REQUIRED',
  /** Delete / cancel-lines refused: the order still holds an advance balance (refund, forfeit or transfer it first). */
  ADVANCE_HELD = 'SALE_ORDER_ADVANCE_HELD',

  // ─── line quantities (ck_soi_*) ──────────────────────────────────────────
  /** soiReservedQty is below 0 or above soiOrderQty. */
  RESERVED_OUT_OF_RANGE = 'SALE_ORDER_RESERVED_OUT_OF_RANGE',
  /** soiDeliveredQty + soiCancelledQty exceed soiNetQty (the pending quantity would go negative). */
  QTY_OVER_NET = 'SALE_ORDER_QTY_OVER_NET',
  /** soiPendingQty was sent and differs from the derived net − delivered − cancelled. */
  PENDING_QTY_DERIVED = 'SALE_ORDER_PENDING_QTY_DERIVED',

  // ─── numbering ───────────────────────────────────────────────────────────
  /** The order number (or device serial) is already used in this company / branch / year. */
  ORDER_NO_TAKEN = 'SALE_ORDER_ORDER_NO_TAKEN',

  // ─── the bill-allocation / cancel-lines calls ────────────────────────────
  /** ablSrcDocType was missing on a pending-amount lookup. */
  SRC_DOC_TYPE_REQUIRED = 'SALE_ORDER_SRC_DOC_TYPE_REQUIRED',
  /** ablSrcAccYear was not in the YYYY-YYYY form. */
  ACC_YEAR_INVALID = 'SALE_ORDER_ACC_YEAR_INVALID',
  /** srcModule on a cancel-lines call is not one a sales order accepts. */
  SRC_MODULE_INVALID = 'SALE_ORDER_SRC_MODULE_INVALID',

  // ─── the order advance receipt (order-advance-posting.helper) ─────────────
  /** A tender line charges a surcharge but neither it nor its tender master names a surcharge ledger. */
  SURCHARGE_LEDGER_MISSING = 'SALE_ORDER_SURCHARGE_LEDGER_MISSING',
  /** A tender line pays into the same ledger the advance would be credited to. */
  TENDER_LEDGER_CLASH = 'SALE_ORDER_TENDER_LEDGER_CLASH',
  /** The order's advance receipt was posted and cancelled in accounts before; it cannot be posted again. */
  ADVANCE_RECEIPT_CANCELLED = 'SALE_ORDER_ADVANCE_RECEIPT_CANCELLED',
  /** The advance is already settled against in accounts, so it cannot be removed or reduced below that. */
  ADVANCE_SETTLED = 'SALE_ORDER_ADVANCE_SETTLED',
}
