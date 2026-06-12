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
  primaryTableSchema?: string;
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
export interface GridColumnItem {
  grid_column_id: string;
  grid_column_number: number;
  grid_column_name: string;
  grid_column_width: number | null;
  grid_column_position: number | null;
  grid_column_alignment: string | null;
  grid_column_visibility: boolean;
  grid_column_filter: boolean;
  grid_column_condition: string | null;
  grid_column_condition_color: string | null;
  grid_column_group: boolean;
  grid_column_total: boolean;
  grid_column_data_type: string | null;
  grid_column_color: string | null;
  grid_column_notes: string | null;
  grid_column_sql_field_name: string | null;
}
export interface RunConfiguredGridSqlPageOptions {
  baseSql: string;
  alias: string;
  params?: unknown[];
  search?: string;
  limit: number;
  skip: number;
  /** When provided, grid column definitions are used to derive searchable field names for search. */
  gridId?: bigint;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
export interface RunConfiguredGridSqlPageResult<TItem> {
  items: TItem[];
  total: number;
}
export interface ConfiguredGridListResult<TItem, TMeta> {
  items: TItem[];
  meta: TMeta;
}
export interface BuildConfiguredGridSearchSqlOptions {
  baseSql: string;
  alias: string;
  search: string;
  searchableFieldNames: string[];
  params?: unknown[];
  conditions?: string[];
}
