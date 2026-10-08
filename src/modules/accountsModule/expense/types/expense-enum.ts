/**
 * The expense voucher (ExpV) — plan-till-receipt-payment-expense §4, REV 2
 * §2.16. Its own routes, its own derive: the voucher register's party modes do
 * not fit an optional supplier.
 */

/** fixed.menu_master — 20261008160000_expense_voucher. */
export const EXPENSE_MENU_ID = 277;
export const EXPENSE_VOUCHER_TYPE_CODE = 'ExpV';
/** public.print_purpose.ppo_code — 20261008170000_expense_voucher_list_print. */
export const EXPENSE_PRINT_PURPOSE_CODE = 'EXPENSE_VOUCHER';
/** fixed.grid_details.grid_name of the list (same migration); the client finds it by name. */
export const EXPENSE_LIST_GRID_NAME = 'MAIN LIST - EXPENSE VOUCHERS';
/** `<prefix>_RIGHT_<VERB>` on a refusal (rights.ts). */
export const EXPENSE_RIGHT_PREFIX = 'EXP';
/** acc_tender_detail.td_src_doc_type of the voucher's tenders. */
export const EXPENSE_SRC_DOC_TYPE = 'EXPENSE';
/** acc_group_master.acc_group_nature a line ledger must sit under. */
export const EXPENSE_GROUP_NATURE = 'Expenses';
/** till_reason.trs_category of the quick picks. */
export const EXPENSE_REASON_CATEGORY = 'EXPENSE';
/** app_setting_def — above it, an expense with no GST bill WARNs (0 = never). */
export const EXPENSE_GST_BILL_ABOVE_KEY = 'accounts.expense_gst_bill_above';

export const EXPENSE_LINES_MAX = 50;
export const EXPENSE_TENDERS_MAX = 10;

/** §4.5, and the refusals the derive adds to it. */
export enum ExpenseErrorCode {
  /** Lines (with their tax) ≠ tenders, to the paisa. */
  TOTAL_MISMATCH = 'EXPENSE_TOTAL_MISMATCH',
  /** A line on a party, cash, bank or tax ledger — anything outside an Expenses group. */
  LEDGER_NOT_EXPENSE = 'EXPENSE_LEDGER_NOT_EXPENSE',
  /** The supplier named is not a live party ledger of the company. */
  PARTY_INVALID = 'EXPENSE_PARTY_INVALID',
  /** A GST bill without its supplier, GSTIN, invoice no / date, or a line's rate. */
  GST_INCOMPLETE = 'EXPENSE_GST_INCOMPLETE',
  GST_RATE_MISSING = 'EXPENSE_GST_RATE_MISSING',
  /** No ledger mapped for INPUT_CGST / SGST / IGST / CESS (menu 250). */
  GST_LEDGER_UNMAPPED = 'EXPENSE_GST_LEDGER_UNMAPPED',
  /** WARN, never blocks: a large expense with no GST bill (accounts.expense_gst_bill_above). */
  GST_BILL_MISSING = 'EXPENSE_GST_BILL_MISSING',
  /** A cheque or a post-dated instrument: those go on a bill-wise Payment. */
  TENDER_NOT_ALLOWED = 'EXPENSE_TENDER_NOT_ALLOWED',
  NO_LINES = 'EXPENSE_NO_LINES',
}

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

/** Where a tender's money left from, as the derive shows it. */
export enum ExpenseMoneyFrom {
  /** The live till session's drawer (a CASH row on a till device). */
  DRAWER = 'DRAWER',
  /** The branch default safe (a CASH row on a back-office device, till.backoffice_cash_from = SAFE). */
  SAFE = 'SAFE',
  /** The tender's own ledger: a bank, UPI, card — or cash where no till runs. */
  LEDGER = 'LEDGER',
}
