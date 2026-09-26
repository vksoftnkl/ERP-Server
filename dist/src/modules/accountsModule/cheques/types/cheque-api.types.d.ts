import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { PdcPostingMode, PdcStatus } from '../../receipt/types/receipt-enum';
import type { ChequeDueBucket } from './cheque-enum';
export type ChequeErrorDetail = ModuleApiErrorDetail;
export type ChequeErrorResponse = ModuleApiErrorResponse;
export type ChequeSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export interface ChequeRow {
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
export interface ChequeVoucherRef {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    voucherStatus: string;
    totalDebit: number;
    totalCredit: number;
}
export interface ChequeVoucherLeg {
    rowNo: number;
    drCr: string;
    ledgerId: string;
    ledgerName: string;
    amount: number;
    role: string | null;
    remarks: string | null;
}
export interface ChequeBillRef {
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
export interface ChequeListSummary {
    inHandCount: number;
    inHandAmount: number;
    withBankCount: number;
    withBankAmount: number;
    bouncedCount: number;
    bouncedAmount: number;
    clearedCount: number;
    clearedAmount: number;
}
export interface ChequeListPayload {
    rows: ChequeRow[];
    total: number;
    summary: ChequeListSummary;
}
export interface ChequeDetailPayload {
    cheque: ChequeRow;
    chequesInHandLedgerId: string | null;
    chequesInHandLedgerName: string | null;
    receiptVoucher: ChequeVoucherRef | null;
    clearVoucher: ChequeVoucherRef | null;
    bounceVoucher: ChequeVoucherRef | null;
    reissueVoucher: ChequeVoucherRef | null;
    bills: ChequeBillRef[];
    chargeBill: ChequeBillRef | null;
    replaces: ChequeRow | null;
    replacedBy: ChequeRow | null;
}
export interface ChequeHistoryEntry {
    seqNo: number;
    event: string;
    fromStatus: string | null;
    toStatus: string;
    changedOn: string;
    changedBy: string;
    remarks: string | null;
}
export interface ChequeHistoryPayload {
    apdId: string;
    apdAccYear: string;
    apdInstrumentNo: string;
    entries: ChequeHistoryEntry[];
}
export interface ChequeDepositPayload {
    rows: ChequeRow[];
    slip: {
        bankLedgerId: string;
        bankLedgerName: string;
        depositDate: string;
        slipNo: string;
        chequeCount: number;
        totalAmount: number;
    };
}
export interface ChequeClearPayload {
    cheque: ChequeRow;
    voucher: ChequeVoucherRef;
    legs: ChequeVoucherLeg[];
    billsSettled: ChequeBillRef[];
}
export interface ChequeCascadeReport {
    advanceBillsRemoved: Array<{
        billId: string;
        billAccYear: string;
        docRefno: string;
    }>;
    advanceApplicationsReversed: number;
    advancesLeftMixed: Array<{
        billId: string;
        billAccYear: string;
        docRefno: string;
    }>;
}
export interface ChequeBouncePayload {
    cheque: ChequeRow;
    voucher: ChequeVoucherRef;
    legs: ChequeVoucherLeg[];
    billsReopened: ChequeBillRef[];
    cascade: ChequeCascadeReport;
    chargeBill: ChequeBillRef | null;
    bankCharge: number;
    partyCharge: number;
}
export interface ChequeRepresentPayload {
    cheque: ChequeRow;
    reissueVoucher: ChequeVoucherRef | null;
    legs: ChequeVoucherLeg[];
    billsAllocated: ChequeBillRef[];
    slip: ChequeDepositPayload['slip'];
}
export interface ChequeReplacePayload {
    oldCheque: ChequeRow;
    newCheque: ChequeRow;
    reversalVoucher: ChequeVoucherRef | null;
    reissueVoucher: ChequeVoucherRef | null;
    legs: ChequeVoucherLeg[];
    billsAllocated: ChequeBillRef[];
    cascade: ChequeCascadeReport;
}
export interface ChequeReturnPayload {
    cheque: ChequeRow;
    reversalVoucher: ChequeVoucherRef | null;
    legs: ChequeVoucherLeg[];
    billsReopened: ChequeBillRef[];
    cascade: ChequeCascadeReport;
}
export interface DepositSlipBankAccount {
    ledgerId: string;
    ledgerName: string;
    accountHolder: string | null;
    bankName: string | null;
    branchName: string | null;
    accountNo: string | null;
    ifscCode: string | null;
    micrCode: string | null;
}
export interface DepositSlipLine {
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
export interface DepositSlipPayload {
    companyId: string;
    branchId: string;
    depositDate: string;
    slipNo: string;
    bankAccount: DepositSlipBankAccount;
    lines: DepositSlipLine[];
    chequeCount: number;
    totalAmount: number;
}
