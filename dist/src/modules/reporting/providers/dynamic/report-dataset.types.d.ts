import { FieldMeta } from '../report-data-provider.types';
export type DatasetParamType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'uuid';
export declare const RESERVED_DATASET_PARAMS: {
    readonly p_company_id: "companyId";
    readonly p_branch_id: "branchId";
    readonly p_acc_year: "accYear";
    readonly p_doc_id: "docId";
    readonly p_user_id: "userId";
};
export type ReservedDatasetParam = keyof typeof RESERVED_DATASET_PARAMS;
export declare const MANDATORY_SCOPE_PARAM: ReservedDatasetParam;
export declare const isReservedDatasetParam: (name: string) => name is ReservedDatasetParam;
export declare const DATASET_PARAM_NAME_PATTERN: RegExp;
export interface ReportDatasetParamSpec {
    readonly name: string;
    readonly type: DatasetParamType;
    readonly required: boolean;
    readonly label?: string;
    readonly defaultValue?: unknown;
}
export interface ReportDatasetDefinition {
    readonly id: string;
    readonly token: string;
    readonly label: string;
    readonly cardinality: 'one' | 'many';
    readonly docTypes: readonly string[];
    readonly sql: string;
    readonly params: readonly ReportDatasetParamSpec[];
    readonly fields: readonly FieldMeta[];
    readonly sampleRows: readonly Record<string, unknown>[] | null;
    readonly maxRows: number;
    readonly version: number;
}
export interface DatasetProbeResult {
    readonly normalizedSql: string;
    readonly fields: readonly FieldMeta[];
    readonly reservedParamsUsed: readonly string[];
}
