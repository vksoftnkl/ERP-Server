import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { BillAdjType, BillSettlementMode, BillStatus, BillType, DrCr, PdcStatus, TcsBasis, VoucherStatus } from './receipt-enum';
export type ReceiptErrorDetail = ModuleApiErrorDetail;
export type ReceiptErrorResponse = ModuleApiErrorResponse<ReceiptErrorDetail>;
export type ReceiptSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export interface OpenBill {
    billId: string;
    billAccYear: string;
    billType: BillType;
    docRefno: string;
    docDate: string;
    dueDate: string | null;
    billAmount: number;
    pendingAmount: number;
    status: BillStatus;
    daysOverdue: number;
    pdcHeld: number;
    ppdSuggested: number;
    tcsAmount: number;
    tcsPending: number;
}
export interface OpenCredit {
    billId: string;
    billAccYear: string;
    billType: BillType;
    docRefno: string;
    docDate: string;
    billAmount: number;
    pendingAmount: number;
    srcModule: string | null;
    srcDocType: string | null;
    srcDocId: string | null;
    srcAccYear: string | null;
    narration: string | null;
    status: BillStatus;
    drCr: DrCr;
    adjType: BillAdjType;
    settlementMode: BillSettlementMode;
}
export interface OpenItemsSummary {
    totalPending: number;
    billCount: number;
    overdueCount: number;
    creditsHeld: number;
    pdcHeld: number;
}
export interface OpenItemsParty {
    ledId: string;
    ledName: string;
    groupName: string | null;
    isBillByBill: boolean;
    isTdsApplicable: boolean;
    tdsDeducteeType: string | null;
    isTcsApplicable: boolean;
    tcsBasis: TcsBasis;
    tanNo: string | null;
}
export interface OpenItemsPayload {
    bills: OpenBill[];
    credits: OpenCredit[];
    summary: OpenItemsSummary;
    party: OpenItemsParty;
}
export interface PartyRecentReceipt {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    instruments: string | null;
}
export interface PartyPendingCheque {
    pdcId: string;
    accYear: string;
    instrumentNo: string;
    instrumentDate: string;
    amount: number;
    bankName: string | null;
    status: PdcStatus;
    voucherId: string | null;
    voucherRefno: string | null;
}
export interface PartyContextPayload {
    partyId: string;
    lastReceipts: PartyRecentReceipt[];
    pendingCheques: PartyPendingCheque[];
}
export interface ReceiptTender {
    tdId: string;
    tdRowNo: number;
    tdTenderId: string;
    tdTenderName: string | null;
    tdTenderTypeId: number;
    tdTenderLedgerId: string;
    tdAmount: number;
    tdSurchargePerc: number;
    tdSurchargeAmt: number;
    tdMdrAmt: number;
    tdReceivedAmt: number;
    tdChangeAmt: number;
    tdRefNo: string | null;
    tdBankName: string | null;
    tdPayerVpa: string | null;
    tdInstrumentDate: string | null;
    tdIsPdc: boolean;
    tdVoucherId: string | null;
}
export interface ReceiptOtherLine {
    lineNo: number;
    role: string | null;
    ledgerId: string;
    ledgerName: string | null;
    drCr: DrCr;
    amount: number;
    settlesBill: boolean;
    narration: string | null;
}
export interface ReceiptLeg {
    avId: string;
    avRowNo: number;
    avDrCr: DrCr;
    avLedgerId: string;
    avLedgerName: string | null;
    avAmount: number;
    avRole: string | null;
    avRemarks: string | null;
}
export interface ReceiptAllocation {
    abjId: string;
    billId: string;
    billAccYear: string;
    docRefno: string;
    docDate: string;
    adjType: BillAdjType;
    settlementMode: BillSettlementMode | null;
    drCr: DrCr;
    amount: number;
    adjDate: string;
    isPostDated: boolean;
    matured: boolean;
    voucherId: string | null;
    chequeId: string | null;
    againstBillId: string | null;
    againstBillRefno: string | null;
    approvedBy: string | null;
    remarks: string | null;
}
export interface ReceiptCheque {
    pdcId: string;
    accYear: string;
    tenderRowNo: number | null;
    instrumentType: string;
    instrumentNo: string;
    instrumentDate: string;
    amount: number;
    bankName: string | null;
    bankBranch: string | null;
    ifsc: string | null;
    drawerName: string | null;
    bankLedgerId: string | null;
    status: PdcStatus;
    postingMode: string;
    voucherId: string | null;
}
export interface ReceiptPdcVoucher {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    status: VoucherStatus;
    legs: ReceiptLeg[];
}
export interface ReceiptAdvanceBill {
    billId: string;
    billAccYear: string;
    docRefno: string;
    docDate: string;
    billAmount: number;
    pendingAmount: number;
    voucherId: string | null;
}
export interface ReceiptHeader {
    avhVoucherId: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhTenantId: string | null;
    avhAccYear: string;
    avhVoucherTypeId: number;
    avhVoucherNo: string | null;
    avhVoucherSlno: string | null;
    avhVoucherRefno: string | null;
    avhVoucherDate: string;
    avhPartyId: string;
    avhPartyName: string | null;
    avhEmployeeId: string[];
    avhUsrRefno: string | null;
    avhDocRefno: string | null;
    avhDocDate: string | null;
    avhDocAmount: number;
    avhAdjustAmount: number;
    avhRoundOff: number;
    avhTotalDebit: number;
    avhTotalCredit: number;
    avhRemarks: string | null;
    avhVoucherStatus: VoucherStatus;
    avhStatusOn: string | null;
    avhStatusBy: string | null;
    avhPostedOn: string | null;
    avhCancelReason: string | null;
    avhRevisionNo: number;
    avhReversalVoucherId: string | null;
    avhAgainstVoucherId: string | null;
    avhPrintCount: number;
    avhDeviceType: string | null;
    avhUserId: string;
    avhCreatedOn: string;
    avhCreatedBy: string | null;
    avhModifiedOn: string | null;
    avhModifiedBy: string | null;
}
export interface ReceiptDraftPayload {
    header: ReceiptHeader;
    tenders: ReceiptTender[];
    otherLines: ReceiptOtherLine[];
    expectedRoles: string[];
}
export interface ReceiptPayload {
    header: ReceiptHeader;
    tenders: ReceiptTender[];
    otherLines: ReceiptOtherLine[];
    legs: ReceiptLeg[];
    allocations: ReceiptAllocation[];
    creditsApplied: ReceiptAllocation[];
    cheques: ReceiptCheque[];
    pdcVouchers: ReceiptPdcVoucher[];
    advanceBills: ReceiptAdvanceBill[];
}
export interface ReceiptPostPayload extends ReceiptPayload {
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
}
export interface ReceiptStatusPayload {
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    fromStatus: VoucherStatus;
    toStatus: VoucherStatus;
    avhStatusOn: string | null;
    avhStatusBy: string | null;
}
export interface ReceiptCancelPayload extends ReceiptStatusPayload {
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
}
export interface ReceiptAmendPayload extends ReceiptPostPayload {
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
    };
}
export interface RegularisePdcPayload {
    asOf: string;
    billsRegularised: number;
}
export interface ReceiptDeletePayload {
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    status: VoucherStatus;
    deletedOn: string;
    deletedBy: string;
    tendersDeleted: number;
    otherLinesDeleted: number;
}
