import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import { EmployeeMasterPayload } from './types/employee-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class EmployeeMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveEmployeeMasterDto: SaveEmployeeMasterDto): Promise<EmployeeMasterPayload>;
    getById(empId: string): Promise<EmployeeMasterPayload>;
    private resolveRelatedNames;
    softDelete(empId: string): Promise<{
        empId: string;
        deleted: true;
    }>;
    private createEmployee;
    private updateEmployee;
    private ensureCompanyExists;
    private ensureDesignationExists;
    private ensureDepartmentExists;
    private applyOptionalFields;
    private normalizeRequiredValue;
    private decodePhoto;
    private extractBase64Payload;
    private toPayload;
    private handleWriteError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
}
