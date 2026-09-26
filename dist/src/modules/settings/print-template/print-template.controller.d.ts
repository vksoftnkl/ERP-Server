import { ListPrintTemplateQueryDto } from './dto/list-print-template-query.dto';
import { DeletePrintTemplateQueryDto, PrintTemplateIdQueryDto } from './dto/print-template-id-query.dto';
import { SavePrintTemplateDto } from './dto/save-print-template.dto';
import { PrintTemplateService } from './print-template.service';
import { PrintTemplateDeleteResult, PrintTemplatePayload, PrintTemplateSuccessResponse } from './types/print-template-api.types';
export declare class PrintTemplateController {
    private readonly printTemplateService;
    constructor(printTemplateService: PrintTemplateService);
    saveTemplate(dto: SavePrintTemplateDto): Promise<PrintTemplateSuccessResponse<PrintTemplatePayload>>;
    getTemplate(query: PrintTemplateIdQueryDto): Promise<PrintTemplateSuccessResponse<PrintTemplatePayload>>;
    listTemplates(query: ListPrintTemplateQueryDto): Promise<PrintTemplateSuccessResponse<PrintTemplatePayload[]>>;
    deleteTemplate(query: DeletePrintTemplateQueryDto): Promise<PrintTemplateSuccessResponse<PrintTemplateDeleteResult>>;
}
