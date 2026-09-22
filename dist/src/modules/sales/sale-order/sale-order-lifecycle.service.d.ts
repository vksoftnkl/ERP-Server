import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SalesContextService } from '../posting/sales-context.service';
import { StockReservationService, type ReservationShort } from '../posting/stock-reservation.service';
import { SaleOrderService } from './sale-order.service';
import type { AmendSaleOrderDto, CancelSaleOrderDto, PostSaleOrderDto, SaleOrderKeysDto } from './dto/sale-order-lifecycle.dto';
import { type SaleOrderPayload } from './types/sale-order-api.types';
export declare class SaleOrderLifecycleService {
    private readonly prisma;
    private readonly orders;
    private readonly salesContext;
    private readonly reservations;
    private readonly audit;
    constructor(prisma: PrismaService, orders: SaleOrderService, salesContext: SalesContextService, reservations: StockReservationService, audit: AuditLogService);
    post(dto: PostSaleOrderDto): Promise<{
        soStatus: string;
        warnings: ReservationShort[];
    }>;
    cancel(dto: CancelSaleOrderDto): Promise<{
        soStatus: string;
        cancelledLines: number;
    }>;
    amend(dto: AmendSaleOrderDto): Promise<SaleOrderPayload>;
    deleteDraft(keys: SaleOrderKeysDto): Promise<{
        soId: string;
        deleted: true;
    }>;
    private reserve;
    private lock;
    private trail;
}
