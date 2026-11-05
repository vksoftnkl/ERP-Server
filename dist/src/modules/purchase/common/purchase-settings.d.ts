import type { Prisma } from '@prisma/client';
export interface PurchaseSettings {
    defaultEntry: 'DIRECT' | 'GRN';
    invAmountCheck: 'REFUSE' | 'WARN';
    duplicateBillMode: 'REFUSE' | 'WARN';
    labelsAfterPost: 'ASK' | 'ALWAYS' | 'NEVER';
    allowPriceUpdate: boolean;
    priceUpdate: 'UPDATE_PRICES' | 'COST_ONLY' | 'OPEN_CHANGE_SELLING' | 'NONE';
    priceSetAt: 'INVOICE' | 'GRN';
    rateTolerancePct: number;
    shelfLifeMode: 'OFF' | 'WARN' | 'REFUSE';
    minShelfLifePct: number;
    closePoOnFirstBill: boolean;
    poApprovalAbove: number;
    returnSettlementDefault: 'ADJUST' | 'ADVANCE' | 'CASH';
}
export declare function loadPurchaseSettings(tx: Prisma.TransactionClient, companyId: string, branchId: string): Promise<PurchaseSettings>;
