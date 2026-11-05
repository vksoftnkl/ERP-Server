import { Prisma } from '@prisma/client';
import type { ReceiptOtherLine } from './types/receipt-api.types';
export interface DraftChequeDetail {
    bankBranch: string | null;
    ifsc: string | null;
    micr: string | null;
    drawerName: string | null;
    bankLedgerId: string | null;
}
export interface DraftAllocation {
    billId: string;
    billAccYear: string;
    amount: number;
    discount: number;
    writeoff: number;
    roundoff: number;
    writeoffApprovedBy: string | null;
}
export interface DraftCredit {
    billId: string;
    billAccYear: string;
    amount: number;
}
export interface DraftLines {
    otherLines: ReceiptOtherLine[];
    cheques: Record<number, DraftChequeDetail | undefined>;
    allocations: DraftAllocation[];
    creditsApplied: DraftCredit[];
}
export declare function emptyDraft(): DraftLines;
export declare function buildDraftLines(otherLines: readonly ReceiptOtherLine[], cheques: Record<number, DraftChequeDetail | null>, allocations: readonly DraftAllocation[], creditsApplied: readonly DraftCredit[]): Prisma.InputJsonValue;
export declare function rehydrateDraft(value: Prisma.JsonValue | null | undefined): DraftLines;
