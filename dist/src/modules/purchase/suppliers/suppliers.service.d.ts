import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import { SupplierPayload } from './types/supplier-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SuppliersService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    private readonly accountLedgerMastersService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService, accountLedgerMastersService: AccountLedgerMastersService);
    save(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload>;
    getById(supId: string): Promise<SupplierPayload>;
    softDelete(supId: string): Promise<{
        supId: string;
        deleted: true;
    }>;
    private createSupplier;
    private updateSupplier;
    private resolveRelatedNames;
    private ensureSupplierGroupExists;
    private ensureNameIsUnique;
    private buildLinkedLedgerDto;
    private applyOptionalFields;
    private normalizeStateCode;
    private toPayload;
}
