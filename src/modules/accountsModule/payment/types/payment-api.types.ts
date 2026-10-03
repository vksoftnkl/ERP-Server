import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type {
  AdjacentVoucher,
  AdjacentVoucherPayload,
  DuplicateCheckPayload,
  OpenCredit,
  ReceiptAdvanceBill,
  ReceiptAllocation,
  ReceiptHeader,
  ReceiptLeg,
  ReceiptOtherLine,
  ReceiptPdcVoucher,
  ReceiptStatusPayload,
  ReceiptTender,
} from '../../receipt/types/receipt-api.types';
import type { BillStatus, BillType, PdcStatus, VoucherStatus } from './payment-enum';

/**
 * The payment's API shapes. Everything that is the receipt's shape verbatim is
 * re-used by type (the header, a leg, an allocation row, a PDC voucher, an
 * advance bill), because a payment IS the receipt with the money going the
 * other way and a second copy of those shapes would drift.
 */

export type PaymentErrorDetail = ModuleApiErrorDetail;
export type PaymentErrorResponse = ModuleApiErrorResponse<PaymentErrorDetail>;
export type PaymentSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

export type PaymentHeader = ReceiptHeader;
export type PaymentLeg = ReceiptLeg;
export type PaymentAllocation = ReceiptAllocation;
export type PaymentPdcVoucher = ReceiptPdcVoucher;
export type PaymentAdvanceBill = ReceiptAdvanceBill;
export type PaymentStatusPayload = ReceiptStatusPayload;
export type PaymentOtherLine = ReceiptOtherLine & {
  /** Who authorised a BALANCES_WRITTEN_BACK line above `accounts.writeoff_approval_above`. */
  approvedBy: string | null;
};
export type { AdjacentVoucher, AdjacentVoucherPayload, DuplicateCheckPayload, OpenCredit };

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  GET /payments/open-items
// ═══════════════════════════════════════════════════════════════════════════

/** One bill we owe the party. */
export interface PayableBill {
  billId: string;
  billAccYear: string;
  billType: BillType;
  /** OUR reference for the bill — the purchase voucher's number. */
  docRefno: string;
  /** The SUPPLIER's bill number, when the bill came off a Purchase (Accounting) voucher. */
  usrRefno: string | null;
  docDate: string;
  dueDate: string | null;
  billAmount: number;
  pendingAmount: number;
  status: BillStatus;
  daysOverdue: number;
  /** Post-dated money already promised against this bill, not yet matured. */
  pdcHeld: number;
  /** R16 — what `accounts.ppd_slabs` suggests at `onDate`, on what is LEFT. */
  ppdSuggested: number;
}

/** The party, as the payment screen's header band shows them. */
export interface PaymentOpenItemsParty {
  ledId: string;
  ledName: string;
  groupName: string | null;
  isBillByBill: boolean;
  /** notes (56): under Cash-in-Hand / Bank Accounts / Bank OD — a payment to one is a Contra, and is refused. */
  isMoneyLedger: boolean;
  isTdsApplicable: boolean;
  tdsSection: string | null;
  tdsDeducteeType: string | null;
  /** The rate in force today for the section, by deductee, from accounts.tds_rates. Null = none configured. */
  tdsRate: number | null;
  /** MASTER — the section's rate; NO_PAN — the 206AA rate because the party has no PAN. */
  tdsRateSource: 'MASTER' | 'NO_PAN' | null;
  tdsThresholdSingle: number | null;
  tdsThresholdAnnual: number | null;
  /** Σ base already deducted from this party under the section this year. */
  tdsPaidThisYear: number;
  panPresent: boolean;
  /** The party's default bank account, for a NEFT / transfer row's beneficiary. */
  bank: { name: string; accountNo: string; ifsc: string | null } | null;
  /** Who a cheque to this party is made out to. */
  favouringName: string;
}

export interface PaymentOpenItemsSummary {
  /** Σ pending on the payables. Held debits are their own figure. */
  totalPending: number;
  billCount: number;
  overdueCount: number;
  /**
   * Σ pending on the debits we hold — advances paid, debit notes. The
   * receipt's NAME on purpose (rev 2 "DTO for DTO", notes 62 D1): the screen
   * is the receipt's, and on a payment the held items are simply the DR side.
   */
  creditsHeld: number;
  pdcHeld: number;
}

