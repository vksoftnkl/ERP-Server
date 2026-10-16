import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { SavePrintTemplateAssignmentDto } from './dto/save-print-template-assignment.dto';
import { ListPrintTemplateAssignmentQueryDto } from './dto/list-print-template-assignment-query.dto';
import { ResolvePrintTemplateAssignmentQueryDto } from './dto/resolve-print-template-assignment-query.dto';
import { PrintTemplateAssignmentListResult, PrintTemplateAssignmentPayload, PrintTemplateAssignmentResolution } from './types/print-template-assignment-api.types';
export declare class PrintTemplateAssignmentService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(dto: SavePrintTemplateAssignmentDto): Promise<PrintTemplateAssignmentPayload>;
    createAssignment(dto: SavePrintTemplateAssignmentDto, userId: string): Promise<PrintTemplateAssignmentPayload>;
    getById(ptaId: string): Promise<PrintTemplateAssignmentPayload>;
    list(queryDto: ListPrintTemplateAssignmentQueryDto): Promise<PrintTemplateAssignmentListResult>;
    resolve(queryDto: ResolvePrintTemplateAssignmentQueryDto): Promise<PrintTemplateAssignmentResolution>;
    softDelete(ptaId: string): Promise<{
        ptaId: string;
        deleted: true;
    }>;
    private updateAssignment;
    private resolveTemplateCompanyKey;
    private assertScopeLadder;
    private assertPrinterOneOf;
    private handleWriteError;
    private displayName;
    private toScope;
    private toPayload;
}
