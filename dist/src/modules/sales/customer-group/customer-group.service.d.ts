import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCustomerGroupDto } from './dto/save-customer-group.dto';
import { CustomerGroupPayload } from './types/customer-group-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class CustomerGroupService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveCustomerGroupDto: SaveCustomerGroupDto): Promise<CustomerGroupPayload>;
    getById(cgrId: string): Promise<CustomerGroupPayload>;
    softDelete(cgrId: string): Promise<{
        cgrId: string;
        deleted: true;
    }>;
    private createCustomerGroup;
    private updateCustomerGroup;
    private ensureCompanyExists;
    private ensureNameIsUnique;
    private applyOptionalFields;
    private toPayload;
}
