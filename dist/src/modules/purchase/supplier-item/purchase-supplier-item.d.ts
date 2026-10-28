import { Prisma } from '@prisma/client';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { type Tx } from '../common/purchase-doc.helpers';
export declare const SUPPLIER_ITEM_MENU_ID = 295;
export declare function supplierItemId(companyId: string | null, supplierId: string, itemId: string): string;
export declare function recordSupplierItems(tx: Tx, companyId: string, supplierId: string, lines: {
    itemId: string;
    uomId: string;
    factor: Prisma.Decimal;
}[], actor: string): Promise<void>;
export declare class SaveSupplierItemDto {
    companyId: string;
    supplierId: string;
    itemId: string;
    supplierItemCode?: string;
    supplierBarcode?: string;
    buyUomId?: string;
    packQty?: number;
    moq?: number;
    leadDays?: number;
    isPreferred?: boolean;
    isActive?: boolean;
}
export declare class SupplierItemRefDto {
    psiId: string;
}
export declare class SupplierItemActiveDto extends SupplierItemRefDto {
    active: boolean;
}
export declare class PurchaseSupplierItemService {
    private readonly prisma;
    private readonly ctx;
    constructor(prisma: PrismaService, ctx: RequestContextService);
    private actor;
    save(dto: SaveSupplierItemDto): Promise<Record<string, unknown>>;
    setActive(dto: SupplierItemActiveDto): Promise<Record<string, unknown>>;
    get(psiId: string): Promise<Record<string, unknown>>;
}
export declare class PurchaseSupplierItemController {
    private readonly service;
    private readonly prisma;
    private readonly ctx;
    constructor(service: PurchaseSupplierItemService, prisma: PrismaService, ctx: RequestContextService);
    private right;
    save(dto: SaveSupplierItemDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
    active(dto: SupplierItemActiveDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
    get(q: SupplierItemRefDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
}
