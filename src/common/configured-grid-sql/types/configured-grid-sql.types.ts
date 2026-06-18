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
  /**
   * Pre-derived searchable field names. When provided, these take precedence over `gridId`-based
   * derivation, allowing non-grid callers (e.g. dropdown details) to reuse the paged query engine.
   */
  searchableFieldNames?: string[];
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
export interface BuildConfiguredGridFilterSqlOptions {
  baseSql: string;
  alias: string;
  /**
   * Map of output-column name → value to equality-filter on. Keys must match columns produced by
   * `baseSql`. Entries with `null`/`undefined` values are ignored (no constraint added).
   */
  filters: Record<string, unknown>;
  params?: unknown[];
}
