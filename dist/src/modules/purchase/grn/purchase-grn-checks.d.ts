import { Prisma } from '@prisma/client';
import { type Tx } from '../common/purchase-doc.helpers';
import type { PurIssue } from '../invoice/purchase-invoice-checks';
export interface GrnLineFact {
    index: number;
    lineNo: number;
    itemId: string;
    itemName: string | null;
    challan: Prisma.Decimal;
    received: Prisma.Decimal;
    damaged: Prisma.Decimal;
    free: Prisma.Decimal;
    damageReasonId: string | null;
    excess: Prisma.Decimal;
    excessAction: string | null;
    rows: {
        bucket: string;
        qty: Prisma.Decimal;
        mfgDate: Date | null;
        expiryDate: Date | null;
        serialNo: string | null;
    }[];
}
export interface GrnChip {
    code: 'OK' | 'SHORT' | 'DAMAGED' | 'SHELF_LIFE' | 'SERIALS' | 'EXCESS';
    text: string;
}
export interface GrnLineCheck {
    shortQty: string;
    damagedQty: string;
    damageReasonMissing: boolean;
    excessQty: string;
    excessAction: string | null;
    shelfLifePct: number | null;
    minShelfLifePct: number | null;
    labels: number;
    serials: {
        have: number;
        need: string;
    } | null;
    chips: GrnChip[];
}
export declare function grnShelfLife(tx: Pick<Tx, '$queryRaw'>, minPctSetting: number, receipt: string, facts: GrnLineFact[]): Promise<Map<number, {
    pct: number | null;
    min: number | null;
    expired: boolean;
}>>;
export declare function judgeGrnLines(facts: GrnLineFact[], shelf: Map<number, {
    pct: number | null;
    min: number | null;
    expired: boolean;
}>, shelfMode: 'OFF' | 'WARN' | 'REFUSE', tracked: Set<string>): {
    issues: PurIssue[];
    checks: Map<number, GrnLineCheck>;
};
