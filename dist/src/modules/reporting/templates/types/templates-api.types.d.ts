import { TemplateDefinition } from '../dto/template-definition.schema';
export interface TemplatesSuccessResponse<TData, TMeta = undefined> {
    success: true;
    message: string;
    data: TData;
    meta?: TMeta;
}
export interface TemplateSummaryPayload {
    ptId: string;
    ptCompanyId: string | null;
    ptBranchId: string | null;
    ptDocType: string;
    ptOutputMode: string;
    ptPaperCode: string;
    ptName: string;
    ptVersion: number;
    ptParentId: string | null;
    ptSchemaVer: number;
    ptIsDefault: boolean;
    ptIsActive: boolean;
    isSystemTemplate: boolean;
    ptCreatedOn: string;
    ptCreatedBy: string | null;
    ptModifiedOn: string | null;
    ptModifiedBy: string | null;
}
export interface TemplatePayload extends TemplateSummaryPayload {
    definition: TemplateDefinition;
    definitionMigrated: boolean;
}
export interface TemplateRevisionPayload {
    ptrId: string;
    ptrTemplateId: string;
    ptrVersion: number;
    ptrSchemaVer: number;
    ptrNote: string | null;
    ptrCreatedOn: string;
    ptrCreatedBy: string | null;
}
export interface TemplateListMeta {
    count: number;
    docType?: string;
    outputMode?: string;
    paperCode?: string;
    companyId?: string;
    includeSystem: boolean;
}
export interface TemplateExportPayload {
    kind: 'vknex.print-template';
    exportVersion: 1;
    exportedAt: string;
    name: string;
    docType: string;
    outputMode: string;
    paperCode: string;
    schemaVersion: number;
    definition: TemplateDefinition;
}
export interface TemplateDeleteResult {
    ptId: string;
    deleted: boolean;
}
export type TemplateResolutionSource = 'EXPLICIT' | 'BRANCH_DEFAULT' | 'COMPANY_DEFAULT' | 'SYSTEM_DEFAULT';
export interface ResolvedTemplate {
    ptId: string;
    name: string;
    version: number;
    outputMode: string;
    paperCode: string;
    definition: TemplateDefinition;
    source: TemplateResolutionSource;
}
