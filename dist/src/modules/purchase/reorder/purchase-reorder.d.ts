import { Prisma } from '@prisma/client';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { PurchaseOrderService } from '../order/purchase-order';
export declare const REORDER_MENU_ID = 296;
export declare class ReorderQueryDto {
    companyId: string;
    branchId: string;
    supplierId?: string;
    belowOnly?: boolean;
}
export declare class ReorderRowDto {
    itemId: string;
    uomId: string;
    qty: number;
    supplierId: string;
    rate?: number;
}
export declare class CreateReorderPosDto {
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
    docDate?: string;
    godownId?: string;
    rows: ReorderRowDto[];
}
export declare class PurchaseReorderService {
    private readonly prisma;
    private readonly orders;
    constructor(prisma: PrismaService, orders: PurchaseOrderService);
    suggestions(q: ReorderQueryDto): Promise<{
        reorderId: unknown;
        itemId: unknown;
        itemName: unknown;
        itemCode: unknown;
        uomId: unknown;
        unitName: unknown;
        godownId: {} | null;
        godownName: {} | null;
        reorderType: unknown;
        onHand: Prisma.Decimal;
        onOrder: Prisma.Decimal;
        cover: Prisma.Decimal;
        reorderLevel: Prisma.Decimal;
        minLevel: Prisma.Decimal;
        maxLevel: Prisma.Decimal;
        reorderQty: Prisma.Decimal;
        leadDays: unknown;
        below: boolean;
        suggestedQty: Prisma.Decimal;
        supplierId: string | null;
        supplierName: {} | null;
        supplierSource: {} | null;
        supplierCode: {} | null;
        rate: {} | null;
        lastPurchaseDate: {} | null;
    }[]>;
    createPos(dto: CreateReorderPosDto): Promise<{
        poId: unknown;
        accYear: unknown;
        refno: unknown;
        supplierId: string;
        supplierName: unknown;
        lines: number;
        value: unknown;
    }[]>;
}
export declare class PurchaseReorderController {
    private readonly service;
    private readonly prisma;
    private readonly ctx;
    constructor(service: PurchaseReorderService, prisma: PrismaService, ctx: RequestContextService);
    private right;
    suggestions(q: ReorderQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            reorderId: unknown;
            itemId: unknown;
            itemName: unknown;
            itemCode: unknown;
            uomId: unknown;
            unitName: unknown;
            godownId: {} | null;
            godownName: {} | null;
            reorderType: unknown;
            onHand: Prisma.Decimal;
            onOrder: Prisma.Decimal;
            cover: Prisma.Decimal;
            reorderLevel: Prisma.Decimal;
            minLevel: Prisma.Decimal;
            maxLevel: Prisma.Decimal;
            reorderQty: Prisma.Decimal;
            leadDays: unknown;
            below: boolean;
            suggestedQty: Prisma.Decimal;
            supplierId: string | null;
            supplierName: {} | null;
            supplierSource: {} | null;
            supplierCode: {} | null;
            rate: {} | null;
            lastPurchaseDate: {} | null;
        }[];
    }>;
    createPos(dto: CreateReorderPosDto): Promise<{
        success: boolean;
        message: string;
        data: {
            poId: unknown;
            accYear: unknown;
            refno: unknown;
            supplierId: string;
            supplierName: unknown;
            lines: number;
            value: unknown;
        }[];
    }>;
}
