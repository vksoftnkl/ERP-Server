import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { SaleOrderService } from '../../modules/sales/sale-order/sale-order.service';
import { CreateMobileOrderDto } from './dto/mobile-order.dto';
import type { MobileOrderCreateResult } from './types/mobile-order-api.types';
export declare function orderDayOf(soOrderDate: string | undefined, today: string): string;
export declare class MobileOrderService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly saleOrderService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, saleOrderService: SaleOrderService);
    create(dto: CreateMobileOrderDto): Promise<MobileOrderCreateResult>;
    private orderUserId;
    private toSaveDto;
    private findByClientUuid;
    private resendAnswer;
}
