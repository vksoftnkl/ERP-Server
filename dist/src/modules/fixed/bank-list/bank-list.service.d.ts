import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListBankListQueryDto } from './dto/list-bank-list-query.dto';
import { SaveBankListDto } from './dto/save-bank-list.dto';
import { BankListItem, BankListMeta, BankListPayload } from './types/bank-list-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class BankListService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly configuredGridSqlService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, configuredGridSqlService: ConfiguredGridSqlService, requestContextService: RequestContextService);
    save(saveBankListDto: SaveBankListDto): Promise<BankListPayload>;
    list(queryDto: ListBankListQueryDto): Promise<ConfiguredGridListResult<BankListItem, BankListMeta>>;
    getById(bnkId: string): Promise<BankListPayload>;
    softDelete(bnkId: string): Promise<{
        bnkId: string;
        deleted: true;
    }>;
    private createBank;
    private updateBank;
    private ensureNameIsUnique;
    private toPayload;
}
