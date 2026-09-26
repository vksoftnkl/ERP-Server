import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitDetailPayload, UnitPayload } from './types/unit-api.types';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class UnitsMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveUnitDto: SaveUnitDto): Promise<UnitPayload>;
    getById(unitId: string): Promise<UnitDetailPayload>;
    toggleDelete(unitId: string): Promise<{
        unit_id: string;
        deleted: boolean;
    }>;
    private createUnit;
    private updateUnit;
    private validateConversionRules;
    private applyOptionalFields;
    private toPayload;
    private handleWriteError;
}
