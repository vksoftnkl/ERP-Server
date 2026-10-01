import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveUserAdministrationDto } from './dto/save-user-administration.dto';
import { UserAdminPayload } from './types/user-administration-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class UserAdministrationService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(dto: SaveUserAdministrationDto): Promise<UserAdminPayload>;
    getById(usrId: string): Promise<UserAdminPayload>;
    private resolveRelatedNames;
    softDelete(usrId: string): Promise<{
        usrId: string;
        deleted: true;
    }>;
    private createUser;
    private updateUser;
    private replaceUserMenus;
    private ensureLoginNameUnique;
    private applyOptionalUserFields;
    private hashPassword;
    private toPayload;
    private toPayloadWithoutMenus;
    private toMenuPayload;
    private handleWriteError;
    private throwNotFound;
}
