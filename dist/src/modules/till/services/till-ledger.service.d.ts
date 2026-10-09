import { Prisma } from '@prisma/client';
import { TenderCloseMode } from '../types/till-enum';
type Tx = Prisma.TransactionClient;
export interface ExpectationSession {
    tssId: string;
    tssAccYear: string;
    tssCompanyId: string;
    tssBranchId: string;
    tssFloatCounted: Prisma.Decimal;
    tssClosedOn?: Date | null;
}
export interface TenderExpectation {
    tenderTypeId: number;
    tenderTypeName: string;
    closeMode: TenderCloseMode;
    tenderId: string | null;
    tenderName: string | null;
    ledgerId: string | null;
    open: Prisma.Decimal;
    sales: Prisma.Decimal;
    refund: Prisma.Decimal;
    receipt: Prisma.Decimal;
    payment: Prisma.Decimal;
    expense: Prisma.Decimal;
    movedIn: Prisma.Decimal;
    movedOut: Prisma.Decimal;
    paidFromBank: Prisma.Decimal;
    txnCount: number;
    noRefCount: number;
    expected: Prisma.Decimal;
}
export interface TillCashTender {
    tenderId: string;
    tenderName: string;
    ledgerId: string;
}
export interface SafeRef {
    safeId: string;
    ledgerId: string;
    name: string;
}
export declare class TillLedgerService {
    expected(tx: Tx, session: ExpectationSession): Promise<TenderExpectation[]>;
    private movementTotals;
    tillCashTender(tx: Tx, companyId: string, branchId: string): Promise<TillCashTender>;
    safeFor(tx: Tx, scope: {
        companyId: string;
        branchId: string;
        counterSafeId: string | null;
    }): Promise<SafeRef | null>;
    roleLedger(tx: Tx, role: string, companyId: string, branchId: string): Promise<string>;
}
export {};
