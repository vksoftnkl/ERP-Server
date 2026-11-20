import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { SaleOrderService } from '../../modules/sales/sale-order/sale-order.service';
import { SaleOrderLifecycleService } from '../../modules/sales/sale-order/sale-order-lifecycle.service';
import { type SaleGodown, type SaleGodownReader } from '../../common/utils/sale-line-godown.utils';
import { AppSettingValueService } from '../../modules/settings/appSettings/app-setting-value.service';
import { CreateMobileOrderDto } from './dto/mobile-order.dto';
import type { MobileOrderConfirmRefusal, MobileOrderCreateResult } from './types/mobile-order-api.types';
export declare function confirmRefusalOf(error: unknown): MobileOrderConfirmRefusal | null;
type GodownLine = {
    soiItemId: string;
    soiItemUnitId: string;
    soiGodownId?: string | null;
};
export declare function mobileOrderLineGodowns(client: SaleGodownReader, branchId: string, items: readonly GodownLine[]): Promise<Map<string, SaleGodown | null>>;
export declare function withLineGodowns<T extends GodownLine>(items: readonly T[], godownByLine: ReadonlyMap<string, SaleGodown | null>): T[];
export declare function orderDayOf(soOrderDate: string | undefined, today: string): string;
export declare class MobileOrderService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly saleOrderService;
    private readonly saleOrderLifecycle;
    private readonly appSettings;
    private readonly logger;
    private readonly itemPrice;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, saleOrderService: SaleOrderService, saleOrderLifecycle: SaleOrderLifecycleService, appSettings: AppSettingValueService);
    create(dto: CreateMobileOrderDto): Promise<MobileOrderCreateResult>;
    private whatsappAfterCommit;
    private confirmInTx;
    private orderBranchId;
    private orderUserId;
    private toSaveDto;
    private desktopFacts;
    private lineFacts;
    private findByClientUuid;
    private resendAnswer;
}
export {};
