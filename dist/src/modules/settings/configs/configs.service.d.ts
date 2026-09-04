import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveConfigsDto } from './dto/save-configs.dto';
import { ConfigsPayload } from './types/configs-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ConfigsService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveConfigsDto: SaveConfigsDto): Promise<ConfigsPayload>;
    getById(configId: number): Promise<ConfigsPayload>;
    private updateConfig;
    private toPayload;
}
