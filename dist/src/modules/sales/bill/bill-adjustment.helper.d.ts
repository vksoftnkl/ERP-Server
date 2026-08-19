import { Prisma } from '@prisma/client';
import { SaveBillAdjustmentDto } from './dto/save-bill-adjustment.dto';
export interface BillAdjustmentContext {
    billId: string;
    billAccYear: string;
    billAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    accYear: string;
    partyId: string;
    adjDate: Date;
    userId: string;
    sessionId: string | null;
}
export interface BillAdjustmentSyncResult {
    action: 'unchanged' | 'posted' | 'reversed' | 'replaced';
    adjustments: PostedAdjustment[];
}
export interface PostedAdjustment {
    againstBillId: string;
    againstBillAccYear: string;
    amount: Prisma.Decimal;
    adjType: string;
    settlementMode: string;
}
export declare function syncBillAdjustments(tx: Prisma.TransactionClient, ctx: BillAdjustmentContext, adjustments: SaveBillAdjustmentDto[] | undefined, actor: string, now: Date): Promise<BillAdjustmentSyncResult>;
