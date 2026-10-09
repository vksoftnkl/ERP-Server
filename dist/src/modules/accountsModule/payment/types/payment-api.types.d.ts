import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { AdjacentVoucher, AdjacentVoucherPayload, DuplicateCheckPayload, OpenCredit, ReceiptAdvanceBill, ReceiptAllocation, ReceiptHeader, ReceiptLeg, ReceiptOtherLine, ReceiptPdcVoucher, ReceiptStatusPayload, ReceiptTender } from '../../receipt/types/receipt-api.types';
import type { BillStatus, BillType, PdcStatus, VoucherStatus } from './payment-enum';
import type { VoucherWarning } from '../../vouchers/vouchers.errors';
import type { TillApprovalNeed } from '../../../till/types/till-api.types';
export type PaymentErrorDetail = ModuleApiErrorDetail;
export type PaymentErrorResponse = ModuleApiErrorResponse<PaymentErrorDetail>;
export type PaymentSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type PaymentHeader = ReceiptHeader;
export type PaymentLeg = ReceiptLeg;
export type PaymentAllocation = ReceiptAllocation;
export type PaymentPdcVoucher = ReceiptPdcVoucher;
export type PaymentAdvanceBill = ReceiptAdvanceBill;
export type PaymentStatusPayload = ReceiptStatusPayload;
export type PaymentOtherLine = ReceiptOtherLine & {
    approvedBy: string | null;
};
export type { AdjacentVoucher, AdjacentVoucherPayload, DuplicateCheckPayload, OpenCredit };
export interface PayableBill {
    billId: string;
    billAccYear: string;
    billType: BillType;
    docRefno: string;
    usrRefno: string | null;
    docDate: string;
    dueDate: string | null;
    billAmount: number;
    pendingAmount: number;
    status: BillStatus;
    daysOverdue: number;
    pdcHeld: number;
    ppdSuggested: number;
}
export interface PaymentOpenItemsParty {
    ledId: string;
    ledName: string;
    groupName: string | null;
    isBillByBill: boolean;
    isMoneyLedger: boolean;
    isTdsApplicable: boolean;
    tdsSection: string | null;
    tdsDeducteeType: string | null;
    tdsRate: number | null;
    tdsRateSource: 'MASTER' | 'NO_PAN' | null;
    tdsThresholdSingle: number | null;
    tdsThresholdAnnual: number | null;
    tdsPaidThisYear: number;
    panPresent: boolean;
    bank: {
        name: string;
        accountNo: string;
        ifsc: string | null;
    } | null;
    favouringName: string;
}
export interface PaymentOpenItemsSummary {
    totalPending: number;
    billCount: number;
    overdueCount: number;
    creditsHeld: number;
    pdcHeld: number;
}
export interface PaymentOpenItemsPayload {
    bills: PayableBill[];
    credits: OpenCredit[];
    summary: PaymentOpenItemsSummary;
    party: PaymentOpenItemsParty;
}
export interface PartyRecentPayment {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    instruments: string | null;
}
export interface PartyChequeOut {
    pdcId: string;
    accYear: string;
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
    totalBalance: number;
    totalOutstanding: number;
    totalCredits: number;
    chequesOutstanding: number;
}
export interface PaymentPartyContextPayload {
    partyId: string;
    partyName: string;
    summary: PaymentPartyContextSummary;
    lastPayments: PartyRecentPayment[];
    ourChequesOut: PartyChequeOut[];
}
export interface PaymentBeneficiary {
    name: string | null;
    accountNo: string | null;
    ifsc: string | null;
}
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
export interface PaymentTender extends ReceiptTender {
    beneficiary: PaymentBeneficiary | null;
    cheque: PaymentTenderCheque | null;
}
export interface PaymentCheque {
    pdcId: string;
    accYear: string;
    tenderRowNo: number | null;
    instrumentType: string;
    instrumentNo: string;
    instrumentDate: string;
    amount: number;
    bankName: string | null;
    bankLedgerId: string | null;
    chequeBookId: string | null;
    bookNo: string | null;
    favouring: string | null;
    acPayee: boolean;
    printed: boolean;
    printCount: number;
    status: PdcStatus;
    voucherId: string | null;
}
export interface PaymentDraftPayload {
    header: PaymentHeader;
    tenders: PaymentTender[];
    otherLines: PaymentOtherLine[];
    expectedRoles: string[];
}
export interface PaymentPayload {
    header: PaymentHeader;
    tenders: PaymentTender[];
    otherLines: PaymentOtherLine[];
    legs: PaymentLeg[];
    allocations: PaymentAllocation[];
    creditsApplied: PaymentAllocation[];
    chequesIssued: PaymentCheque[];
    pdcVouchers: PaymentPdcVoucher[];
    advanceBills: PaymentAdvanceBill[];
}
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
    warnings: VoucherWarning[];
    approval: TillApprovalNeed | null;
    cheques: Array<{
        tdRowNo: number;
        apdId: string;
        apdAccYear: string;
        leaf: string;
        bookNo: string;
    }>;
}
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
    tdsReversed: number;
}
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
