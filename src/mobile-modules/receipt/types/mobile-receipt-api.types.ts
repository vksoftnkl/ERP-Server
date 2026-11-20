import type { MobileReceiptAdjusted } from '../mobile-receipt-plan';
import type { MobilePpdStep } from '../mobile-receipt-ppd';

export type { MobileReceiptAdjusted, MobilePpdStep };

/** One tender the phone may collect with. */
export interface MobileReceiptTender {
  /** acc_tender_master.tnd_id: send it as tdTenderId. */
  tenderId: string;
  /** acc_tender_types.ttm_type_id: send it as tdTenderTypeId. */
  typeId: number;
  /** The tender type's name: CASH, CARD, UPI, WALLET, CHEQUE, BANK, VOUCHER (never CREDIT, LOYALTY, TEMP_CR, RRN / ADJUST). */
  typeCode: string;
  name: string;
  shortName: string | null;
  /** The row needs tdRefNo (a CHEQUE always does, with tdBankName and tdInstrumentDate). */
  needsRef: boolean;
  /** What the reference is called on this type ("Cheque No", "UTR No", "Card Last 4"). */
  refLabel: string | null;
  isDefault: boolean;
  /**
   * What the customer pays on top for this tender, INSIDE tdAmount (notes 107):
   * 200 by UPI at 1% is tdAmount 202.00. Two decimals / three for the percent, as text.
   */
  surchargePerc: string;
  surchargeAmount: string;
  /** The row needs tdBankName (and tdRefNo, tdInstrumentDate): true for a CHEQUE. */
  requiresBank: boolean;
}

/** The receipt rules the phone works by offline. */
export interface MobileReceiptSettings {
  /** accounts.receipt_bill_sort (company): the order open bills are listed and filled in. */
  receiptBillSort: string;
  /** accounts.receipt_salesman_mandatory (the branch): a receipt must name its collector. */
  salesmanMandatory: boolean;
  /** accounts.pdc_posting_mode (the branch): ON_RECEIPT or ON_CLEARING. */
  pdcPostingMode: string;
  /** accounts.ppd_slabs (company) has at least one slab: bills carry a ppdSchedule. */
  ppdEnabled: boolean;
}

/** GET /mobile/receipts/options */
export interface MobileReceiptOptions {
  companyId: string;
  /** The branch the phone's receipts for this company land in (as an upload resolves it). */
  branchId: string;
  tenders: MobileReceiptTender[];
  settings: MobileReceiptSettings;
}

/** What the receipt settled on one bill. */
export interface MobileReceiptAllocation {
  billId: string;
  billAccYear: string;
  /** The bill's number (sb_bill_refno for a sales bill). */
  docRefno: string;
  /** What this receipt settled on it (money and credits), two decimals as text. */
  amount: string;
  /** The prompt-payment discount it gave on the bill, two decimals as text. */
  discount: string;
  /** The round-off it gave on the bill, two decimals as text. */
  roundoff: string;
  /** What the bill still owes now, two decimals as text. */
  pendingAmount: string | null;
}

/** One credit the receipt spent. */
export interface MobileReceiptCreditApplied {
  billId: string;
  billAccYear: string;
  docRefno: string;
  /** How much of it this receipt applied to bills, two decimals as text. */
  amount: string;
  /** What the credit still holds now, two decimals as text. */
  pendingAmount: string | null;
}

/** A post-dated cheque's own voucher, dated the cheque. */
export interface MobileReceiptPdcVoucher {
  voucherId: string;
  voucherRefno: string | null;
  /** YYYY-MM-DD: the cheque's date (the voucher's date). */
  chequeDate: string;
  amount: string;
}

