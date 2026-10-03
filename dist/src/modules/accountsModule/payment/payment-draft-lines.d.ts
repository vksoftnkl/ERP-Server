import { Prisma } from '@prisma/client';
import type { DraftAllocation, DraftCredit } from '../receipt/receipt-draft-lines';
import type { PaymentBeneficiary, PaymentOtherLine } from './types/payment-api.types';
export type { DraftAllocation, DraftCredit };
export interface PaymentDraftChequeDetail {
    chequeBookId: string;
    favouring: string | null;
    acPayee: boolean;
    bankBranch: string | null;
    ifsc: string | null;
    micr: string | null;
    drawerName: string | null;
}
export interface PaymentDraftLines {
    otherLines: PaymentOtherLine[];
    cheques: Record<number, PaymentDraftChequeDetail | undefined>;
    beneficiaries: Record<number, PaymentBeneficiary | undefined>;
    allocations: DraftAllocation[];
    creditsApplied: DraftCredit[];
}
export declare function emptyPaymentDraft(): PaymentDraftLines;
export declare function buildPaymentDraftLines(otherLines: readonly PaymentOtherLine[], cheques: Record<number, PaymentDraftChequeDetail | null>, beneficiaries: Record<number, PaymentBeneficiary | null>, allocations: readonly DraftAllocation[], creditsApplied: readonly DraftCredit[]): Prisma.InputJsonValue;
export declare function rehydratePaymentDraft(value: Prisma.JsonValue | null | undefined): PaymentDraftLines;
