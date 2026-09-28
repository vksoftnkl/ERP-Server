export interface IssuedChequePayload {
    apdId: string;
    apdAccYear: string;
    companyId: string;
    branchId: string;
    leaf: string;
    chequeDate: string;
    issuedOn: string;
    amount: number;
    partyId: string;
    partyName: string;
    favouring: string | null;
    acPayee: boolean;
    bankLedgerId: string | null;
    bankName: string | null;
    chequeBookId: string | null;
    bookNo: string | null;
    status: string;
    isPostDated: boolean;
    statusOn: string | null;
    presentedOn: string | null;
    returnedOn: string | null;
    returnReason: string | null;
    charges: number | null;
    cancelledOn: string | null;
    cancelReason: string | null;
    voucherId: string | null;
    voucherAccYear: string | null;
    voucherRefno: string | null;
    voucherDate: string | null;
    typeCode: string | null;
    paymentVoucherId: string | null;
    reversalVoucherId: string | null;
    reversalAccYear: string | null;
    reversalRefno: string | null;
    replacedById: string | null;
    replacedByAccYear: string | null;
    replacedByLeaf: string | null;
    replacesId: string | null;
    printCount: number;
    printedOn: string | null;
    remarks: string | null;
    createdBy: string | null;
}
export interface IssuedChequeHistoryEntry {
    seqNo: number;
    event: string;
    fromStatus: string | null;
    toStatus: string | null;
    changedOn: string;
    changedBy: string | null;
    remarks: string | null;
}
export interface IssuedChequeHistoryPayload {
    apdId: string;
    apdAccYear: string;
    leaf: string;
    issuedOn: string;
    issuedBy: string | null;
    voucherRefno: string | null;
    entries: IssuedChequeHistoryEntry[];
}
export interface IssuedChequeReversal {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    gross: number;
    tds: number;
    charges: number;
    allocationsReversed: number;
}
export interface ReplacedChequePayload {
    replaced: IssuedChequePayload;
    replacement: IssuedChequePayload;
}
export interface ChequeBookPayload {
    chequeBookId: string;
    companyId: string;
    branchId: string | null;
    bankLedgerId: string;
    bankName: string;
    bookNo: string;
    leafFrom: string;
    leafTo: string;
    nextLeaf: string | null;
    left: number;
    used: number;
    leafWidth: number;
    format: string | null;
    status: string;
    closedOn: string | null;
    closeReason: string | null;
    remarks: string | null;
    leaves: {
        leaf: string;
        apdId: string;
        apdAccYear: string;
        partyName: string;
        amount: number;
        status: string;
        voucherRefno: string | null;
    }[];
}
