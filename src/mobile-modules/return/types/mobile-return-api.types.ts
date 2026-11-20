import type { UserWording } from '../../../common/error-wording/error-wording';

/** A line's condition on the phone (D3); the server takes the stock bucket from it. */
export type MobileReturnCondition = 'RESTOCK' | 'DAMAGED' | 'EXPIRED' | 'SCRAP';

/** How a phone return is settled (D4): never CASH, the phone takes no tenders. */
export type MobileReturnSettleMode = 'ADJUST' | 'ADVANCE';

/** One SALE_RETURN reason the company sees (shared + its own; its own wins by code). */
export interface MobileReturnReason {
  reasonId: string;
  code: string;
  name: string;
  /** srm_default_condition when it is one of the four the phone offers, else null. */
  defaultCondition: MobileReturnCondition | null;
  /** srm_refund_charges: whether the bill's charges come back by default. */
  refundCharges: boolean | null;
  /**
   * A claim reason (the code ends in _SHOP: SR_EXPIRED_SHOP, SR_DAMAGED_SHOP,
   * or a company row overriding them). Claims are the office's (D8): the phone
   * hides them.
   */
  isClaim: boolean;
  sortOrder: number;
}

/** One live, active godown of the return's branch. */
export interface MobileReturnGodown {
  godownId: string;
  name: string;
  /** branch_master.br_default_godown_id of the branch. */
  isDefault: boolean;
}

export interface MobileReturnSettings {
  /** sales.return_window_days (0 = no window). */
  returnWindowDays: number;
  /** sales.free_return_allowed: may a return name no bill (D1). */
  freeReturnAllowed: boolean;
  /** sales.return_settle_default: ADVANCE, else ADJUST; null when unset. */
  settleDefault: MobileReturnSettleMode | null;
  /** sales.return_expired_lot_days when above 0, else null. */
  expiredLotDays: number | null;
  /** The bill window the phone keeps (D9): returnWindowDays when above 0, else 90. */
  billDays: number;
}

/** GET /mobile/returns/options */
export interface MobileReturnOptions {
  companyId: string;
  branchId: string;
  reasons: MobileReturnReason[];
  godowns: MobileReturnGodown[];
  settings: MobileReturnSettings;
  /** The login's menu-13 flags; null when no token was sent. */
  rights: { create: boolean; post: boolean } | null;
}

/** One line of a posted bill, with what is left to return (the desktop /sale-returns/bill-lines figures). */
export interface MobileReturnBillLine {
  billItemId: string;
  accYear: string;
  lineNo: number;
  itemId: string;
  itemName: string | null;
  itemUnitId: string;
  unitName: string | null;
  toBaseFactor: number | null;
  billQty: number | null;
  billQtyBase: number | null;
  returnedQtyBase: number | null;
  qtyLeftBase: number | null;
  onOtherDraftsBase: number | null;
  /** The line's taxable value per base unit, after every discount: 4 decimals as text. */
  ratePreTaxBase: string | null;
  /** The line's rate in its own unit, as printed: 2 decimals as text. */
  rate: string | null;
  /** 3 decimals as text. */
  taxPerc: string;
  cgstPerc: string;
  sgstPerc: string;
  igstPerc: string;
  lotId: string | null;
  batchNo: string | null;
  expiryDate: string | null;
  godownId: string;
  isFree: boolean;
  allowReturn: boolean;
}

export type MobileReturnBillStatus = 'NONE' | 'PARTIAL' | 'FULL';

export interface MobileReturnBill {
  sbId: string;
  accYear: string;
  refno: string | null;
  /** YYYY-MM-DD. */
  date: string;
  custId: string | null;
  branchId: string;
  /** Money: 2 decimals as text. */
  billAmount: string;
  due: string;
  payMode: string | null;
  returnedAmt: string;
  returnStatus: MobileReturnBillStatus;
  lines: MobileReturnBillLine[];
}

/** GET /mobile/returns/bill-lines */
export interface MobileReturnBillLinesPayload {
  /** The read's time (ISO). */
  asOf: string;
  billDays: number;
  /** The first bill date read (YYYY-MM-DD). */
  since: string;
  page: number;
  pageSize: number;
  /** Bills, not lines. */
  total: number;
  hasMore: boolean;
  companyId: string;
  branchId: string;
  bills: MobileReturnBill[];
}

