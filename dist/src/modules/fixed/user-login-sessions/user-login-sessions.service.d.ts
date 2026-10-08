import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUserLoginSessionsQueryDto } from './dto/list-user-login-sessions-query.dto';
import { SaveUserLoginSessionDto } from './dto/save-user-login-session.dto';
import { UserLoginSessionsListItem, UserLoginSessionsListMeta, UserLoginSessionsPayload } from './types/user-login-sessions-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class UserLoginSessionsService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly configuredGridSqlService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, configuredGridSqlService: ConfiguredGridSqlService, requestContextService: RequestContextService);
    save(saveUserLoginSessionDto: SaveUserLoginSessionDto): Promise<UserLoginSessionsPayload>;
    list(queryDto: ListUserLoginSessionsQueryDto): Promise<ConfiguredGridListResult<UserLoginSessionsListItem, UserLoginSessionsListMeta>>;
    getById(ulsId: string): Promise<UserLoginSessionsPayload>;
    softDelete(ulsId: string): Promise<{
        ulsId: string;
        deleted: true;
    }>;
    private createSession;
    private updateSession;
    private toPayload;
}
