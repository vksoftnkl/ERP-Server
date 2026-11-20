import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogAccessService } from './audit-log-access.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogListItem, AuditLogListMeta, AuditLogSuccessResponse } from './types/audit-log-api.types';
export declare class AuditLogController {
    private readonly auditLogService;
    private readonly auditLogAccessService;
    constructor(auditLogService: AuditLogService, auditLogAccessService: AuditLogAccessService);
    list(queryDto: ListAuditLogQueryDto): Promise<AuditLogSuccessResponse<AuditLogListItem[], AuditLogListMeta>>;
}
