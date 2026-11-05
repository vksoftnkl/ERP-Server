import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleFreightChargeDto } from './dto/save-sale-freight-charges.dto';
import { SaleFreightChargePayload } from './types/sale-freight-charges-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SaleFreightChargeService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(dto: SaveSaleFreightChargeDto): Promise<SaleFreightChargePayload>;
    createSaleFreightCharge(dto: SaveSaleFreightChargeDto, userId: string): Promise<SaleFreightChargePayload>;
    getById(frId: string): Promise<SaleFreightChargePayload>;
    softDelete(frId: string): Promise<{
        frId: string;
        deleted: true;
    }>;
    private updateSaleFreightCharge;
    private handleWriteError;
    private applyOptionalFields;
    private toPayload;
}
