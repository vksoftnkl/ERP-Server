/** One tender the phone may collect with. */
export interface MobileReceiptTender {
  /** acc_tender_master.tnd_id: send it as tdTenderId. */
  tenderId: string;
  /** acc_tender_types.ttm_type_id: send it as tdTenderTypeId. */
  typeId: number;
  /** CASH, CARD, UPI, WALLET, CHEQUE or BANK. */
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
}

/** GET /mobile/receipts/options */
export interface MobileReceiptOptions {
  companyId: string;
  /** The branch the phone's receipts for this company land in (as an upload resolves it). */
  branchId: string;
  tenders: MobileReceiptTender[];
}

/** What the receipt settled on one bill. */
export interface MobileReceiptAllocation {
  billId: string;
  billAccYear: string;
  /** The bill's number (sb_bill_refno for a sales bill). */
  docRefno: string;
  /** What this receipt settled on it, two decimals as text. */
  amount: string;
  /** What the bill still owes now, two decimals as text. */
  pendingAmount: string | null;
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
}

/** One open bill of one customer, as /receipts/open-items lists it. */
export interface MobileOpenBill {
  /** The customer id (= its ledger id). */
  partyId: string;
  /** accounts.acc_bill_balance.abl_id. */
  billId: string;
  billAccYear: string;
  /** SALES, OPENING, INTEREST, JOURNAL or PURCHASE_RETURN. */
  billType: string;
  /** The bill's number (sb_bill_refno for a sales bill). */
  docRefno: string;
  /** YYYY-MM-DD. */
  docDate: string;
  /** YYYY-MM-DD; null when the bill has none. */
  dueDate: string | null;
  /** Two decimals as text. */
  billAmount: string;
  /** What it still owes, two decimals as text. */
  pendingAmount: string;
  /** Days past the due date on onDate; 0 when not due or no due date. */
  daysOverdue: number;
}

/** GET /mobile/receipts/open-bills */
export interface MobileOpenBillsPayload {
  items: MobileOpenBill[];
  /** Every open bill of the company. */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  companyId: string;
  /** The day daysOverdue is measured on (as /receipts/open-items measures it). */
  onDate: string;
}
