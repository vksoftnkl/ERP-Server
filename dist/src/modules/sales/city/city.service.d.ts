import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCityDto } from './dto/save-city.dto';
import { CityMasterCreateResult, CityPayload } from './types/city-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class CityService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveCityDto: SaveCityDto): Promise<CityPayload>;
    createCityMaster(dto: SaveCityDto, userId: string, parentId?: string): Promise<CityMasterCreateResult>;
    getById(ctmId: string): Promise<CityPayload>;
    softDelete(ctmId: string): Promise<{
        ctmId: string;
        deleted: true;
    }>;
    private updateCity;
    private getStateName;
    private ensureStateExists;
    private ensureNameIsUnique;
    private applyOptionalFields;
    private toPayload;
}
