import { Prisma } from '@prisma/client';
import type { BillLineFacts } from './core/delivery-pending.service';
import { type DeliveryNote } from './delivery.errors';
export type RulePhase = 'save' | 'validate' | 'post';
export interface RuleHeader {
    godownId: string | null;
    godownState: 'OK' | 'MISSING' | 'OTHER_BRANCH';
    godownName: string;
    branchName: string;
    godownLocked: boolean;
    storedGodownName: string;
    mode: string;
    vehicleId: string | null;
    vehicleNo: string | null;
    vehicleLabel: string;
    capacityKg: Prisma.Decimal | null;
    transporterId: string | null;
    transporterName: string | null;
    collectedBy: string | null;
    frozen: {
        from: string;
        to: string;
    } | null;
}
export interface RuleLine {
    lineNo: number;
    billId: string;
    billAccYear: string;
    billItemId: string;
    qty: Prisma.Decimal | null;
    facts: BillLineFacts | null;
    bodyGodownId: string | null;
    lotId: string | null;
    lotKnown: boolean;
    shelfBase: Prisma.Decimal;
    names: {
        bill: string;
        item: string;
        unit: string;
        billGodown: string;
        godown: string;
        lot: string;
        billLot: string;
    };
}
export interface RuleContext {
    phase: RulePhase;
    companyId: string;
    branchId: string;
    canOverride: boolean;
    overrideWarnings: readonly string[];
}
export interface NoteTotals {
    lines: number;
    qty: string;
    bags: string;
    weightKg: string;
    bills: number;
}
export interface NoteLoad {
    capacityKg: string | null;
    weightKg: string;
    percent: number | null;
    spareKg: string | null;
}
export declare function checkDeliveryNote(header: RuleHeader, lines: readonly RuleLine[], ctx: RuleContext): DeliveryNote[];
export declare function noteTotals(lines: readonly RuleLine[]): NoteTotals;
export declare function noteLoad(header: Pick<RuleHeader, 'capacityKg'>, totals: NoteTotals): NoteLoad;
export declare function firstRefusal(notes: readonly DeliveryNote[]): DeliveryNote | null;
