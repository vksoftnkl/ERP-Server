import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { BillLifecycleService } from '../../modules/sales/bill/bill-lifecycle.service';
import { BillService } from '../../modules/sales/bill/bill.service';
import { CreateMobileBillDto, MobileBillOptionsQueryDto } from './dto/mobile-bill.dto';
import type { MobileBillCreateResult, MobileBillOptions } from './types/mobile-bill-api.types';
export declare const MOBILE_BILL_DEVICE_TYPE = "MOBILE";
export declare function billDayOf(sbBillDate: string | undefined, today: string): string;
export declare class MobileBillService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly bills;
    private readonly lifecycle;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, bills: BillService, lifecycle: BillLifecycleService);
    options(query: MobileBillOptionsQueryDto): Promise<MobileBillOptions>;
    create(dto: CreateMobileBillDto): Promise<MobileBillCreateResult>;
    private toSaveDto;
    private assertLineGodowns;
    private godownsOf;
    private findBill;
    private resendAnswer;
    private toAnswer;
}
