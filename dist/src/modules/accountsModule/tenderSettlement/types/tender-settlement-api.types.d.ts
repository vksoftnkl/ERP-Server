import type { SettlementImportStatus, SettlementLineKind, SettlementMatchRule, SettlementMatchStatus, SettlementResolution, SettlementSource, WriteOffTreatment } from './tender-settlement-enum';
import type { StatementFormat } from '../settlement-format';
export interface SettlementSuccessResponse<T> {
    success: true;
    message: string;
    data: T;
}
export interface SettlementTenderRowPayload {
    tdId: string;
    tdAccYear: string;
    srcDocType: string;
    srcDocId: string;
    docRefno: string | null;
    docDate: string;
    amount: number;
    refNo: string | null;
    authCode: string | null;
    cardLast4: string | null;
    settleStatus: string;
    sessionId: string | null;
    createdOn: string;
}
export interface SettlementLinePayload {
    aslId: string;
    rowNo: number;
    kind: SettlementLineKind;
    txnOn: string | null;
    terminalId: string | null;
    vpa: string | null;
    tenderId: string | null;
    refNo: string | null;
    authCode: string | null;
    cardLast4: string | null;
    payer: string | null;
    gross: number;
    fee: number;
    tax: number;
    net: number;
    matchStatus: SettlementMatchStatus;
    matchRule: SettlementMatchRule | null;
    amountDiff: number;
    tenderRow: SettlementTenderRowPayload | null;
    resolution: SettlementResolution | null;
    reasonId: string | null;
    resolutionVoucherId: string | null;
    notes: string | null;
}
export interface SettlementImportPayload {
    asiId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    source: SettlementSource;
    provider: string;
    tenderId: string | null;
    fileName: string;
    payoutRef: string | null;
    payoutDate: string;
    periodFrom: string | null;
    periodTo: string | null;
    lineCount: number;
    totalGross: number;
    totalFee: number;
    totalTax: number;
    totalNet: number;
    status: SettlementImportStatus;
    bankLedgerId: string | null;
    bankLedgerName: string | null;
    voucherId: string | null;
    voucherRefno: string | null;
    importedOn: string;
    postedOn: string | null;
    voidReason: string | null;
    notes: string | null;
    counts: Record<SettlementMatchStatus, number>;
    lines?: SettlementLinePayload[];
}
export interface SettlementImportResultPayload {
    imports: SettlementImportPayload[];
}
export interface SettlementLegPayload {
    drCr: 'DR' | 'CR';
    ledgerId: string;
    ledgerName: string | null;
    role: string | null;
    amount: number;
}
export interface SettlementPostPayload extends SettlementImportPayload {
    legs: SettlementLegPayload[];
}
export interface SettlementResolvePayload {
    line: SettlementLinePayload;
    voucherId: string | null;
    voucherRefno: string | null;
    legs: SettlementLegPayload[];
    approvalEvent: 'SETTLEMENT_RESOLVE';
}
export interface WriteOffPayload {
    tdId: string;
    tdAccYear: string;
    treatment: WriteOffTreatment;
    amount: number;
    debitLedgerId: string;
    creditLedgerId: string;
    voucherId: string | null;
    voucherRefno: string | null;
    voucherAccYear: string | null;
    sessionId: string | null;
    approvalEvent: 'NONCASH_WRITE_OFF';
}
export interface SettlementFormatPayload {
    tenderId: string;
    tenderName: string;
    terminalId: string | null;
    upiVpa: string | null;
    settlementLedgerId: string | null;
    settlementDays: number;
    format: StatementFormat | null;
}
export interface SettlementFormatTestPayload {
    lines: {
        lineNo: number;
        kind: SettlementLineKind;
        txnOn: string | null;
        terminalId: string | null;
        refNo: string | null;
        authCode: string | null;
        cardLast4: string | null;
        gross: number;
        fee: number;
        tax: number;
        net: number;
        payoutRef: string | null;
        payoutDate: string | null;
    }[];
    problems: {
        lineNo: number;
        message: string;
    }[];
    payouts: {
        payoutRef: string | null;
        payoutDate: string | null;
        lines: number;
        net: number;
    }[];
}
