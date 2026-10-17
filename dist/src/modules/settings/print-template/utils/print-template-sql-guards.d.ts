import type { PrintTemplateErrorDetail } from '../types/print-template-api.types';
export declare function normalizeDatasetSql(sql: string | null | undefined): string;
export declare function collectDatasetSqlErrors(sql: string, field: string): PrintTemplateErrorDetail[];
