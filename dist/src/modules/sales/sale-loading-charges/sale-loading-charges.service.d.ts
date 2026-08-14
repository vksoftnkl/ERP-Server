import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleLoadingChargeDto } from './dto/save-sale-loading-charges.dto';
import { SaleLoadingChargePayload } from './types/sale-loading-charges-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SaleLoadingChargeService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(dto: SaveSaleLoadingChargeDto): Promise<SaleLoadingChargePayload>;
    createSaleLoadingCharge(dto: SaveSaleLoadingChargeDto, userId: string): Promise<SaleLoadingChargePayload>;
    getById(ilcId: string): Promise<SaleLoadingChargePayload>;
    softDelete(ilcId: string): Promise<{
        ilcId: string;
        deleted: true;
    }>;
    private updateSaleLoadingCharge;
    private handleWriteError;
    private applyOptionalFields;
    private toPayload;
}
