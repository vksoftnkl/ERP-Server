export type ReportRow = Record<string, unknown>;
export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'object';
export interface FieldMeta {
    readonly name: string;
    readonly type: FieldType;
    readonly label: string;
    readonly format?: string;
    readonly complexScript?: boolean;
    readonly description?: string;
}
export interface ReportContext {
    readonly companyId: string;
    readonly branchId: string | null;
    readonly accYear: string;
    readonly docId: string;
    readonly userId: string | null;
    readonly params?: Readonly<Record<string, unknown>>;
}
export interface IReportDataProvider {
    resolve(context: ReportContext): Promise<ReportRow[] | ReportRow>;
    sampleData(): ReportRow[] | ReportRow;
    fields(): readonly FieldMeta[];
}
export interface ProviderDescriptor {
    readonly token: string;
    readonly label: string;
    readonly cardinality: 'one' | 'many';
    readonly docTypes: readonly string[];
    readonly fields: readonly FieldMeta[];
}
