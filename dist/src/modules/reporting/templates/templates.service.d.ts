import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ReportDataProviderRegistry } from '../providers/report-data-provider.registry';
import { TemplateDefinition } from './dto/template-definition.schema';
import { CloneTemplateDto, CreateTemplateDto, GetTemplatesQueryDto, ImportTemplateDto, UpdateTemplateDto } from './dto/template-request.dto';
import { TemplateMigrationService } from './template-migration.service';
import { ResolvedTemplate, TemplateDeleteResult, TemplateExportPayload, TemplatePayload, TemplateRevisionPayload, TemplateSummaryPayload } from './types/templates-api.types';
export declare class TemplatesService {
    private readonly prisma;
    private readonly requestContext;
    private readonly migration;
    private readonly providers;
    private readonly logger;
    private readonly expressionValidator;
    constructor(prisma: PrismaService, requestContext: RequestContextService, migration: TemplateMigrationService, providers: ReportDataProviderRegistry);
    list(query: GetTemplatesQueryDto): Promise<{
        items: TemplateSummaryPayload[];
        includeSystem: boolean;
    }>;
    findOne(ptId: string): Promise<TemplatePayload>;
    listRevisions(ptId: string): Promise<TemplateRevisionPayload[]>;
    create(dto: CreateTemplateDto): Promise<TemplatePayload>;
    update(ptId: string, dto: UpdateTemplateDto): Promise<TemplatePayload>;
    softDelete(ptId: string): Promise<TemplateDeleteResult>;
    clone(ptId: string, dto: CloneTemplateDto): Promise<TemplatePayload>;
    setDefault(ptId: string): Promise<TemplateSummaryPayload>;
    rollback(ptId: string, version: number): Promise<TemplatePayload>;
    export(ptId: string): Promise<TemplateExportPayload>;
    import(dto: ImportTemplateDto): Promise<TemplatePayload>;
    resolveForPrint(request: {
        docType: string;
        outputMode: string;
        paperCode: string;
        companyId: string;
        branchId: string | null;
        templateId?: string;
    }): Promise<ResolvedTemplate>;
    validateDefinition(raw: Record<string, unknown>, context?: {
        outputMode?: string;
    }): TemplateDefinition;
    private toResolved;
    private clearDefault;
    private assertReadable;
    private assertWritable;
    private contextCompanyId;
    private actor;
    private rethrowWriteError;
}
