import { Prisma } from '@prisma/client';
import type { BillLineFacts, DeliveryPendingService } from '../delivery/core/delivery-pending.service';
export interface BillDeliveryBlock {
    status: string;
    mode: string;
    billedPkgs: string;
    givenPkgs: string;
    leftPkgs: string;
    leftText: string;
    leftKg: string;
    given: {
        sdnId: string | null;
        accYear: string | null;
        refno: string;
        date: string;
        text: string;
    }[];
    drafts: {
        sdnId: string;
        refno: string;
        godownName: string;
    }[];
    oldestDays: number | null;
    qrToken: string | null;
}
export interface BillGodownSlip {
    godownId: string;
    godownName: string;
    lineCount: number;
}
export interface OldPendingDelivery {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    days: number;
    leftText: string;
}
export declare function leftTextOf(lines: readonly Pick<BillLineFacts, 'pendingQty' | 'unitId'>[], unitNames: ReadonlyMap<string, string>): string;
export declare function unitNamesOf(c: Prisma.TransactionClient, iucIds: readonly string[]): Promise<Map<string, string>>;
export declare function billDeliveryRead(c: Prisma.TransactionClient, pending: DeliveryPendingService, bill: {
    sbId: string;
    sbAccYear: string;
    sbBillDate: Date | null;
    sbDeliveryMode: string;
    sbDeliveryStatus: string;
}): Promise<{
    block: BillDeliveryBlock;
    byLine: Map<string, {
        delivered: string;
        pending: string;
    }>;
}>;
export declare function billGodownSlips(c: Prisma.TransactionClient, pending: DeliveryPendingService, bill: {
    sbId: string;
    sbAccYear: string;
    sbDeliveryMode: string;
}): Promise<BillGodownSlip[]>;
export declare function oldPendingDeliveries(c: Prisma.TransactionClient, q: {
    companyId: string;
    branchId: string;
    custId: string;
    oldDays: number;
    limit?: number;
}): Promise<OldPendingDelivery[]>;
export declare function istTodayYmd(): string;
