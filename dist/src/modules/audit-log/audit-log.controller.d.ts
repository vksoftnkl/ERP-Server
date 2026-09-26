import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogService } from './audit-log.service';
import { AuditLogListItem, AuditLogListMeta, AuditLogSuccessResponse } from './types/audit-log-api.types';
export declare class AuditLogController {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
    list(queryDto: ListAuditLogQueryDto): Promise<AuditLogSuccessResponse<AuditLogListItem[], AuditLogListMeta>>;
}
