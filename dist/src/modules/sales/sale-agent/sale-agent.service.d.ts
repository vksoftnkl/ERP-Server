import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveSaleAgentDto } from './dto/save-sale-agent.dto';
import { SaleAgentPayload } from './types/sale-agent-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class SaleAgentService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    private readonly accountLedgerMastersService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService, accountLedgerMastersService: AccountLedgerMastersService);
    save(saveSaleAgentDto: SaveSaleAgentDto): Promise<SaleAgentPayload>;
    getById(saId: string): Promise<SaleAgentPayload>;
    softDelete(saId: string): Promise<{
        saId: string;
        deleted: true;
    }>;
    private createSaleAgent;
    private updateSaleAgent;
    private ensureCompanyExists;
    private ensureBranchExists;
    private ensureGroupExists;
    private ensureNameIsUnique;
    private ensureCodeIsUnique;
    private handleWriteError;
    private applyOptionalFields;
    private resolveAnyAccountGroupId;
    private buildLinkedLedgerDto;
    private toPayload;
}
