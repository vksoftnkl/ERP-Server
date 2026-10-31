import { Prisma } from '@prisma/client';
export declare const RETURN_CLAIM_LOCK = "purchase_claim";
export declare const SHORTAGE_CLAIM_LOCK = "purchase_shortage_claim";
export interface ClaimLockKey {
    ns: typeof RETURN_CLAIM_LOCK | typeof SHORTAGE_CLAIM_LOCK;
    id: string;
}
export declare function claimLockKeyOf(row: {
    returnItemId?: string | null;
    shortageCloseId?: string | null;
}): ClaimLockKey | null;
export declare function claimLockOrder(rows: readonly {
    returnItemId?: string | null;
    shortageCloseId?: string | null;
}[]): ClaimLockKey[];
export declare function lockClaims(tx: Prisma.TransactionClient, keys: readonly ClaimLockKey[]): Promise<void>;