/** The answer to POST /mobile/receipts/create, for a new receipt and a resend alike. */
export interface MobileReceiptCreateResult {
  avhVoucherId: string;
  avhCompanyId: string;
  avhBranchId: string;
  avhAccYear: string;
  /** VK Nex's receipt number. Null only on a receipt still in DRAFT. */
  avhVoucherRefno: string | null;
  /** The phone's own number, as it was sent. */
  avhUsrRefno: string | null;
  /** YYYY-MM-DD. */
  avhVoucherDate: string;
  /** Σ tdAmount, two decimals as text. */
  avhDocAmount: string;
  /** Now: POSTED when just saved; a resend reads the stored one (CANCELLED). */
  avhVoucherStatus: string;
  /** The bills it settles now, in the order they were filled. Empty once cancelled. */
  allocations: MobileReceiptAllocation[];
  /** What it holds on account (its ADVANCE bills), two decimals as text. */
  onAccount: string;
  /** true = this client uuid was saved before: nothing was written this time. */
  duplicate: boolean;
  /** A deleted receipt (only a draft can be deleted, so false on every phone upload today). */
  avhIsDeleted: boolean;
  /** The credits it spends now. Empty once cancelled. */
  creditsApplied: MobileReceiptCreditApplied[];
  /** Its post-dated cheques' own vouchers. */
  pdcVouchers: MobileReceiptPdcVoucher[];
  /** Where the server settled less than the phone planned (D1). Empty for older phones. */
  adjusted: MobileReceiptAdjusted[];
  /** The collector (employee_master.emp_id) on the receipt, or null. */
  employeeId: string | null;
}

/** One open bill of one customer, as /receipts/open-items lists it. */
export interface MobileOpenBill {
  /** The customer id (= its ledger id). */
  partyId: string;
  /** accounts.acc_bill_balance.abl_id. */
  billId: string;
  billAccYear: string;
  /** SALES, OPENING, INTEREST, JOURNAL or PURCHASE_RETURN; on a credit ADVANCE, SALES_RETURN, OPENING or JOURNAL. */
  billType: string;
  /** The bill's number (sb_bill_refno for a sales bill). */
  docRefno: string;
  /** YYYY-MM-DD. */
  docDate: string;
  /** YYYY-MM-DD; null when the bill has none. */
  dueDate: string | null;
  /** Two decimals as text. */
  billAmount: string;
  /** What it still owes (on a credit: what is still held), two decimals as text. */
  pendingAmount: string;
  /** Days past the due date on onDate; 0 when not due or no due date (and on a credit). */
  daysOverdue: number;
  /** BILL, or the credit's kind: ADVANCE, SALES_RETURN, OPENING_CR, JOURNAL_CR. */
  kind: MobileOpenItemKind;
  /** billAmount − pendingAmount: what is already settled (or, on a credit, already used). */
  paidAmount: string;
  /** Post-dated cheque money promised against the bill, not yet matured (0.00 on a credit). */
  pdcHeld: string;
  /** The prompt-payment discount steps still ahead of onDate; [] without PPD (and on a credit). */
  ppdSchedule: MobilePpdStep[];
}

export type MobileOpenItemKind = 'BILL' | 'ADVANCE' | 'SALES_RETURN' | 'OPENING_CR' | 'JOURNAL_CR';

/** One cheque of a phone receipt, as the register has it now. */
export interface MobileReceiptCheque {
  /** The voucher carrying it now: the receipt, or its post-dated cheque's own voucher. */
  voucherId: string | null;
  voucherRefno: string | null;
  instrumentNo: string;
  /** YYYY-MM-DD. */
  chequeDate: string;
  amount: string;
  /** HELD (HELD, DEPOSITED), CLEARED, BOUNCED or CANCELLED (RETURNED, CANCELLED, REPLACED). */
  status: string;
  /** acc_pdc_register.apd_status as is. */
  houseStatus: string;
  /** Dated after the receipt. */
  isPostDated: boolean;
}

/** One of this phone's receipts as it stands now. */
export interface MobileReceiptStatus {
  avhClientUuid: string;
  avhVoucherId: string;
  avhAccYear: string;
  avhVoucherRefno: string | null;
  avhVoucherStatus: string;
  /** ISO instant the receipt was cancelled, or null. */
  cancelledOn: string | null;
  cancelReason: string | null;
  pdc: MobileReceiptCheque[];
  /** ISO instant of the last change to the receipt or one of its cheques. */
  updatedOn: string;
}

/** GET /mobile/receipts/status */
export interface MobileReceiptStatusPayload {
  items: MobileReceiptStatus[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  companyId: string;
  /** The server's time of this read: send it as `since` next time. */
  asOf: string;
}

/** GET /mobile/receipts/open-bills */
export interface MobileOpenBillsPayload {
  items: MobileOpenBill[];
  /** Every open bill of the company's customers (and, with withCredits, every held credit). */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  companyId: string;
  /** The day daysOverdue is measured on (as /receipts/open-items measures it). */
  onDate: string;
}