export interface PaymentOpenItemsPayload {
  bills: PayableBill[];
  /** The debits we hold on this party, offered against the bills. `drCr` is DR on every row. */
  credits: OpenCredit[];
  summary: PaymentOpenItemsSummary;
  party: PaymentOpenItemsParty;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.2  GET /payments/party-context
// ═══════════════════════════════════════════════════════════════════════════

export interface PartyRecentPayment {
  voucherId: string;
  accYear: string;
  voucherRefno: string | null;
  voucherDate: string;
  docAmount: number;
  adjustAmount: number;
  /** 'Cheque, NEFT' — the tender types, de-duplicated. */
  instruments: string | null;
}

/** One of OUR cheques to this party that has not been presented. */
export interface PartyChequeOut {
  pdcId: string;
  accYear: string;
  /** The leaf. */
  instrumentNo: string;
  instrumentDate: string;
  amount: number;
  bankName: string | null;
  bookNo: string | null;
  status: PdcStatus;
  voucherId: string | null;
  voucherRefno: string | null;
}

export interface PaymentPartyContextSummary {
  /** What we owe the party NET: every open payable less every debit of ours they hold. */
  totalBalance: number;
  /** Σ pending on the party's open payables (CR). */
  totalOutstanding: number;
  /** Σ pending on the debits we hold against them (DR). The receipt's name (notes 62 D1). */
  totalCredits: number;
  /** Our post-dated cheques to this party not yet matured. */
  chequesOutstanding: number;
}

export interface PaymentPartyContextPayload {
  partyId: string;
  partyName: string;
  summary: PaymentPartyContextSummary;
  lastPayments: PartyRecentPayment[];
  ourChequesOut: PartyChequeOut[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.3 / §4.5  the payment itself
// ═══════════════════════════════════════════════════════════════════════════

/** Where a transfer goes: the supplier's account, as keyed or as the master holds it. */
export interface PaymentBeneficiary {
  name: string | null;
  accountNo: string | null;
  ifsc: string | null;
}

/**
 * On a cheque row: the book its leaf comes from and how it is made out — the
 * `cheque {}` a save sends, sent back so a reopened draft can be saved again
 * without the book being picked a second time (notes 62 A3). A draft answers
 * from what it stored; a posted payment from its register row.
 */
export interface PaymentTenderCheque {
  chequeBookId: string;
  bookNo: string | null;
  favouring: string | null;
  acPayee: boolean;
  bankBranch: string | null;
  ifsc: string | null;
  micr: string | null;
  drawerName: string | null;
}

/** One tender line — the receipt's, plus who the money went to. */
export interface PaymentTender extends ReceiptTender {
  /** On a bank-transfer row: the beneficiary. Null on cash and on a cheque. */
  beneficiary: PaymentBeneficiary | null;
  /** On a cheque row: the book and the making-out. Null on every other row. */
  cheque: PaymentTenderCheque | null;
}

/** One `acc_pdc_register` row of OURS (apd_tra_type P). */
export interface PaymentCheque {
  pdcId: string;
  accYear: string;
  tenderRowNo: number | null;
  instrumentType: string;
  /** The LEAF the book handed out at post. */
  instrumentNo: string;
  instrumentDate: string;
  amount: number;
  bankName: string | null;
  /** The account the cheque is drawn on. */
  bankLedgerId: string | null;
  chequeBookId: string | null;
  bookNo: string | null;
  favouring: string | null;
  acPayee: boolean;
  printed: boolean;
  printCount: number;
  status: PdcStatus;
  /** The voucher carrying this cheque's legs. */
  voucherId: string | null;
}

/** §4.3 — what a saved DRAFT answers with. */
export interface PaymentDraftPayload {
  header: PaymentHeader;
  tenders: PaymentTender[];
  /** The server's canonical set — the client's lines plus BANK_CHARGES and TDS_PAYABLE it seeded. */
  otherLines: PaymentOtherLine[];
  /** Roles the party's flags imply that this draft has none of. Empty on a payment: TDS is SEEDED. */
  expectedRoles: string[];
}

/** §4.5 — the whole payment. */
export interface PaymentPayload {
  header: PaymentHeader;
  tenders: PaymentTender[];
  otherLines: PaymentOtherLine[];
  legs: PaymentLeg[];
  allocations: PaymentAllocation[];
  creditsApplied: PaymentAllocation[];
  /** One row per cheque issued, post-dated or not. */
  chequesIssued: PaymentCheque[];
  pdcVouchers: PaymentPdcVoucher[];
  advanceBills: PaymentAdvanceBill[];
}

/** §4.4 — what a post answers with. */
export interface PaymentPostPayload extends PaymentPayload {
  numberedVouchers: Array<{
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    isPdcVoucher: boolean;
  }>;
  billsAfter: Array<{
    billId: string;
    billAccYear: string;
    docRefno: string;
    billAmount: number;
    pendingAmount: number;
    postDatedHeld: number;
  }>;
  totalOnAccount: number;
  /** The leaf each cheque row got, in tender-row order. */
  cheques: Array<{
    tdRowNo: number;
    apdId: string;
    apdAccYear: string;
    leaf: string;
    bookNo: string;
  }>;
}

/** §4.8 — cancel. */
export interface PaymentCancelPayload extends PaymentStatusPayload {
  reversals: Array<{
    ofVoucherId: string;
    reversalVoucherId: string;
    accYear: string;
    voucherRefno: string | null;
    legCount: number;
    adjustmentCount: number;
  }>;
  billsReopened: Array<{
    billId: string;
    billAccYear: string;
    docRefno: string;
    pendingAmount: number;
  }>;
  chequesCancelled: string[];
  advanceBillsRemoved: string[];
  /** TDS register rows reversed. */
  tdsReversed: number;
}

/** R20 — amend. */
export interface PaymentAmendPayload extends PaymentPostPayload {
  fromRevision: number;
  toRevision: number;
  editRemark: string;
  unwound: {
    adjustmentsReversed: number;
    legsRemoved: number;
    pdcVouchersRemoved: number;
    chequesRemoved: number;
    advanceBillsRemoved: number;
    tendersRemoved: number;
    tdsReversed: number;
  };
}

/** `POST /payments/delete` — a DRAFT thrown away. */
export interface PaymentDeletePayload {
  avhVoucherId: string;
  avhAccYear: string;
  avhVoucherRefno: string | null;
  status: VoucherStatus;
  deletedOn: string;
  deletedBy: string;
  tendersDeleted: number;
  otherLinesDeleted: number;
}
