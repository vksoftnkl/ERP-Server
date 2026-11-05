export declare class ChequeBookKeysDto {
    companyId: string;
    chequeBookId: string;
}
export declare class SaveChequeBookDto {
    chequeBookId?: string | null;
    companyId: string;
    branchId?: string | null;
    bankLedgerId: string;
    bookNo: string;
    leafFrom: number;
    leafTo: number;
    leafWidth?: number;
    format?: string | null;
    remarks?: string | null;
}
export declare class CloseChequeBookDto extends ChequeBookKeysDto {
    reason: string;
}
export declare class IssuedChequeKeysDto {
    apdId: string;
    apdAccYear: string;
    companyId: string;
    branchId: string;
}
export declare class PresentedChequeDto extends IssuedChequeKeysDto {
    date: string;
    remarks?: string | null;
}
export declare class ReverseChequeDto extends IssuedChequeKeysDto {
    date: string;
    reason: string;
    charges?: number;
}
export declare class VoidChequeDto extends IssuedChequeKeysDto {
    date?: string;
    reason: string;
}
export declare class ReplaceChequeDto extends IssuedChequeKeysDto {
    date: string;
    chequeBookId: string;
    bankLedgerId?: string | null;
    instrumentDate?: string | null;
    favouring?: string | null;
    acPayee?: boolean | null;
    reason: string;
}
