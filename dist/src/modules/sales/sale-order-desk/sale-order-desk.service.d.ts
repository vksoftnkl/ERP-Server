import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SalesContextService } from '../posting/sales-context.service';
import { StockReservationService } from '../posting/stock-reservation.service';
import { SaleOrderService } from '../sale-order/sale-order.service';
import type { CloseOpenLinesDto, DeliveryHoldDto, FiguresDto, PriorityDto, StockCoverDto } from './dto/sale-order-desk.dto';
import { type CloseOpenLinesResult, type DeliveryHoldResult, type FiguresResult, type PriorityResult, type StockCoverResult } from './types/sale-order-desk.types';
export declare class SaleOrderDeskService {
    private readonly prisma;
    private readonly orders;
    private readonly salesContext;
    private readonly reservations;
    private readonly audit;
    constructor(prisma: PrismaService, orders: SaleOrderService, salesContext: SalesContextService, reservations: StockReservationService, audit: AuditLogService);
    deliveryHold(dto: DeliveryHoldDto): Promise<DeliveryHoldResult>;
    priority(dto: PriorityDto): Promise<PriorityResult>;
    closeOpenLines(dto: CloseOpenLinesDto): Promise<CloseOpenLinesResult>;
    stockCover(dto: StockCoverDto): Promise<StockCoverResult>;
    figures(dto: FiguresDto): Promise<FiguresResult>;
    canSeeMoney(client: Prisma.TransactionClient): Promise<boolean>;
    private assertRight;
}
