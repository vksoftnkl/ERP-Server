import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAreaDto } from './dto/save-area.dto';
import { AreaMasterCreateResult, AreaPayload } from './types/area-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class AreaService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveAreaDto: SaveAreaDto): Promise<AreaPayload>;
    createAreaMaster(dto: SaveAreaDto, userId: string, parentId?: string): Promise<AreaMasterCreateResult>;
    getById(armId: string): Promise<AreaPayload>;
    softDelete(armId: string): Promise<{
        armId: string;
        deleted: true;
    }>;
    private updateArea;
    private getCityName;
    private ensureCityExists;
    private ensureNameIsUnique;
    private applyOptionalFields;
    private toPayload;
}
