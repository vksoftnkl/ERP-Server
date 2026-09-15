import { Prisma } from '@prisma/client';
import type { ReceiptOtherLine } from './types/receipt-api.types';
export interface DraftChequeDetail {
    bankBranch: string | null;
    ifsc: string | null;
    micr: string | null;
    drawerName: string | null;
    bankLedgerId: string | null;
}
export interface DraftLines {
    otherLines: ReceiptOtherLine[];
    cheques: Record<number, DraftChequeDetail | undefined>;
}
export declare function emptyDraft(): DraftLines;
export declare function buildDraftLines(otherLines: readonly ReceiptOtherLine[], cheques: Record<number, DraftChequeDetail | null>): Prisma.InputJsonValue;
export declare function rehydrateDraft(value: Prisma.JsonValue | null | undefined): DraftLines;
