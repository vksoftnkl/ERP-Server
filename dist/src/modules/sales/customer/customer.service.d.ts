import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import { CustomerPayload } from './types/customer-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class CustomerService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    private readonly accountLedgerMastersService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService, accountLedgerMastersService: AccountLedgerMastersService);
    save(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload>;
    getById(cusId: string): Promise<CustomerPayload>;
    softDelete(cusId: string): Promise<{
        cusId: string;
        deleted: true;
    }>;
    private createCustomer;
    private updateCustomer;
    private resolveRelatedNames;
    private ensureAreaExists;
    private ensureCompanyExists;
    private ensureCustomerGroupExists;
    private ensureStateCodeExists;
    private buildLinkedLedgerDto;
    private applyOptionalFields;
    private normalizeStateCode;
    private toDateOrNull;
    private toPayload;
}
