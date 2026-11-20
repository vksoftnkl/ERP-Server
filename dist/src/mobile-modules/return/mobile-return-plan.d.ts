import { Prisma } from '@prisma/client';
import type { OpenBillFacts } from '../../modules/sales/sale-return/sale-return-bill-reader';
import type { AdjustAsk } from '../../modules/sales/sale-return/sale-return-settlement';
import type { MobileReturnNote, MobileReturnOutcome, MobileReturnReplanned } from './types/mobile-return-api.types';
export interface PhoneAdjustRow {
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
}
export interface ReplanResult {
    asks: AdjustAsk[];
    replanned: MobileReturnReplanned[];
}
export declare function replanAdjust(input: {
    rows: readonly PhoneAdjustRow[];
    bills: readonly OpenBillFacts[];
    adjustable: Prisma.Decimal;
}): ReplanResult;
export declare const MOBILE_RETURN_HELD_CODES: ReadonlySet<string>;
export declare const isHeldCode: (code: string) => boolean;
export declare function refusalsOf(error: unknown): MobileReturnNote[] | null;
export declare function outcomeOf(refusals: readonly MobileReturnNote[]): {
    status: Exclude<MobileReturnOutcome, 'POSTED'>;
    first: MobileReturnNote;
};
export declare function phoneApprovalStatus(tapStatus: string): 'PENDING' | 'APPROVED' | 'REJECTED' | null;
export declare function billReturnStatus(status: string | null): 'NONE' | 'PARTIAL' | 'FULL';
export declare const MOBILE_RETURN_DEFAULT_BILL_DAYS = 90;
export declare function billDaysOf(returnWindowDays: number): number;
export declare function phoneCondition(condition: string | null): 'RESTOCK' | 'DAMAGED' | 'EXPIRED' | 'SCRAP' | null;
export declare function phoneSettleDefault(value: string | null): 'ADJUST' | 'ADVANCE' | null;
