import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListBatchPrefixQueryDto } from './dto/list-batch-prefix-query.dto';
import { SaveBatchPrefixDto } from './dto/save-batch-prefix.dto';
import { BatchPrefixDeleteResult, BatchPrefixListItem, BatchPrefixListMeta, BatchPrefixPayload } from './types/batch-prefix-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class BatchPrefixService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly configuredGridSqlService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, configuredGridSqlService: ConfiguredGridSqlService, requestContextService: RequestContextService);
    save(saveBatchPrefixDto: SaveBatchPrefixDto): Promise<BatchPrefixPayload>;
    list(queryDto: ListBatchPrefixQueryDto): Promise<ConfiguredGridListResult<BatchPrefixListItem, BatchPrefixListMeta>>;
    getById(id: string): Promise<BatchPrefixPayload>;
    delete(id: string): Promise<BatchPrefixDeleteResult>;
    private createBatchPrefix;
    private updateBatchPrefix;
    private ensurePrefixIsUnique;
    private normalizeRequiredPrefix;
    private parseNullableDate;
    private toPayload;
    private buildDisplayName;
    private handleWriteError;
    private handleDeleteError;
    private throwNotFound;
}
