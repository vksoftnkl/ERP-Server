import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveEmployeeDepartmentMasterDto } from './dto/save-employee-department-master.dto';
import { EmployeeDepartmentMasterPayload } from './types/employee-department-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class EmployeeDepartmentMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveEmployeeDepartmentMasterDto: SaveEmployeeDepartmentMasterDto): Promise<EmployeeDepartmentMasterPayload>;
    getById(edptId: string): Promise<EmployeeDepartmentMasterPayload>;
    softDelete(edptId: string): Promise<{
        edptId: string;
        deleted: true;
    }>;
    private createDepartment;
    private updateDepartment;
    private ensureNameIsUnique;
    private ensureCodeIsUnique;
    private normalizeRequiredName;
    private toPayload;
    private handleWriteError;
    private throwNotFound;
    private throwBadRequest;
    private buildErrorResponse;
}
