import { PdcPostingMode, PdcStatus } from '../../receipt/types/receipt-enum';
import { ChequeDueBucket } from '../types/cheque-enum';
import type { ChequeBillRef, ChequeBouncePayload, ChequeCascadeReport, ChequeClearPayload, ChequeDepositPayload, ChequeDetailPayload, ChequeHistoryEntry, ChequeHistoryPayload, ChequeListPayload, ChequeListSummary, ChequeReplacePayload, ChequeRepresentPayload, ChequeReturnPayload, ChequeRow, ChequeVoucherLeg, ChequeVoucherRef, DepositSlipBankAccount, DepositSlipLine, DepositSlipPayload } from '../types/cheque-api.types';
export declare class ChequeRowDto implements ChequeRow {
    apdId: string;
    apdAccYear: string;
    apdCompanyId: string;
    apdBranchId: string;
    apdTraType: string;
    apdPartyId: string;
    partyName: string;
    apdInstrumentType: string;
    apdInstrumentNo: string;
    apdInstrumentDate: string;
    apdAmount: number;
    apdBankName: string | null;
    apdBankBranch: string | null;
    apdIfsc: string | null;
    apdMicr: string | null;
    apdDrawerName: string | null;
    apdReceivedOn: string;
    apdBankLedgerId: string | null;
    bankLedgerName: string | null;
    apdPostingMode: PdcPostingMode;
    apdStatus: PdcStatus;
    dueBucket: ChequeDueBucket | null;
    apdPresentCount: number;
    apdDepositDate: string | null;
    apdDepositSlipNo: string | null;
    apdClearDate: string | null;
    apdBounceDate: string | null;
    apdBounceReason: string | null;
    apdBounceCharges: number;
    apdRemarks: string | null;
    apdStatusOn: string | null;
    apdStatusBy: string | null;
}
export declare class ChequeVoucherRefDto implements ChequeVoucherRef {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    voucherStatus: string;
    totalDebit: number;
    totalCredit: number;
}
export declare class ChequeVoucherLegDto implements ChequeVoucherLeg {
    rowNo: number;
    drCr: string;
    ledgerId: string;
    ledgerName: string;
    amount: number;
    role: string | null;
    remarks: string | null;
}
export declare class ChequeBillRefDto implements ChequeBillRef {
    billId: string;
    billAccYear: string;
    billType: string;
    docRefno: string;
    docDate: string;
    dueDate: string | null;
    billAmount: number;
    pendingAmount: number;
    settledByThisCheque: number;
}
export declare class ChequeListSummaryDto implements ChequeListSummary {
    inHandCount: number;
    inHandAmount: number;
    withBankCount: number;
    withBankAmount: number;
    bouncedCount: number;
    bouncedAmount: number;
    clearedCount: number;
    clearedAmount: number;
}
export declare class ChequeListPayloadDto implements ChequeListPayload {
    rows: ChequeRowDto[];
    total: number;
    summary: ChequeListSummaryDto;
}
export declare class ChequeListSuccessDto {
    success: true;
    message: string;
    data: ChequeListPayloadDto;
}
export declare class ChequeDetailPayloadDto implements ChequeDetailPayload {
    cheque: ChequeRowDto;
    chequesInHandLedgerId: string | null;
    chequesInHandLedgerName: string | null;
    receiptVoucher: ChequeVoucherRefDto | null;
    clearVoucher: ChequeVoucherRefDto | null;
    bounceVoucher: ChequeVoucherRefDto | null;
    reissueVoucher: ChequeVoucherRefDto | null;
    bills: ChequeBillRefDto[];
    chargeBill: ChequeBillRefDto | null;
    replaces: ChequeRowDto | null;
    replacedBy: ChequeRowDto | null;
}
export declare class ChequeDetailSuccessDto {
    success: true;
    message: string;
    data: ChequeDetailPayloadDto;
}
export declare class ChequeHistoryEntryDto implements ChequeHistoryEntry {
    seqNo: number;
    event: string;
    fromStatus: string | null;
    toStatus: string;
    changedOn: string;
    changedBy: string;
    remarks: string | null;
}
export declare class ChequeHistoryPayloadDto implements ChequeHistoryPayload {
    apdId: string;
    apdAccYear: string;
    apdInstrumentNo: string;
    entries: ChequeHistoryEntryDto[];
}
export declare class ChequeHistorySuccessDto {
    success: true;
    message: string;
    data: ChequeHistoryPayloadDto;
}
export declare class DepositSlipSummaryDto {
    bankLedgerId: string;
    bankLedgerName: string;
    depositDate: string;
    slipNo: string;
    chequeCount: number;
    totalAmount: number;
}
export declare class ChequeDepositPayloadDto implements ChequeDepositPayload {
    rows: ChequeRowDto[];
    slip: DepositSlipSummaryDto;
}
export declare class ChequeDepositSuccessDto {
    success: true;
    message: string;
    data: ChequeDepositPayloadDto;
}
export declare class ChequeClearPayloadDto implements ChequeClearPayload {
    cheque: ChequeRowDto;
    voucher: ChequeVoucherRefDto;
    legs: ChequeVoucherLegDto[];
    billsSettled: ChequeBillRefDto[];
}
export declare class ChequeClearSuccessDto {
    success: true;
    message: string;
    data: ChequeClearPayloadDto;
}
export declare class CascadeBillRefDto {
    billId: string;
    billAccYear: string;
    docRefno: string;
}
export declare class ChequeCascadeReportDto implements ChequeCascadeReport {
    advanceBillsRemoved: CascadeBillRefDto[];
    advanceApplicationsReversed: number;
    advancesLeftMixed: CascadeBillRefDto[];
}
export declare class ChequeBouncePayloadDto implements ChequeBouncePayload {
    cheque: ChequeRowDto;
    voucher: ChequeVoucherRefDto;
    legs: ChequeVoucherLegDto[];
    billsReopened: ChequeBillRefDto[];
    cascade: ChequeCascadeReportDto;
    chargeBill: ChequeBillRefDto | null;
    bankCharge: number;
    partyCharge: number;
}
export declare class ChequeBounceSuccessDto {
    success: true;
    message: string;
    data: ChequeBouncePayloadDto;
}
export declare class ChequeRepresentPayloadDto implements ChequeRepresentPayload {
    cheque: ChequeRowDto;
    reissueVoucher: ChequeVoucherRefDto | null;
    legs: ChequeVoucherLegDto[];
    billsAllocated: ChequeBillRefDto[];
    slip: DepositSlipSummaryDto;
}
export declare class ChequeRepresentSuccessDto {
    success: true;
    message: string;
    data: ChequeRepresentPayloadDto;
}
export declare class ChequeReplacePayloadDto implements ChequeReplacePayload {
    oldCheque: ChequeRowDto;
    newCheque: ChequeRowDto;
    reversalVoucher: ChequeVoucherRefDto | null;
    reissueVoucher: ChequeVoucherRefDto | null;
    legs: ChequeVoucherLegDto[];
    billsAllocated: ChequeBillRefDto[];
    cascade: ChequeCascadeReportDto;
}
export declare class ChequeReplaceSuccessDto {
    success: true;
    message: string;
    data: ChequeReplacePayloadDto;
}
export declare class ChequeReturnPayloadDto implements ChequeReturnPayload {
    cheque: ChequeRowDto;
    reversalVoucher: ChequeVoucherRefDto | null;
    legs: ChequeVoucherLegDto[];
    billsReopened: ChequeBillRefDto[];
    cascade: ChequeCascadeReportDto;
}
export declare class ChequeReturnSuccessDto {
    success: true;
    message: string;
    data: ChequeReturnPayloadDto;
}
export declare class DepositSlipBankAccountDto implements DepositSlipBankAccount {
    ledgerId: string;
    ledgerName: string;
    accountHolder: string | null;
    bankName: string | null;
    branchName: string | null;
    accountNo: string | null;
    ifscCode: string | null;
    micrCode: string | null;
}
export declare class DepositSlipLineDto implements DepositSlipLine {
    lineNo: number;
    apdId: string;
    apdAccYear: string;
    instrumentType: string;
    instrumentNo: string;
    instrumentDate: string;
    drawnOnBank: string | null;
    drawnOnBranch: string | null;
    micr: string | null;
    drawerName: string | null;
    partyName: string;
    amount: number;
}
export declare class DepositSlipPayloadDto implements DepositSlipPayload {
    companyId: string;
    branchId: string;
    depositDate: string;
    slipNo: string;
    bankAccount: DepositSlipBankAccountDto;
    lines: DepositSlipLineDto[];
    chequeCount: number;
    totalAmount: number;
}
export declare class DepositSlipSuccessDto {
    success: true;
    message: string;
    data: DepositSlipPayloadDto;
}
export declare class ChequeErrorDetailDto {
    field: string;
    message: string;
}
export declare class ChequeErrorResponseDto {
    success: false;
    message: string;
    errors: ChequeErrorDetailDto[];
}