/** The phone's word for what became of an upload. */
export type MobileReturnOutcome = 'POSTED' | 'HELD' | 'SENT_BACK';

/** One refusal or note, as the desktop raised it. */
export interface MobileReturnNote {
  code: string;
  message: string;
  field: string | null;
  line: number | null;
  /** The catalogue's plain words for the code (fixed.error_message); absent when none. */
  user?: UserWording;
  /**
   * The desktop's own detail keys, as its errors[] carry them (event, amount,
   * requiredRole, params, statutory …), and a warning's level (WARN · INFO).
   */
  [detail: string]: unknown;
}

export interface MobileReturnAdjusted {
  /** acc_bill_balance id (abl_id), as GET /mobile/receipts/open-bills names a bill. */
  billId: string;
  billAccYear: string;
  refno: string | null;
  amount: string;
}

export type MobileReturnReplanReason =
  | 'BILL_SETTLED'
  | 'BILL_REDUCED'
  | 'NOTE_SMALLER'
  | 'FREED_MONEY';

/** One Adjust row the server changed from the phone's split (D6). */
export interface MobileReturnReplanned {
  billId: string;
  billAccYear: string;
  refno: string | null;
  /** What the phone asked for this bill (0.00 for a bill it did not name). */
  from: string;
  /** What the post set off. */
  to: string;
  reason: MobileReturnReplanReason;
}

export interface MobileReturnApproval {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
}

export interface MobileReturnLineResult {
  sriLineNo: number;
  sriSplitNo: number;
  sriId: string;
  /** BILL · LAST_SALE · TODAY_PRICE. */
  rateSource: string | null;
  taxableAmt: string;
  taxAmt: string;
  netAmt: string;
  /** SALEABLE · DAMAGED · EXPIRED · SCRAP … (from the condition). */
  bucket: string | null;
}

/** The answer to POST /mobile/returns/create, for a new upload and a resend alike. */
export interface MobileReturnCreateResult {
  /** true = the return is POSTED or CANCELLED already: nothing was written now. */
  duplicate: boolean;
  srId: string;
  srClientUuid: string;
  srReturnRefno: string | null;
  srMobileRefno: string | null;
  srAccYear: string;
  srBranchId: string;
  /** The row's own status now: DRAFT · POSTED · CANCELLED. */
  srStatus: string;
  status: MobileReturnOutcome;
  srReturnAmt: string;
  totals: {
    goods: string;
    tax: string;
    chargesNet: string;
    roundOff: string;
    creditNote: string;
  };
  settlement: {
    mode: string | null;
    credited: string;
    settleStatus: string | null;
    adjusted: MobileReturnAdjusted[];
  };
  lines: MobileReturnLineResult[];
  /** HELD: the first refusal only the office can clear. */
  held: MobileReturnNote | null;
  /** SENT_BACK: the first refusal the phone must fix. */
  refusal: MobileReturnNote | null;
  /** Every refusal of the refused post (empty when it posted). */
  refusals: MobileReturnNote[];
  /** The post's WARN / INFO notes when it went through. */
  warnings: MobileReturnNote[];
  replanned: MobileReturnReplanned[];
  /** The latest approval request of the return (not withdrawn), or null. */
  approval: MobileReturnApproval | null;
}

/** POST /mobile/returns/delete */
export interface MobileReturnDeleteResult {
  deleted: boolean;
  srClientUuid: string;
  srId: string | null;
  srReturnRefno: string | null;
  /** true = it was deleted before (a resend of the delete). */
  duplicate: boolean;
}

export type MobileReturnRowStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'DELETED';

export interface MobileReturnStatus {
  srClientUuid: string;
  srId: string;
  srAccYear: string;
  srReturnRefno: string | null;
  status: MobileReturnRowStatus;
  approval: MobileReturnApproval | null;
  revisionNo: number;
  srReturnAmt: string;
  settleStatus: string | null;
  adjusted: MobileReturnAdjusted[];
  cancelledOn: string | null;
  cancelReason: string | null;
  updatedOn: string;
}

/** GET /mobile/returns/status */
export interface MobileReturnStatusPayload {
  /** This read's time less five minutes: send it back as `since`. */
  asOf: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  companyId: string;
  returns: MobileReturnStatus[];
}
