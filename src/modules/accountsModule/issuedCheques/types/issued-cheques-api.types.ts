/**
 * notes (55) — the Issued Cheques screen (menu 52) and its cheque books.
 * Money is a plain number (2 dp) on the wire, as everywhere under /vouchers.
 */

/** One issued cheque — `acc_pdc_register` with apd_tra_type P. */
export interface IssuedChequePayload {
  apdId: string;
  apdAccYear: string;
  companyId: string;
  branchId: string;
  /** The leaf (apd_instrument_no), zero-padded as printed. */
  leaf: string;
  chequeDate: string;
  issuedOn: string;
  amount: number;
  partyId: string;
  partyName: string;
  favouring: string | null;
  acPayee: boolean;
  bankLedgerId: string | null;
  bankName: string | null;
  chequeBookId: string | null;
  bookNo: string | null;
  /** HELD (outstanding) | CLEARED (presented) | BOUNCED (returned) | CANCELLED (stopped / voided) | REPLACED */
  status: string;
  /** HELD and dated after today. */
  isPostDated: boolean;
  statusOn: string | null;
  presentedOn: string | null;
  returnedOn: string | null;
  returnReason: string | null;
  charges: number | null;
  cancelledOn: string | null;
  /** STOPPED: … / VOIDED: … / REPLACED: … */
  cancelReason: string | null;
  /** The voucher carrying the cheque's legs (a post-dated cheque's own voucher). */
  voucherId: string | null;
  voucherAccYear: string | null;
  voucherRefno: string | null;
  voucherDate: string | null;
  /** The voucher's TYPE code — PmtV for a Payment Voucher's cheque. */
  typeCode: string | null;
  /** The Payment Voucher itself (today's, when the cheque is post-dated). */
  paymentVoucherId: string | null;
  /** The ChqBnc voucher that took the cheque's line back out (returned / stopped / voided / replaced). */
  reversalVoucherId: string | null;
  reversalAccYear: string | null;
  reversalRefno: string | null;
  replacedById: string | null;
  replacedByAccYear: string | null;
  replacedByLeaf: string | null;
  /** On a replacement: the cheque it stands in for. */
  replacesId: string | null;
  printCount: number;
  printedOn: string | null;
  remarks: string | null;
  createdBy: string | null;
}

export interface IssuedChequeHistoryEntry {
  seqNo: number;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  changedOn: string;
  changedBy: string | null;
  remarks: string | null;
}

export interface IssuedChequeHistoryPayload {
  apdId: string;
  apdAccYear: string;
  leaf: string;
  issuedOn: string;
  issuedBy: string | null;
  voucherRefno: string | null;
  entries: IssuedChequeHistoryEntry[];
}

/** What a one-line reversal wrote. */
export interface IssuedChequeReversal {
  voucherId: string;
  accYear: string;
  voucherRefno: string | null;
  /** What the line had discharged (the cheque plus its TDS). */
  gross: number;
  tds: number;
  charges: number;
  allocationsReversed: number;
}

export interface ReplacedChequePayload {
  replaced: IssuedChequePayload;
  replacement: IssuedChequePayload;
}

/** §4.9 — one cheque book, in full. */
export interface ChequeBookPayload {
  chequeBookId: string;
  companyId: string;
  branchId: string | null;
  bankLedgerId: string;
  bankName: string;
  bookNo: string;
  leafFrom: string;
  leafTo: string;
  /** null once the book is finished. */
  nextLeaf: string | null;
  left: number;
  used: number;
  leafWidth: number;
  format: string | null;
  status: string;
  closedOn: string | null;
  closeReason: string | null;
  remarks: string | null;
  /** The leaves handed out, in order, with where each went. */
  leaves: {
    leaf: string;
    apdId: string;
    apdAccYear: string;
    partyName: string;
    amount: number;
    status: string;
    voucherRefno: string | null;
  }[];
}
