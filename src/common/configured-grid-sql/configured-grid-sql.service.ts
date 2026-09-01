import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PgService } from '../../database/pg/pg.service';
import {
  BuildConfiguredGridFilterSqlOptions,
  BuildConfiguredGridSearchSqlOptions,
  ConfiguredGridSqlCandidate,
  ConfiguredGridSqlValidationResult,
  GridColumnItem,
  LoadConfiguredGridSqlCandidatesOptions,
  RunConfiguredGridSqlPageOptions,
  RunConfiguredGridSqlPageResult,
  ValidateConfiguredGridSqlOptions,
} from './types/configured-grid-sql.types';
export type { ConfiguredGridListResult } from './types/configured-grid-sql.types';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;
const POSITIONAL_PARAMETER_PATTERN = /\$[1-9][0-9]*/;
const MIN_CONFIDENT_COLUMN_MATCH_SCORE = 2;
interface SqlRelationReference {
  schemaName: string | null;
  tableName: string;
}
type SearchColumnDescriptor = {
  normalized: string;
  tokens: string[];
  lastToken: string;
};
@Injectable()
export class ConfiguredGridSqlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PgService,
  ) { }
  private normalizeRelationName(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }
  private buildTableNameSearchTerms(tableName: string): string[] {
    const trimmed = tableName.trim();
    const normalized = this.normalizeRelationName(trimmed);
    return Array.from(new Set([trimmed, normalized].filter(Boolean)));
  }
  async loadCandidates(
    options: LoadConfiguredGridSqlCandidatesOptions,
  ): Promise<ConfiguredGridSqlCandidate[]> {
    const where: Prisma.GridDetailsWhereInput = {
      gridIsDeleted: false,
      gridStatus: true,
      gridSql: {
        not: null,
      },
    };
    if (options.applyTableNameFilter !== false) {
      const tableNameTerms = this.buildTableNameSearchTerms(options.tableName);
      where.OR = tableNameTerms.map((term) => ({
        gridSql: {
          contains: term,
          mode: 'insensitive',
        },
      }));
    }
    if (options.fixedGridId !== undefined) {
      where.gridId = options.fixedGridId;
    }
    return this.prisma.gridDetails.findMany({
      where,
      orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
      select: {
        gridId: true,
        gridSql: true,
      },
    });
  }
  filterPrimaryFromTable(
    candidates: ConfiguredGridSqlCandidate[],
    tableName: string,
  ): ConfiguredGridSqlCandidate[] {
    const normalizedTableName = this.normalizeRelationName(tableName);
    return candidates.filter((candidate) => {
      const rawSql = candidate.gridSql?.trim();
      if (!rawSql) {
        return false;
      }
      const extractedTableName = this.extractTopLevelFromTableName(rawSql);
      return (
        extractedTableName !== null &&
        this.normalizeRelationName(extractedTableName) === normalizedTableName
      );
    });
  }
  validateBaseSql(options: ValidateConfiguredGridSqlOptions): ConfiguredGridSqlValidationResult {
    const normalizedSql = this.prepareBaseSql(options.sql);
    if (!/^select\b/i.test(normalizedSql)) {
      return {
        isValid: false,
        message: 'Only SELECT query is allowed',
      };
    }
    if (normalizedSql.includes(';')) {
      return {
        isValid: false,
        message: 'Multiple statements are not allowed',
      };
    }
    if (GRID_SQL_COMMENT_PATTERN.test(normalizedSql)) {
      return {
        isValid: false,
        message: 'Comments are not allowed in configured query',
      };
    }
    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalizedSql)) {
      return {
        isValid: false,
        message: 'Write/DDL statements are not allowed',
      };
    }
    if (POSITIONAL_PARAMETER_PATTERN.test(normalizedSql)) {
      return {
        isValid: false,
        message: 'Positional parameters are not allowed in configured query',
      };
    }
    // tableName is optional: a grid/dropdown query is anchored to one table, but
    // a caller that may join anything is anchored by its p_company_id scope token
    // instead. Absent tableName means "no anchor to check"; every other rule
    // above still applies.
    if (options.tableName !== undefined) {
      const tableNameTerms = this.buildTableNameSearchTerms(options.tableName);
      const referencesConfiguredTable = tableNameTerms.some((term) => {
        const tableNameRegex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'i');
        return tableNameRegex.test(normalizedSql);
      });
      if (!referencesConfiguredTable) {
        return {
          isValid: false,
          message: `Configured query must reference ${options.tableName} table`,
        };
      }
      if (options.primaryTableSchema) {
        const primaryRelation = this.extractTopLevelFromRelation(normalizedSql);
        if (
          primaryRelation !== null &&
          this.normalizeRelationName(primaryRelation.tableName) ===
          this.normalizeRelationName(options.tableName) &&
          primaryRelation.schemaName !== null &&
          primaryRelation.schemaName !== options.primaryTableSchema.toLowerCase()
        ) {
          return {
            isValid: false,
            message: `Configured query must reference ${options.primaryTableSchema}.${options.tableName}`,
          };
        }
      }
    }
    if (options.extraForbiddenPatterns) {
      for (const rule of options.extraForbiddenPatterns) {
        if (rule.pattern.test(normalizedSql)) {
          return {
            isValid: false,
            message: rule.message,
          };
        }
      }
    }
    return {
      isValid: true,
      normalizedSql,
    };
  }
  async runPagedQuery<TItem>(
    options: RunConfiguredGridSqlPageOptions,
  ): Promise<RunConfiguredGridSqlPageResult<TItem>> {
    let baseSql = options.baseSql;
    let params = options.params ?? [];
    let preloadedColumns: GridColumnItem[] | undefined;
    if (options.search?.trim()) {
      // Prefer caller-supplied field names (e.g. dropdown details); otherwise derive from grid columns.
      let searchableFieldNames = options.searchableFieldNames;
      if (searchableFieldNames === undefined && options.gridId !== undefined) {
        // Load columns once — reused for both searchable field derivation and styles response.
        // This avoids a second gridColumn query that getSearchableFieldNames would otherwise make.
        preloadedColumns = await this.loadGridColumns(options.gridId);
        searchableFieldNames = this.deriveSearchableFieldNames(preloadedColumns, options.baseSql);
      }
      if (searchableFieldNames !== undefined) {
        const searchableSql = this.buildSearchSql({
          baseSql: options.baseSql,
          alias: options.alias,
          search: options.search,
          searchableFieldNames,
          params,
        });
        baseSql = searchableSql.sql;
        params = searchableSql.params;
      }
    }
    const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS ${options.alias}_count`;
    const orderByClause = options.sortBy
      ? ` ORDER BY "${options.sortBy.replace(/"/g, '""')}" ${options.sortDir === 'desc' ? 'DESC' : 'ASC'}`
      : '';
    const rowsSql = `SELECT * FROM (${baseSql}) AS ${options.alias}_rows${orderByClause} LIMIT $${params.length + 1
      } OFFSET $${params.length + 2}`;
    const [countResult, rowsResult] = await Promise.all([
      this.pg.queryReadOnly<{ total: bigint | number | string }>(countSql, params),
      this.pg.queryReadOnly(rowsSql, [...params, options.limit, options.skip]),
    ]);
    return {
      items: this.serializeRawQueryValue(rowsResult.rows) as TItem[],
      total: this.parseCountValue(countResult.rows[0]?.total),
    };
  }
  async assertBaseSqlExecutable(baseSql: string, alias: string): Promise<void> {
    const validationSql = `SELECT * FROM (${baseSql}) AS ${alias} LIMIT 0`;
    await this.pg.queryReadOnly(validationSql);
  }
  async loadGridColumns(gridId: bigint): Promise<GridColumnItem[]> {
    const columns = await this.prisma.gridColumn.findMany({
      where: {
        gridId,
        gridColumnIsDeleted: false
      },
      orderBy: { gridColumnNumber: 'asc' },
      select: {
        gridColumnId: true,
        gridColumnNumber: true,
        gridColumnName: true,
        gridColumnWidth: true,
        gridColumnPosition: true,
        gridColumnAlignment: true,
        gridColumnVisibility: true,
        gridColumnFilter: true,
        gridColumnCondition: true,
        gridColumnConditionColor: true,
        gridColumnGroup: true,
        gridColumnTotal: true,
        gridColumnDataType: true,
        gridColumnColor: true,
        gridColumnNotes: true,
        gridColumnPx: true,
        gridColumnSqlFieldName: true,
      },
    });
    return columns.map((col) => ({
      grid_column_id: col.gridColumnId,
      grid_column_number: col.gridColumnNumber,
      grid_column_name: col.gridColumnName,
      grid_column_width: col.gridColumnWidth !== null ? Number(col.gridColumnWidth) : null,
      grid_column_position:
        col.gridColumnPosition !== null ? Number(col.gridColumnPosition) : null,
      grid_column_alignment: col.gridColumnAlignment,
      grid_column_visibility: col.gridColumnVisibility,
      grid_column_filter: col.gridColumnFilter,
      grid_column_condition: col.gridColumnCondition,
      grid_column_condition_color: col.gridColumnConditionColor,
      grid_column_group: col.gridColumnGroup,
      grid_column_total: col.gridColumnTotal,
      grid_column_data_type: col.gridColumnDataType,
      grid_column_color: col.gridColumnColor,
      grid_column_notes: col.gridColumnNotes,
      grid_column_px: col.gridColumnPx,
      grid_column_sql_field_name: col.gridColumnSqlFieldName,
    }));
  }
  async loadPrimaryGridStyles(tableName: string): Promise<GridColumnItem[] | undefined> {
    const configuredGrids = await this.loadCandidates({ tableName });
    const configuredGrid = this.filterPrimaryFromTable(configuredGrids, tableName)[0];
    if (!configuredGrid) {
      return undefined;
    }
    return this.loadGridColumns(configuredGrid.gridId);
  }
  async getSearchableFieldNames(gridId: bigint, baseSql: string): Promise<string[]> {
    const columns = await this.loadGridColumns(gridId);
    return this.deriveSearchableFieldNames(columns, baseSql);
  }
  /**
   * Derive searchable field names from a caller-provided column list, reusing the same
   * explicit-sql-name + heuristic matching used for grids. Lets non-grid modules (e.g. dropdown
   * details) feed their own column metadata without depending on the grid_columns table.
   */
  deriveSearchableFieldNamesFromColumns(
    columns: Array<{
      filter: boolean;
      sqlFieldName: string | null;
      columnNumber: number;
      columnName: string;
    }>,
    baseSql: string,
  ): string[] {
    const mapped: GridColumnItem[] = columns.map((col, index) => ({
      grid_column_id: String(index),
      grid_column_number: col.columnNumber,
      grid_column_name: col.columnName,
      grid_column_width: null,
      grid_column_position: null,
      grid_column_alignment: null,
      grid_column_visibility: true,
      grid_column_filter: col.filter,
      grid_column_condition: null,
      grid_column_condition_color: null,
      grid_column_group: false,
      grid_column_total: false,
      grid_column_data_type: null,
      grid_column_color: null,
      grid_column_notes: null,
      grid_column_px: null,
      grid_column_sql_field_name: col.sqlFieldName,
    }));
    return this.deriveSearchableFieldNames(mapped, baseSql);
  }
  private deriveSearchableFieldNames(columns: GridColumnItem[], baseSql: string): string[] {
    const filterableColumns = columns
      .filter((col) => col.grid_column_filter)
      .sort((a, b) => a.grid_column_number - b.grid_column_number);

    if (filterableColumns.length === 0) {
      return [];
    }
    // Partition: columns with an explicit SQL field name vs. those needing heuristic matching
    const explicitFieldNames: string[] = [];
    const heuristicColumns: GridColumnItem[] = [];
    for (const col of filterableColumns) {
      const explicit = col.grid_column_sql_field_name?.trim();
      if (explicit) {
        if (!explicitFieldNames.includes(explicit)) {
          explicitFieldNames.push(explicit);
        }
      } else {
        heuristicColumns.push(col);
      }
    }
    if (heuristicColumns.length === 0) {
      return explicitFieldNames;
    }
    // Heuristic matching for columns without an explicit SQL field name
    const sqlFieldNames = this.extractSelectFieldNames(baseSql);
    if (sqlFieldNames.length === 0) {
      return explicitFieldNames;
    }
    const normalizedSqlFields = sqlFieldNames.map((fieldName) => ({
      fieldName,
      descriptor: this.describeSearchColumnName(fieldName),
    }));
    const usedSqlFieldIndexes = new Set<number>();
    const heuristicFieldNames: string[] = [];
    for (const column of heuristicColumns) {
      const columnName = column.grid_column_name.trim();
      let matchedSqlFieldIndex = -1;
      const columnDescriptor = this.describeSearchColumnName(columnName);
      if (columnDescriptor.normalized) {
        let bestScore = -1;
        let nextBestScore = -1;
        let bestScoreIsAmbiguous = false;
        for (let index = 0; index < normalizedSqlFields.length; index += 1) {
          if (usedSqlFieldIndexes.has(index)) {
            continue;
          }
          const score = this.getSearchColumnMatchScore(
            columnDescriptor,
            normalizedSqlFields[index].descriptor,
          );
          if (score > bestScore) {
            nextBestScore = bestScore;
            bestScore = score;
            matchedSqlFieldIndex = index;
            bestScoreIsAmbiguous = false;
            continue;
          }
          if (score === bestScore && score >= MIN_CONFIDENT_COLUMN_MATCH_SCORE) {
            bestScoreIsAmbiguous = true;
            continue;
          }
          if (score > nextBestScore) {
            nextBestScore = score;
          }
        }
        if (
          bestScore < MIN_CONFIDENT_COLUMN_MATCH_SCORE ||
          bestScore === nextBestScore ||
          bestScoreIsAmbiguous
        ) {
          matchedSqlFieldIndex = -1;
        }
      }
      if (matchedSqlFieldIndex === -1) {
        const sqlFieldIndexFromColumnNumber = column.grid_column_number - 1;
        if (
          sqlFieldIndexFromColumnNumber >= 0 &&
          sqlFieldIndexFromColumnNumber < normalizedSqlFields.length &&
          !usedSqlFieldIndexes.has(sqlFieldIndexFromColumnNumber)
        ) {
          matchedSqlFieldIndex = sqlFieldIndexFromColumnNumber;
        }
      }
      if (matchedSqlFieldIndex !== -1) {
        usedSqlFieldIndexes.add(matchedSqlFieldIndex);
        heuristicFieldNames.push(normalizedSqlFields[matchedSqlFieldIndex].fieldName);
      }
    }
    const matchedFieldNames = [...explicitFieldNames, ...heuristicFieldNames];
    return matchedFieldNames;
  }
  buildSearchSql(options: BuildConfiguredGridSearchSqlOptions): {
    sql: string;
    params: unknown[];
  } {
    const params = [...(options.params ?? [])];
    const conditions = [...(options.conditions ?? [])];
    const search = options.search.trim();
    if (search) {
      if (options.searchableFieldNames.length > 0) {
        const searchConditions: string[] = [];
        for (const fieldName of options.searchableFieldNames) {
          params.push(fieldName);
          const columnParamIndex = params.length;
          params.push(`%${search}%`);
          const valueParamIndex = params.length;
          searchConditions.push(
            `EXISTS (` +
            `SELECT 1 FROM jsonb_each_text(row_to_json(${options.alias})::jsonb) AS grid_kv(key, value) ` +
            `WHERE grid_kv.key = $${columnParamIndex} ` +
            `AND grid_kv.value ILIKE $${valueParamIndex}` +
            `)`,
          );
        }
        conditions.push(`(${searchConditions.join(' OR ')})`);
      } else {
        conditions.push('1 = 0');
      }
    }
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return {
      sql: `SELECT * FROM (${options.baseSql}) AS ${options.alias}${whereClause}`,
      params,
    };
  }
  /**
   * Wrap the base SQL in an equality filter built from a parameter map. Each key is treated as an
   * output-column name and bound to its value via a positional placeholder ($N), so values are sent
   * to PostgreSQL as bound parameters — never string-concatenated into the SQL. Keys with
   * null/undefined values (or an empty map) add no constraint, so omitting a param returns all rows.
   */
  buildFilterSql(options: BuildConfiguredGridFilterSqlOptions): {
    sql: string;
    params: unknown[];
  } {
    const params = [...(options.params ?? [])];
    const conditions: string[] = [];
    for (const [key, value] of Object.entries(options.filters)) {
      if (value === null || value === undefined) {
        continue;
      }
      const quotedKey = `"${key.replace(/"/g, '""')}"`;
      params.push(value);
      conditions.push(`${quotedKey} = $${params.length}`);
    }
    if (conditions.length === 0) {
      return { sql: options.baseSql, params };
    }
    return {
      sql: `SELECT * FROM (${options.baseSql}) AS ${options.alias}_filter WHERE ${conditions.join(' AND ')}`,
      params,
    };
  }
  /**
   * Bind grid_param values into the base SQL by replacing each named placeholder token with a
   * PostgreSQL positional parameter ($1, $2, …), returning the values in a separate params array.
   *
   * Convention (detected from the stored fixed.grid_details.grid_sql rows): the configured SQL
   * embeds parameters as bare identifiers — e.g. `p_comp_id`, `p_branch_id` — and occasionally as
   * quoted tokens (`'p_comp_id'`). The grid_param JSON keys match those token names; the `p_` prefix
   * keeps them distinct from real output columns (`ls_comp_id`, …). This is the secure, parameterized
   * counterpart of substituteGridPrm: values are NEVER concatenated into the SQL, so the result must
   * be executed via a bound query (pg.query / $queryRawUnsafe with the params array).
   *
   * Binding order is deterministic — placeholders are numbered in grid_param key order. A token may
   * appear many times in the SQL; every occurrence is bound to the same $N. Keys that never appear
   * in the SQL contribute no parameter (so an extra/unused param adds no constraint).
   */
  bindGridParams(
    sql: string,
    prm: Record<string, unknown>,
  ): { sql: string; params: unknown[] } {
    let boundSql = sql;
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(prm)) {
      const escapedKey = this.escapeRegex(key);
      const placeholder = `$${params.length + 1}`;
      let matched = false;
      const replaceToken = (pattern: RegExp): void => {
        boundSql = boundSql.replace(pattern, () => {
          matched = true;
          return placeholder;
        });
      };
      // Replace 'paramname' (token wrapped in single quotes) then the bare paramname token.
      replaceToken(new RegExp(`'${escapedKey}'`, 'g'));
      replaceToken(new RegExp(`\\b${escapedKey}\\b`, 'g'));
      if (matched) {
        params.push(value);
      }
    }
    return { sql: boundSql, params };
  }
  /**
   * Name the legacy parameter tokens still sitting in the SQL as string literals — i.e. the ones
   * bindGridParams found no grid_param key for. Used only to explain a failed run: an unbound token
   * is not an error by itself (grid 82's `chg_module IN ('B', 'imodule_name')` simply matches
   * nothing extra), but when it sits behind a cast — `'icompany_id'::uuid` — Postgres rejects the
   * literal and the run fails with a message that names the token but not the reason.
   *
   * Convention (both legacy prefixes, as stored in fixed.grid_details.grid_sql): `i` for the VFP
   * input params (`icompany_id`, `iacc_year`) and `p_` for the newer ones (`p_comp_id`). Matching is
   * deliberately loose — a real literal that happens to look like a token (`'in_progress'`) only
   * adds a wrong hint to an error that was already going to be reported, never blocks a working grid.
   */
  findUnboundParamTokens(sql: string): string[] {
    const tokens: string[] = [];
    const pattern = /'((?:p_|i)[a-z0-9]+(?:_[a-z0-9]+)+)'/g;
    let match = pattern.exec(sql);
    while (match !== null) {
      if (!tokens.includes(match[1])) {
        tokens.push(match[1]);
      }
      match = pattern.exec(sql);
    }
    return tokens;
  }
  parseCountValue(value: bigint | number | string | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  private serializeRawQueryValue(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeRawQueryValue(item));
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (value instanceof Date) {
      return value;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        this.serializeRawQueryValue(item),
      ]),
    );
  }
  private prepareBaseSql(sql: string): string {
    return sql.trim().replace(/;+\s*$/g, '');
  }
  /**
   * Remove SQL line (`--`) and block (`/* *​/`) comments while preserving any `--` or `/*`
   * sequences that appear inside single- or double-quoted string literals. Line comments are
   * dropped up to (but not including) the line break, and block comments are replaced with a
   * single space, so adjacent tokens stay separated. Callers that forbid comments outright
   * should keep using validateBaseSql; this is for inputs we want to accept and sanitize.
   */
  stripSqlComments(sql: string): string {
    let result = '';
    let insideSingleQuote = false;
    let insideDoubleQuote = false;
    for (let index = 0; index < sql.length; index += 1) {
      const current = sql[index];
      const next = sql[index + 1];
      if (insideSingleQuote) {
        result += current;
        if (current === "'" && next === "'") {
          result += next;
          index += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }
      if (insideDoubleQuote) {
        result += current;
        if (current === '"' && next === '"') {
          result += next;
          index += 1;
          continue;
        }
        if (current === '"') {
          insideDoubleQuote = false;
        }
        continue;
      }
      if (current === "'") {
        insideSingleQuote = true;
        result += current;
        continue;
      }
      if (current === '"') {
        insideDoubleQuote = true;
        result += current;
        continue;
      }
      if (current === '-' && next === '-') {
        index += 2;
        while (index < sql.length && sql[index] !== '\n') {
          index += 1;
        }
        // Step back so the loop's increment lands on the line break (kept as a separator).
        index -= 1;
        result += ' ';
        continue;
      }
      if (current === '/' && next === '*') {
        index += 2;
        while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) {
          index += 1;
        }
        // Skip the closing '*'; the loop's increment moves past the '/'.
        index += 1;
        result += ' ';
        continue;
      }
      result += current;
    }
    return result;
  }
  extractTopLevelFromTableName(sql: string): string | null {
    return this.extractTopLevelFromRelation(sql)?.tableName ?? null;
  }
  private tokenizeSearchColumnName(value: string): string[] {
    const normalizedSpacing = value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
    return normalizedSpacing ? normalizedSpacing.split(/\s+/) : [];
  }
  private describeSearchColumnName(value: string): SearchColumnDescriptor {
    const tokens = this.tokenizeSearchColumnName(value);
    return {
      normalized: tokens.join(''),
      tokens,
      lastToken: tokens[tokens.length - 1] ?? '',
    };
  }
  private getSearchColumnMatchScore(
    source: SearchColumnDescriptor,
    target: SearchColumnDescriptor,
  ): number {
    if (!source.normalized || !target.normalized) {
      return -1;
    }
    if (source.normalized === target.normalized) {
      return 4;
    }
    if (
      source.normalized.includes(target.normalized) ||
      target.normalized.includes(source.normalized)
    ) {
      return 3;
    }
    const sourceWithoutBooleanPrefix = source.normalized.replace(/^is/, '');
    const targetWithoutBooleanPrefix = target.normalized.replace(/^is/, '');
    if (
      sourceWithoutBooleanPrefix &&
      targetWithoutBooleanPrefix &&
      (sourceWithoutBooleanPrefix === targetWithoutBooleanPrefix ||
        sourceWithoutBooleanPrefix.endsWith(targetWithoutBooleanPrefix) ||
        targetWithoutBooleanPrefix.endsWith(sourceWithoutBooleanPrefix))
    ) {
      return 2;
    }
    if (source.lastToken && source.lastToken === target.lastToken) {
      return 2;
    }
    if (
      source.lastToken &&
      target.lastToken &&
      (source.lastToken.startsWith(target.lastToken) ||
        target.lastToken.startsWith(source.lastToken))
    ) {
      return 2;
    }
    const sharedTokens = source.tokens.filter((token) => target.tokens.includes(token));
    if (sharedTokens.length >= 2) {
      return 1;
    }
    return -1;
  }
  private extractSelectFieldNames(sql: string): string[] {
    const selectClause = this.extractTopLevelSelectClause(sql);
    if (!selectClause) {
      return [];
    }
    const expressions = this.splitTopLevelCommaSeparated(selectClause);
    const fieldNames: string[] = [];
    for (const expression of expressions) {
      const outputFieldName = this.extractSqlOutputFieldName(expression);
      if (!outputFieldName) {
        continue;
      }
      if (!fieldNames.includes(outputFieldName)) {
        fieldNames.push(outputFieldName);
      }
    }
    return fieldNames;
  }
  private extractTopLevelSelectClause(sql: string): string | null {
    const trimmed = sql.trim();
    const selectMatch = trimmed.match(/^select\b/i);
    if (!selectMatch) {
      return null;
    }
    const selectStartIndex = selectMatch[0].length;
    let depth = 0;
    let insideSingleQuote = false;
    let insideDoubleQuote = false;
    for (let index = selectStartIndex; index < trimmed.length; index += 1) {
      const current = trimmed[index];
      const next = trimmed[index + 1];
      if (insideSingleQuote) {
        if (current === "'" && next === "'") {
          index += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }
      if (insideDoubleQuote) {
        if (current === '"' && next === '"') {
          index += 1;
          continue;
        }
        if (current === '"') {
          insideDoubleQuote = false;
        }
        continue;
      }
      if (current === "'") {
        insideSingleQuote = true;
        continue;
      }
      if (current === '"') {
        insideDoubleQuote = true;
        continue;
      }
      if (current === '(') {
        depth += 1;
        continue;
      }
      if (current === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (
        depth === 0 &&
        /^from$/i.test(trimmed.slice(index, index + 4)) &&
        (index === 0 || /\s/.test(trimmed[index - 1])) &&
        (index + 4 >= trimmed.length || /\s/.test(trimmed[index + 4]))
      ) {
        return trimmed.slice(selectStartIndex, index).trim();
      }
    }
    return null;
  }
  private splitTopLevelCommaSeparated(value: string): string[] {
    const chunks: string[] = [];
    let startIndex = 0;
    let depth = 0;
    let insideSingleQuote = false;
    let insideDoubleQuote = false;
    for (let index = 0; index < value.length; index += 1) {
      const current = value[index];
      const next = value[index + 1];
      if (insideSingleQuote) {
        if (current === "'" && next === "'") {
          index += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }
      if (insideDoubleQuote) {
        if (current === '"' && next === '"') {
          index += 1;
          continue;
        }
        if (current === '"') {
          insideDoubleQuote = false;
        }
        continue;
      }
      if (current === "'") {
        insideSingleQuote = true;
        continue;
      }
      if (current === '"') {
        insideDoubleQuote = true;
        continue;
      }
      if (current === '(') {
        depth += 1;
        continue;
      }
      if (current === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (current === ',' && depth === 0) {
        chunks.push(value.slice(startIndex, index).trim());
        startIndex = index + 1;
      }
    }
    const tail = value.slice(startIndex).trim();
    if (tail) {
      chunks.push(tail);
    }
    return chunks;
  }
  private extractSqlOutputFieldName(expression: string): string | null {
    const trimmed = expression.trim();
    if (!trimmed || trimmed === '*' || /\.\*$/.test(trimmed)) {
      return null;
    }
    const explicitAliasMatch = trimmed.match(/\s+as\s+("([^"]|"")+"|[a-z_][a-z0-9_$]*)\s*$/i);
    if (explicitAliasMatch) {
      return this.parseSqlIdentifierToken(explicitAliasMatch[1]);
    }
    const implicitAliasMatch = trimmed.match(/\s+("([^"]|"")+"|[a-z_][a-z0-9_$]*)\s*$/i);
    if (implicitAliasMatch) {
      const aliasToken = implicitAliasMatch[1];
      const expressionWithoutAlias = trimmed.slice(0, trimmed.length - aliasToken.length).trim();
      if (expressionWithoutAlias) {
        return this.parseSqlIdentifierToken(aliasToken);
      }
    }
    const simpleColumnMatch = trimmed.match(
      /^((?:"([^"]|"")+"|[a-z_][a-z0-9_$]*)\.)*(?:"([^"]|"")+"|[a-z_][a-z0-9_$]*)$/i,
    );
    if (simpleColumnMatch) {
      const parts = trimmed.split('.');
      return this.parseSqlIdentifierToken(parts[parts.length - 1]);
    }
    return null;
  }
  private extractTopLevelFromRelation(sql: string): SqlRelationReference | null {
    const trimmed = sql.trim();
    const selectMatch = trimmed.match(/^select\b/i);
    if (!selectMatch) {
      return null;
    }
    const selectStartIndex = selectMatch[0].length;
    let depth = 0;
    let insideSingleQuote = false;
    let insideDoubleQuote = false;
    for (let index = selectStartIndex; index < trimmed.length; index += 1) {
      const current = trimmed[index];
      const next = trimmed[index + 1];
      if (insideSingleQuote) {
        if (current === "'" && next === "'") {
          index += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }
      if (insideDoubleQuote) {
        if (current === '"' && next === '"') {
          index += 1;
          continue;
        }
        if (current === '"') {
          insideDoubleQuote = false;
        }
        continue;
      }
      if (current === "'") {
        insideSingleQuote = true;
        continue;
      }
      if (current === '"') {
        insideDoubleQuote = true;
        continue;
      }
      if (current === '(') {
        depth += 1;
        continue;
      }
      if (current === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (
        depth === 0 &&
        /^from$/i.test(trimmed.slice(index, index + 4)) &&
        (index === 0 || /\s/.test(trimmed[index - 1])) &&
        (index + 4 >= trimmed.length || /\s/.test(trimmed[index + 4]))
      ) {
        const fromClause = trimmed.slice(index + 4).trimStart();
        const identifierPattern = '(?:"(?:""|[^"])+"|[a-z_][a-z0-9_$]*)';
        const relationPattern = new RegExp(
          `^(?:(${identifierPattern})\\s*\\.\\s*)?(${identifierPattern})`,
          'i',
        );
        const relationMatch = fromClause.match(relationPattern);
        if (!relationMatch) {
          return null;
        }
        const schemaName = relationMatch[1]
          ? this.parseSqlIdentifierToken(relationMatch[1])
          : null;
        const tableName = this.parseSqlIdentifierToken(relationMatch[2]);
        if (!tableName) {
          return null;
        }
        return {
          schemaName,
          tableName,
        };
      }
    }
    return null;
  }
  private parseSqlIdentifierToken(token: string): string | null {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }
    if (/^"([^"]|"")+"$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    if (/^[a-z_][a-z0-9_$]*$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return null;
  }
  substituteGridPrm(sql: string, prm: Record<string, unknown>): string {
    let result = sql;
    for (const [key, value] of Object.entries(prm)) {
      const literal = this.formatSqlLiteral(value);
      const escapedKey = this.escapeRegex(key);
      // Replace 'paramname' occurrences (param embedded inside single quotes in SQL)
      result = result.replace(new RegExp(`'${escapedKey}'`, 'g'), literal);
      // Replace bare paramname occurrences (whole-word, unquoted)
      result = result.replace(new RegExp(`\\b${escapedKey}\\b`, 'g'), literal);
    }
    return result;
  }
  private formatSqlLiteral(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return "'" + value.replace(/'/g, "''") + "'";
    return 'NULL';
  }
  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}