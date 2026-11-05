import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSupplierGroupDto } from './dto/save-supplier-group.dto';
import { SupplierGroupPayload } from './types/supplier-group-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SupplierGroupService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveSupplierGroupDto: SaveSupplierGroupDto): Promise<SupplierGroupPayload>;
    getById(spgId: string): Promise<SupplierGroupPayload>;
    softDelete(spgId: string): Promise<{
        spgId: string;
        deleted: true;
    }>;
    private createSupplierGroup;
    private updateSupplierGroup;
    private ensureNameIsUnique;
    private toPayload;
}
