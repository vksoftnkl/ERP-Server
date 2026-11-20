import { WaPostHook, type WaPostBlock } from '../../whatsapp/hook/wa-post-hook';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SalesContextService } from '../posting/sales-context.service';
import { StockReservationService, type ReservationShort } from '../posting/stock-reservation.service';
import { SaleOrderService } from './sale-order.service';
import type { AmendSaleOrderDto, CancelSaleOrderDto, PostSaleOrderDto, SaleOrderKeysDto } from './dto/sale-order-lifecycle.dto';
import type { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { type SaleOrderPayload } from './types/sale-order-api.types';
export interface SaleOrderPostOptions {
    skipPostRight?: boolean;
    origin?: 'PHONE';
}
export declare class SaleOrderLifecycleService {
    private readonly prisma;
    private readonly orders;
    private readonly salesContext;
    private readonly reservations;
    private readonly audit;
    private readonly waHook?;
    constructor(prisma: PrismaService, orders: SaleOrderService, salesContext: SalesContextService, reservations: StockReservationService, audit: AuditLogService, waHook?: WaPostHook | undefined);
    post(dto: PostSaleOrderDto): Promise<{
        soStatus: string;
        warnings: ReservationShort[];
        whatsapp?: WaPostBlock;
    }>;
    whatsappAfterPost(keys: SaleOrderKeysDto, waOnPost: boolean | undefined): Promise<WaPostBlock | null>;
    saveAndPost(dto: SaveSaleOrderDto): Promise<SaleOrderPayload & {
        warnings: ReservationShort[];
        whatsapp?: WaPostBlock;
    }>;
    save(dto: SaveSaleOrderDto): Promise<SaleOrderPayload & {
        warnings: ReservationShort[];
    }>;
    saveOverInTx(tx: Prisma.TransactionClient, dto: SaveSaleOrderDto, now: Date): Promise<SaleOrderPayload & {
        warnings: ReservationShort[];
    }>;
    private rereserveInTx;
    postInTx(tx: Prisma.TransactionClient, dto: SaleOrderKeysDto, now: Date, options?: SaleOrderPostOptions): Promise<{
        soStatus: string;
        warnings: ReservationShort[];
        confirmedNow?: boolean;
    }>;
    cancel(dto: CancelSaleOrderDto): Promise<{
        soStatus: string;
        cancelledLines: number;
    }>;
    amend(dto: AmendSaleOrderDto): Promise<SaleOrderPayload & {
        warnings: ReservationShort[];
    }>;
    deleteDraft(keys: SaleOrderKeysDto): Promise<{
        soId: string;
        deleted: true;
    }>;
    private reserve;
    private lock;
    private trail;
}
