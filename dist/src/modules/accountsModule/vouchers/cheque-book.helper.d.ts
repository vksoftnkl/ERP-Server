import { Prisma } from '@prisma/client';
type Client = Prisma.TransactionClient;
export interface ChequeBookFacts {
    chequeBookId: string;
    companyId: string;
    branchId: string | null;
    bankLedgerId: string;
    bankName: string;
    bookNo: string;
    leafFrom: number;
    leafTo: number;
    nextLeaf: number;
    leafWidth: number;
    format: string | null;
    status: 'ACTIVE' | 'FINISHED' | 'CLOSED';
    remarks: string | null;
    isDeleted: boolean;
}
export declare function formatLeaf(leaf: number, width: number): string;
export declare function leavesLeft(b: Pick<ChequeBookFacts, 'leafTo' | 'nextLeaf'>): number;
export declare function loadChequeBooks(tx: Client, ids: readonly string[]): Promise<Map<string, ChequeBookFacts>>;
export declare function loadChequeBook(tx: Client, id: string): Promise<ChequeBookFacts | null>;
export declare function listOpenChequeBooks(tx: Client, q: {
    companyId: string;
    branchId?: string | null;
    bankLedgerId?: string | null;
}): Promise<ChequeBookFacts[]>;
export interface TakenLeaf {
    chequeBookId: string;
    bookNo: string;
    leaf: string;
    leafNo: number;
}
export declare function takeNextLeaf(tx: Client, chequeBookId: string, actor: string): Promise<TakenLeaf | null>;
export {};
