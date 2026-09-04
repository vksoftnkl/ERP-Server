import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemCustRateQueryDto } from './dto/list-item-cust-rate-query.dto';
import { SaveItemCustRateDto } from './dto/save-item-cust-rate.dto';
import { ItemCustRateListItem, ItemCustRateListMeta, ItemCustRatePayload } from './types/item-cust-rate-api.types';
import { RequestContextService } from '../../common/request-context/request-context.service';
export declare class ItemsCustRatesMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly configuredGridSqlService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, configuredGridSqlService: ConfiguredGridSqlService, requestContextService: RequestContextService);
    save(saveItemCustRateDto: SaveItemCustRateDto): Promise<ItemCustRatePayload>;
    list(queryDto: ListItemCustRateQueryDto): Promise<ConfiguredGridListResult<ItemCustRateListItem, ItemCustRateListMeta>>;
    getById(csrId: string): Promise<ItemCustRatePayload>;
    softDelete(csrId: string): Promise<{
        csr_id: string;
        deleted: true;
    }>;
    private createItemCustRate;
    private updateItemCustRate;
    private buildListWhere;
    private applyOptionalFields;
    private validateDateRange;
    private parseOptionalDate;
    private toPayload;
    private buildDisplayName;
    private handleWriteError;
    private throwNotFound;
}
