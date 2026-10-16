import { Prisma } from '@prisma/client';
export declare const CHEQUE_TENDER_TYPE_ID = 5;
export declare const PDC_STATUS_HELD = "HELD";
export declare const PDC_STATUS_CANCELLED = "CANCELLED";
export interface PdcDocument {
    srcModule: string;
    srcDocType: string;
    docId: string;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    refno: string;
    docDate: Date;
    partyId: string;
    partyName: string | null;
    salesmanId: string | null;
    userId: string | null;
}
export interface PdcDocumentRules {
    label: string;
    refuseBackdated: boolean;
    checkDateWindow: boolean;
    onMoved?: (row: StoredPdcRow, change: 'changed' | 'removed') => never;
}
export interface PdcTenderLine {
    tdId: string;
    tdRowNo: number;
    tdTenderTypeId: number;
    tdTotalAmt: Prisma.Decimal;
    tdRefNo: string | null;
    tdInstrumentDate: Date | null;
    tdBankName: string | null;
    tdSettleLedgerId: string | null;
    tdNotes: string | null;
    cheque?: PdcChequeDetail | null;
}
export interface PdcChequeDetail {
    drawerName?: string | null;
    bankBranch?: string | null;
    ifsc?: string | null;
    micr?: string | null;
}
export interface PdcVoucher {
    voucherId: string;
    accYear: string;
}
export interface StoredPdcRow {
    apdId: string;
    apdAccYear: string;
    apdTenderId: string;
    apdInstrumentNo: string;
    apdStatus: string;
}
export declare function syncDocPdcRegister(tx: Prisma.TransactionClient, doc: PdcDocument, rules: PdcDocumentRules, tenders: PdcTenderLine[], voucher: PdcVoucher | null, actor: string, now: Date, opts: {
    keepStoredVoucher?: boolean;
    removedReason: string;
}): Promise<string[]>;
export declare function cancelDocPdcRegister(tx: Prisma.TransactionClient, doc: Pick<PdcDocument, 'srcModule' | 'srcDocType' | 'docId' | 'accYear'>, rules: PdcDocumentRules, reason: string, deleted: boolean, statusBy: string | null, actor: string, now: Date): Promise<string[]>;
export declare function assertDocPdcHeld(tx: Prisma.TransactionClient, doc: Pick<PdcDocument, 'srcModule' | 'srcDocType' | 'docId' | 'accYear'>, rules: PdcDocumentRules): Promise<void>;
export declare function findDocPdcRows(tx: Prisma.TransactionClient, doc: Pick<PdcDocument, 'srcModule' | 'srcDocType' | 'docId' | 'accYear'>): Promise<StoredPdcRow[]>;
export declare function matchChequeDetails(payload: readonly {
    tdId?: string;
    tdRowNo?: number;
    cheque?: PdcChequeDetail | null;
}[], persisted: readonly {
    tdId: string;
    tdRowNo: number;
    tdTenderTypeId: number | string;
    tdIsDeleted?: boolean | null;
}[]): Record<string, PdcChequeDetail | null>;
export declare function readPdcChequeDetails(client: Prisma.TransactionClient, tenderIds: readonly string[]): Promise<Map<string, Required<PdcChequeDetail>>>;
