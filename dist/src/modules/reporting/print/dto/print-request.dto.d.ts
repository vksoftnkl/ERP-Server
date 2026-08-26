export declare class PrintQueryDto {
    accYear: string;
    paper?: string;
    mode?: string;
    templateId?: string;
    branchId?: string;
    printerProfile?: string;
    partyId?: string;
    asOn?: string;
}
export declare class BulkPrintDto {
    docType: string;
    docIds: string[];
    accYear: string;
    paper?: string;
    mode?: string;
    templateId?: string;
    branchId?: string;
    printerProfile?: string;
    params?: Record<string, unknown>;
}
export declare class PreviewDto {
    definition: Record<string, unknown>;
    mode?: string;
    useSampleData?: boolean;
    docId?: string;
    accYear?: string;
    branchId?: string;
    printerProfile?: string;
    params?: Record<string, unknown>;
}
