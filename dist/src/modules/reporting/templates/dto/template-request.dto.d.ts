export declare class CreateTemplateDto {
    ptDocType: string;
    ptOutputMode: string;
    ptPaperCode: string;
    ptName: string;
    ptCompanyId?: string;
    ptBranchId?: string;
    ptIsDefault?: boolean;
    ptIsActive?: boolean;
    definition: Record<string, unknown>;
}
export declare class UpdateTemplateDto {
    ptName?: string;
    ptIsActive?: boolean;
    definition?: Record<string, unknown>;
    note?: string;
}
export declare class GetTemplatesQueryDto {
    ptDocType?: string;
    ptOutputMode?: string;
    ptPaperCode?: string;
    ptCompanyId?: string;
    ptBranchId?: string;
    includeSystem?: boolean;
    activeOnly?: boolean;
}
export declare class CloneTemplateDto {
    ptName?: string;
    ptCompanyId?: string;
    ptBranchId?: string;
    ptIsDefault?: boolean;
}
export declare class ImportTemplateDto {
    payload: Record<string, unknown>;
    ptName?: string;
    ptCompanyId?: string;
    ptBranchId?: string;
}
