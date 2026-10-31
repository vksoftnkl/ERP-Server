import { PrismaService } from "../../../database/prisma/prisma.service";
import type { ItemInwardHistoryQueryDto } from './dto/item-inward-history-query.dto';
export declare const INWARD_PRICE_TXN_TYPES: readonly ["OPENING", "PURCHASE"];
export interface ItemInwardRow {
    date: string;
    txnType: (typeof INWARD_PRICE_TXN_TYPES)[number];
    refno: string | null;
    supplierId: string | null;
    supplierName: string | null;
    qty: number;
    freeQty: number;
    unitName: string | null;
    baseQty: number;
    costWot: number;
    taxPerc: number | null;
    cost: number;
    mrp: number | null;
    batchNo: string | null;
}
export declare class ItemInwardHistoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(q: ItemInwardHistoryQueryDto): Promise<ItemInwardRow[]>;
}
