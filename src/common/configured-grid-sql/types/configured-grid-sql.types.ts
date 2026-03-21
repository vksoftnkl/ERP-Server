export interface ConfiguredGridSqlCandidate {
  gridId: bigint;
  gridSql: string | null;
}
export interface LoadConfiguredGridSqlCandidatesOptions {
  tableName: string;
  fixedGridId?: bigint;
  applyTableNameFilter?: boolean;
}
export interface ValidateConfiguredGridSqlOptions {
  sql: string;
  tableName: string;
  extraForbiddenPatterns?: Array<{
    pattern: RegExp;
    message: string;
  }>;
}
export type ConfiguredGridSqlValidationResult =
  | {
      isValid: true;
      normalizedSql: string;
    }
  | {
      isValid: false;
      message: string;
    };
export interface RunConfiguredGridSqlPageOptions {
  baseSql: string;
  alias: string;
  params?: unknown[];
  limit: number;
  skip: number;
}
export interface RunConfiguredGridSqlPageResult<TItem> {
  items: TItem[];
  total: number;
}
