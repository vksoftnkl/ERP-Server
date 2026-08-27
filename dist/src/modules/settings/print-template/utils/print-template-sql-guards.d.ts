import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
export declare function normalizeDatasetSql(sql: string | null | undefined): string;
export declare function collectDatasetSqlErrors(sql: string, requiresCompany: boolean, field: string): ModuleErrorDetail[];
