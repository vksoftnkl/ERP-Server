import { ReportDataProviderRegistry } from '../providers/report-data-provider.registry';
import { CloneTemplateDto, CreateTemplateDto, GetTemplatesQueryDto, ImportTemplateDto, UpdateTemplateDto } from './dto/template-request.dto';
import { TemplatesService } from './templates.service';
import { TemplateDeleteResult, TemplateExportPayload, TemplateListMeta, TemplatePayload, TemplateRevisionPayload, TemplateSummaryPayload, TemplatesSuccessResponse } from './types/templates-api.types';
export declare class TemplatesController {
    private readonly templatesService;
    private readonly providers;
    constructor(templatesService: TemplatesService, providers: ReportDataProviderRegistry);
    list(query: GetTemplatesQueryDto): Promise<TemplatesSuccessResponse<TemplateSummaryPayload[], TemplateListMeta>>;
    schema(): TemplatesSuccessResponse<Record<string, unknown>>;
    findOne(ptId: string): Promise<TemplatesSuccessResponse<TemplatePayload>>;
    create(dto: CreateTemplateDto): Promise<TemplatesSuccessResponse<TemplatePayload>>;
    update(ptId: string, dto: UpdateTemplateDto): Promise<TemplatesSuccessResponse<TemplatePayload>>;
    remove(ptId: string): Promise<TemplatesSuccessResponse<TemplateDeleteResult>>;
    clone(ptId: string, dto: CloneTemplateDto): Promise<TemplatesSuccessResponse<TemplatePayload>>;
    setDefault(ptId: string): Promise<TemplatesSuccessResponse<TemplateSummaryPayload>>;
    revisions(ptId: string): Promise<TemplatesSuccessResponse<TemplateRevisionPayload[], {
        count: number;
    }>>;
    rollback(ptId: string, version: number): Promise<TemplatesSuccessResponse<TemplatePayload>>;
    export(ptId: string): Promise<TemplatesSuccessResponse<TemplateExportPayload>>;
    import(dto: ImportTemplateDto): Promise<TemplatesSuccessResponse<TemplatePayload>>;
    datasets(docType?: string): TemplatesSuccessResponse<ReturnType<ReportDataProviderRegistry['list']>, {
        count: number;
    }>;
}
