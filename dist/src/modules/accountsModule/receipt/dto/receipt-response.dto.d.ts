import { BillAdjType, BillSettlementMode, BillStatus, BillType, DrCr, PdcStatus, TcsBasis, VoucherStatus } from '../types/receipt-enum';
import type { AdjacentVoucher, AdjacentVoucherPayload, DuplicateCheckPayload, DuplicateReceipt, OpenBill, OpenCredit, OpenItemsParty, OpenItemsPayload, OpenItemsSummary, PartyContextPayload, PartyContextSummary, PartyPendingCheque, PartyRecentReceipt, ReceiptAdvanceBill, ReceiptAllocation, ReceiptAmendPayload, ReceiptCancelPayload, ReceiptCheque, ReceiptDeletePayload, ReceiptDraftPayload, ReceiptHeader, ReceiptLeg, ReceiptOtherLine, ReceiptPayload, ReceiptPdcVoucher, ReceiptPostPayload, ReceiptStatusPayload, ReceiptTender, RegularisePdcPayload } from '../types/receipt-api.types';
export declare class ReceiptErrorFieldDto {
    field: string;
    message: string;
}
export declare class ReceiptErrorResponseDto {
    success: false;
    message: string;
    errors: ReceiptErrorFieldDto[];
}
export declare class OpenBillDto implements OpenBill {
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
    billProfit: number | null;
    billProfitPreTax: number | null;
    pdcHeld: number;
    ppdSuggested: number;
    tcsAmount: number;
    tcsPending: number;
}
export declare class OpenCreditDto implements OpenCredit {
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
export declare class OpenItemsSummaryDto implements OpenItemsSummary {
    totalPending: number;
    billCount: number;
    overdueCount: number;
    creditsHeld: number;
    pdcHeld: number;
}
export declare class OpenItemsPartyDto implements OpenItemsParty {
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
export declare class OpenItemsPayloadDto implements OpenItemsPayload {
    bills: OpenBillDto[];
    credits: OpenCreditDto[];
    summary: OpenItemsSummaryDto;
    party: OpenItemsPartyDto;
}
export declare class OpenItemsSuccessDto {
    success: true;
    message: string;
    data: OpenItemsPayloadDto;
}
export declare class PartyRecentReceiptDto implements PartyRecentReceipt {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    instruments: string | null;
}
export declare class PartyPendingChequeDto implements PartyPendingCheque {
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
export declare class PartyContextSummaryDto implements PartyContextSummary {
    totalBalance: number;
    totalOutstanding: number;
    totalCredits: number;
    chequesOutstanding: number;
}
export declare class PartyContextPayloadDto implements PartyContextPayload {
    partyId: string;
    partyName: string;
    summary: PartyContextSummaryDto;
    lastReceipts: PartyRecentReceiptDto[];
    pendingCheques: PartyPendingChequeDto[];
}
export declare class PartyContextSuccessDto {
    success: true;
    message: string;
    data: PartyContextPayloadDto;
}
export declare class ReceiptTenderDto implements ReceiptTender {
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
export declare class ReceiptOtherLineDto implements ReceiptOtherLine {
    lineNo: number;
    role: string | null;
    ledgerId: string;
    ledgerName: string | null;
    drCr: DrCr;
    amount: number;
    settlesBill: boolean;
    narration: string | null;
}
export declare class ReceiptLegDto implements ReceiptLeg {
    avId: string;
    avRowNo: number;
    avDrCr: DrCr;
    avLedgerId: string;
    avLedgerName: string | null;
    avAmount: number;
    avRole: string | null;
    avRemarks: string | null;
}
export declare class ReceiptAllocationDto implements ReceiptAllocation {
    abjId: string | null;
    billId: string;
    billAccYear: string;
    docRefno: string;
    docDate: string | null;
    billType: BillType | null;
    billAmount: number | null;
    pendingAmount: number | null;
    dueDate: string | null;
    status: BillStatus | null;
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
    reversalOfId: string | null;
    isReversed: boolean;
    approvedBy: string | null;
    remarks: string | null;
}
export declare class ReceiptChequeDto implements ReceiptCheque {
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
export declare class ReceiptPdcVoucherDto implements ReceiptPdcVoucher {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    status: VoucherStatus;
    legs: ReceiptLegDto[];
}
export declare class ReceiptAdvanceBillDto implements ReceiptAdvanceBill {
    billId: string;
    billAccYear: string;
    docRefno: string;
    docDate: string;
    billAmount: number;
    pendingAmount: number;
    voucherId: string | null;
}
export declare class ReceiptHeaderDto implements ReceiptHeader {
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
export declare class ReceiptDraftPayloadDto implements ReceiptDraftPayload {
    header: ReceiptHeaderDto;
    tenders: ReceiptTenderDto[];
    otherLines: ReceiptOtherLineDto[];
    expectedRoles: string[];
}
export declare class ReceiptDraftSuccessDto {
    success: true;
    message: string;
    data: ReceiptDraftPayloadDto;
}
export declare class ReceiptPayloadDto implements ReceiptPayload {
    header: ReceiptHeaderDto;
    tenders: ReceiptTenderDto[];
    otherLines: ReceiptOtherLineDto[];
    legs: ReceiptLegDto[];
    allocations: ReceiptAllocationDto[];
    creditsApplied: ReceiptAllocationDto[];
    cheques: ReceiptChequeDto[];
    pdcVouchers: ReceiptPdcVoucherDto[];
    advanceBills: ReceiptAdvanceBillDto[];
}
export declare class ReceiptHeaderSuccessDto {
    success: true;
    message: string;
    data: ReceiptHeaderDto;
}
export declare class ReceiptSuccessDto {
    success: true;
    message: string;
    data: ReceiptPayloadDto;
}
export declare class ReceiptNumberedVoucherDto {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    isPdcVoucher: boolean;
}
export declare class ReceiptBillAfterDto {
    billId: string;
    billAccYear: string;
    docRefno: string;
    billAmount: number;
    pendingAmount: number;
    postDatedHeld: number;
}
export declare class ReceiptPostPayloadDto extends ReceiptPayloadDto implements ReceiptPostPayload {
    numberedVouchers: ReceiptNumberedVoucherDto[];
    billsAfter: ReceiptBillAfterDto[];
    totalOnAccount: number;
}
export declare class ReceiptPostSuccessDto {
    success: true;
    message: string;
    data: ReceiptPostPayloadDto;
}
export declare class ReceiptAmendUnwoundDto {
    adjustmentsReversed: number;
    legsRemoved: number;
    pdcVouchersRemoved: number;
    chequesRemoved: number;
    advanceBillsRemoved: number;
    tendersRemoved: number;
}
export declare class ReceiptAmendPayloadDto extends ReceiptPostPayloadDto implements ReceiptAmendPayload {
    fromRevision: number;
    toRevision: number;
    editRemark: string;
    unwound: ReceiptAmendUnwoundDto;
}
export declare class ReceiptAmendSuccessDto {
    success: true;
    message: string;
    data: ReceiptAmendPayloadDto;
}
export declare class ReceiptStatusPayloadDto implements ReceiptStatusPayload {
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    fromStatus: VoucherStatus;
    toStatus: VoucherStatus;
    avhStatusOn: string | null;
    avhStatusBy: string | null;
}
export declare class ReceiptReversalDto {
    ofVoucherId: string;
    reversalVoucherId: string;
    accYear: string;
    voucherRefno: string | null;
    legCount: number;
    adjustmentCount: number;
}
export declare class ReceiptBillReopenedDto {
    billId: string;
    billAccYear: string;
    docRefno: string;
    pendingAmount: number;
}
export declare class ReceiptCancelPayloadDto extends ReceiptStatusPayloadDto implements ReceiptCancelPayload {
    reversals: ReceiptReversalDto[];
    billsReopened: ReceiptBillReopenedDto[];
    chequesCancelled: string[];
    advanceBillsRemoved: string[];
}
export declare class ReceiptCancelSuccessDto {
    success: true;
    message: string;
    data: ReceiptCancelPayloadDto;
}
export declare class ReceiptDeletePayloadDto implements ReceiptDeletePayload {
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    status: VoucherStatus;
    deletedOn: string;
    deletedBy: string;
    tendersDeleted: number;
    otherLinesDeleted: number;
}
export declare class ReceiptDeleteSuccessDto {
    success: true;
    message: string;
    data: ReceiptDeletePayloadDto;
}
export declare class RegularisePdcPayloadDto implements RegularisePdcPayload {
    asOf: string;
    billsRegularised: number;
    billsExamined: number;
    companyId: string;
}
export declare class RegularisePdcSuccessDto {
    success: true;
    message: string;
    data: RegularisePdcPayloadDto;
}
export declare class AdjacentVoucherDto implements AdjacentVoucher {
    voucherId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    voucherRefno: string | null;
    voucherDate: string;
    partyId: string;
    partyName: string | null;
    docAmount: number;
    status: VoucherStatus;
}
export declare class AdjacentVoucherPayloadDto implements AdjacentVoucherPayload {
    direction: 'prev' | 'next';
    fromVoucherId: string;
    voucher: AdjacentVoucherDto | null;
}
export declare class AdjacentVoucherSuccessDto {
    success: true;
    message: string;
    data: AdjacentVoucherPayloadDto;
}
export declare class DuplicateReceiptDto implements DuplicateReceipt {
    voucherId: string;
    accYear: string;
    branchId: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    status: VoucherStatus;
    createdBy: string | null;
    createdOn: string;
}
export declare class DuplicateCheckPayloadDto implements DuplicateCheckPayload {
    isDuplicate: boolean;
    matches: DuplicateReceiptDto[];
}
export declare class DuplicateCheckSuccessDto {
    success: true;
    message: string;
    data: DuplicateCheckPayloadDto;
}
