export declare const REPORT_DATA_PROVIDER_METADATA = "reporting:data-provider";
export interface ReportDataProviderOptions {
    readonly label?: string;
    readonly cardinality?: 'one' | 'many';
    readonly docTypes?: readonly string[];
}
export interface ReportDataProviderMetadata extends ReportDataProviderOptions {
    readonly token: string;
}
export declare const ReportDataProvider: (token: string, options?: ReportDataProviderOptions) => import("@nestjs/common").CustomDecorator<string>;
