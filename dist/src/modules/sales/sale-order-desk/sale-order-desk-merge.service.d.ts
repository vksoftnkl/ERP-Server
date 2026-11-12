import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SalesContextService } from '../posting/sales-context.service';
import { StockReservationService } from '../posting/stock-reservation.service';
import { SaleOrderService } from '../sale-order/sale-order.service';
import { SaleOrderLifecycleService } from '../sale-order/sale-order-lifecycle.service';
import type { SaveSaleOrderDto } from '../sale-order/dto/save-sale-order.dto';
import type { SaveSaleOrderItemDto } from '../sale-order/dto/save-sale-order-item.dto';
import type { MergeDto, MergePreviewDto } from './dto/sale-order-desk.dto';
import { type MergePreviewResult, type MergeResult } from './types/sale-order-desk.types';
type SourceLine = SaleOrderItem & {
    itemUnitConversion: {
        iucUomWeight: Prisma.Decimal;
    } | null;
};
interface MergeSource {
    order: SaleOrder;
    lines: SourceLine[];
    advanceHeld: Prisma.Decimal;
    chargeRows: number;
}
interface BuiltMerge {
    ordered: MergeSource[];
    oldest: SaleOrder;
    items: SaveSaleOrderItemDto[];
    priority: string;
    deliveryDate: string | null;
    totQty: Prisma.Decimal;
    totKg: Prisma.Decimal;
    sums: Record<'gross' | 'itemDisc' | 'splDisc' | 'schDisc' | 'billSchDisc' | 'addlDisc1' | 'addlDisc2' | 'cashDisc' | 'taxable' | 'cgst' | 'sgst' | 'igst' | 'cess' | 'acess' | 'freight' | 'load' | 'unload' | 'net' | 'mrpSavings' | 'mrpValue', Prisma.Decimal>;
    roundOff: Prisma.Decimal;
    orderAmt: Prisma.Decimal;
    perSource: Map<string, {
        openLines: number;
        openQty: Prisma.Decimal;
        openKg: Prisma.Decimal;
        openValue: Prisma.Decimal;
    }>;
}
export declare class SaleOrderDeskMergeService {
    private readonly prisma;
    private readonly orders;
    private readonly lifecycle;
    private readonly salesContext;
    private readonly reservations;
    constructor(prisma: PrismaService, orders: SaleOrderService, lifecycle: SaleOrderLifecycleService, salesContext: SalesContextService, reservations: StockReservationService);
    preview(dto: MergePreviewDto): Promise<MergePreviewResult>;
    merge(dto: MergeDto): Promise<{
        message: string;
        data: MergeResult;
    }>;
    private evaluate;
    private loadSources;
}
export declare function distinctRefs(orders: readonly {
    soId: string;
    soAccYear: string;
}[]): {
    soId: string;
    soAccYear: string;
}[];
export declare function fingerprintOf(sources: readonly MergeSource[]): string;
export declare function buildMerge(sources: readonly MergeSource[]): BuiltMerge;
export declare function toSaveDto(built: BuiltMerge, req: Pick<MergeDto, 'soCompanyId' | 'soBranchId' | 'soAccYear' | 'soDeviceId' | 'soSessionId'>, userId: string, today: string, reason: string): SaveSaleOrderDto;
export {};
