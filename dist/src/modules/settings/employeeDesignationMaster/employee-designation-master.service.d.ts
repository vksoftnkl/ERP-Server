import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveEmployeeDesignationMasterDto } from './dto/save-employee-designation-master.dto';
import { EmployeeDesignationMasterPayload } from './types/employee-designation-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class EmployeeDesignationMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto): Promise<EmployeeDesignationMasterPayload>;
    getById(edId: string): Promise<EmployeeDesignationMasterPayload>;
    softDelete(edId: string): Promise<{
        edId: string;
        deleted: true;
    }>;
    private createDesignation;
    private updateDesignation;
    private ensureNameIsUnique;
    private ensureCodeIsUnique;
    private clearDefaultDesignation;
    private normalizeRequiredName;
    private toPayload;
    private handleWriteError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
}
