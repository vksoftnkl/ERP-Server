export declare class PrintTemplateIdQueryDto {
    ptlId: string;
    includeDeletedVersions?: boolean;
}
export declare class DeletePrintTemplateQueryDto {
    ptlId: string;
    ptlModifiedBy?: string | null;
}
