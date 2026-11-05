import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrintTemplateAssignmentService } from './print-template-assignment.service';
import { SavePrintTemplateAssignmentDto } from './dto/save-print-template-assignment.dto';
import { ListPrintTemplateAssignmentQueryDto } from './dto/list-print-template-assignment-query.dto';
import { ResolvePrintTemplateAssignmentQueryDto } from './dto/resolve-print-template-assignment-query.dto';
import { PrintTemplateAssignmentListResult, PrintTemplateAssignmentPayload, PrintTemplateAssignmentResolution, PrintTemplateAssignmentSuccessResponse } from './types/print-template-assignment-api.types';
export declare class PrintTemplateAssignmentController {
    private readonly printTemplateAssignmentService;
    private readonly requestContextService;
    constructor(printTemplateAssignmentService: PrintTemplateAssignmentService, requestContextService: RequestContextService);
    create(dto: SavePrintTemplateAssignmentDto): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentPayload>>;
    list(queryDto: ListPrintTemplateAssignmentQueryDto): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentListResult>>;
    resolve(queryDto: ResolvePrintTemplateAssignmentQueryDto): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentResolution>>;
    getById(ptaId: string): Promise<PrintTemplateAssignmentSuccessResponse<PrintTemplateAssignmentPayload>>;
    remove(ptaId: string): Promise<PrintTemplateAssignmentSuccessResponse<{
        ptaId: string;
        deleted: true;
    }>>;
}
