export declare enum PostingDocument {
    RECEIPT = "RECEIPT",
    CHEQUE = "CHEQUE",
    OPENING_BALANCE = "OPENING_BALANCE"
}
export declare function documentsUsingRole(role: string): readonly PostingDocument[];
export declare function describeDocuments(documents: readonly PostingDocument[]): string;
