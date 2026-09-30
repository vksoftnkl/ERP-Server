import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { SaveAppThemeDto } from './dto/save-app-theme.dto';
import { type AppThemeDeleteResult, type AppThemeEffectivePayload, type AppThemePayload } from './types/app-theme.types';
export declare class AppThemeService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContext;
    private menuId;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContext: RequestContextService);
    getById(thmId: number): Promise<AppThemePayload>;
    effective(companyId: string): Promise<AppThemeEffectivePayload>;
    save(dto: SaveAppThemeDto): Promise<AppThemePayload>;
    softDelete(thmId: number): Promise<AppThemeDeleteResult>;
    restore(thmId: number): Promise<AppThemeDeleteResult>;
    validateTokens(tokens: Record<string, unknown>): Record<string, string>;
    private setDeleted;
    private assertNameIsFree;
    private usedByCount;
    private requireRight;
    private resolveMenuId;
    private actor;
    private toPayload;
    private toAuditRecord;
    private readTokens;
    private throwNotFound;
    private handleWriteError;
}
