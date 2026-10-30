/**
 * Notes 124 — the codes Receipt (99), Payment (100) and Received Cheques (51)
 * raise that the Voucher Register's `VCH` set has no word for. A refusal that
 * one of those already names reuses the VCH code instead (vouchers.errors.ts).
 *
 * `code` is what the Qt client words the box by, and the user's wording rows
 * in prisma/seed/Error_Messages.json are keyed on it, so every string below is
 * an API contract: rename one and the box loses its wording.
 */
export const ACC = {
  /** A bill's pending amount moved while the receipt / payment was being keyed (409). */
  BILL_MOVED: 'ACC_BILL_MOVED',
  /** More of a credit applied than the bills can take. */
  CREDIT_OVERSPENT: 'ACC_CREDIT_OVERSPENT',
  /** A credit's remaining balance moved while the document was being keyed (409). */
  CREDIT_MOVED: 'ACC_CREDIT_MOVED',
  /** accounts.*_allow_posted_amend is off. */
  AMEND_OFF: 'ACC_AMEND_OFF',
  /** The id names a post-dated cheque child voucher, not the receipt / payment. */
  PDC_VOUCHER: 'ACC_PDC_VOUCHER',
  /** An amend tried to move the money to another party. */
  PARTY_LOCKED: 'ACC_PARTY_LOCKED',
  /** baseRevision is behind the stored revision. */
  REVISION_STALE: 'ACC_REVISION_STALE',
  /** No tender rows at all. */
  NO_TENDER: 'ACC_NO_TENDER',
  /** The tender is inactive, another company's, not at this branch, or of another type. */
  TENDER_NOT_USABLE: 'ACC_TENDER_NOT_USABLE',
  /** A tender row names a tender id with no live Tender Master row (404). */
  TENDER_NOT_FOUND: 'ACC_TENDER_NOT_FOUND',
  /** Received / paid less change is not the row's amount. */
  CHANGE_WRONG: 'ACC_CHANGE_WRONG',
  /** The tender master does not let its ledger be changed. */
  TENDER_LEDGER_FIXED: 'ACC_TENDER_LEDGER_FIXED',
  /** The party is also keyed as an other-ledger line. */
  PARTY_AS_LINE: 'ACC_PARTY_AS_LINE',
  /** A write-off / write-back above accounts.writeoff_approval_above has no approver. */
  WRITEOFF_APPROVER: 'ACC_WRITEOFF_APPROVER',
  /** accounts.pdc_posting_mode = ON_CLEARING: bills are matched when the cheque clears. */
  PDC_ALLOCATION: 'ACC_PDC_ALLOCATION',
  /** Money fields sent to the header-only update of a posted voucher. */
  POSTED_FIELDS: 'ACC_POSTED_FIELDS',
  /** accounts.receipt_salesman_mandatory: who collected the money. */
  COLLECTOR_REQUIRED: 'ACC_COLLECTOR_REQUIRED',
  /** accounts.payment_salesman_mandatory: who made the payment. */
  PAYER_REQUIRED: 'ACC_PAYER_REQUIRED',
  /** The accounting year has no voucher partitions. */
  YEAR_NOT_SET_UP: 'ACC_YEAR_NOT_SET_UP',
  /** accounts.acc_voucher_types has no active row for the document's type code. */
  TYPE_NOT_SET_UP: 'ACC_TYPE_NOT_SET_UP',
  /** accounts.acc_ledger_map has no row for a role the document posts to. */
  ROLE_UNMAPPED: 'ACC_ROLE_UNMAPPED',
  /** Other income / charges keyed on a document whose only money is post-dated. */
  OTHER_LINE_UNFUNDED: 'ACC_OTHER_LINE_UNFUNDED',
  /** The request itself is wrong — something the client should never send. */
  INVALID: 'ACC_INVALID',

  // Payment only
  /** An issued cheque dated before the payment. */
  CHEQUE_BACKDATED: 'ACC_CHEQUE_BACKDATED',
  /** The cheque book is another company's or not usable at this branch. */
  BOOK_NOT_USABLE: 'ACC_BOOK_NOT_USABLE',
  /** The party is a cash / bank ledger: that is a Contra, not a payment. */
  PARTY_IS_CASH: 'ACC_PARTY_IS_CASH',
  /** The client's TDS differs from what the server works out. */
  TDS_MISMATCH: 'ACC_TDS_MISMATCH',
  /** A tender row is already settled with the bank. */
  TENDER_SETTLED: 'ACC_TENDER_SETTLED',
} as const;

export type AccErrorCode = (typeof ACC)[keyof typeof ACC];
