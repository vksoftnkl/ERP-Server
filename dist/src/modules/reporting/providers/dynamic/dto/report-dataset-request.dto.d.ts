export declare class ReportDatasetParamDto {
    name: string;
    type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'uuid';
    required: boolean;
    label?: string;
    defaultValue?: unknown;
}
export declare class CreateReportDatasetDto {
    rdsToken: string;
    rdsLabel: string;
    rdsCardinality: 'one' | 'many';
    rdsDocTypes: string[];
    rdsSql: string;
    rdsParams: ReportDatasetParamDto[];
    rdsFieldOverrides?: Array<Record<string, unknown>>;
    rdsSampleRows?: Array<Record<string, unknown>>;
    rdsMaxRows?: number;
    rdsNotes?: string;
    rdsIsActive?: boolean;
}
export declare class UpdateReportDatasetDto {
    rdsLabel?: string;
    rdsCardinality?: 'one' | 'many';
    rdsDocTypes?: string[];
    rdsSql?: string;
    rdsParams?: ReportDatasetParamDto[];
    rdsFieldOverrides?: Array<Record<string, unknown>>;
    rdsSampleRows?: Array<Record<string, unknown>>;
    rdsMaxRows?: number;
    rdsNotes?: string;
    rdsIsActive?: boolean;
}
export declare class ProbeReportDatasetDto {
    rdsSql: string;
    rdsParams: ReportDatasetParamDto[];
}
export declare class PreviewReportDatasetDto {
    accYear: string;
    branchId?: string;
    docId?: string;
    params?: Record<string, unknown>;
    limit?: number;
}
