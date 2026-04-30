import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
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

interface SqlRelationReference {
  schemaName: string | null;
  tableName: string;
}

@Injectable()
export class ConfiguredGridSqlService {
  constructor(private readonly prisma: PrismaService) { }

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
    const params = options.params ?? [];
    const countSql = `SELECT COUNT(*)::bigint AS total FROM (${options.baseSql}) AS ${options.alias}_count`;
    const rowsSql = `SELECT * FROM (${options.baseSql}) AS ${options.alias}_rows LIMIT $${params.length + 1
      } OFFSET $${params.length + 2}`;
    const columnsPromise =
      options.gridId !== undefined
        ? this.loadGridColumns(options.gridId)
        : Promise.resolve(undefined);
    const [countResult, rows, styles] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql, ...params),
      this.prisma.$queryRawUnsafe<TItem[]>(rowsSql, ...params, options.limit, options.skip),
      columnsPromise,
    ]);
    return {
      items: rows,
      total: this.parseCountValue(countResult[0]?.total),
      ...(styles !== undefined && { styles }),
    };
  }
  async assertBaseSqlExecutable(baseSql: string, alias: string): Promise<void> {
    const validationSql = `SELECT * FROM (${baseSql}) AS ${alias} LIMIT 0`;
    await this.prisma.$queryRawUnsafe(validationSql);
  }
  async loadGridColumns(gridId: bigint): Promise<GridColumnItem[]> {
    const columns = await this.prisma.gridColumn.findMany({
      where: {
        gridId,
        gridColumnIsDeleted: false,
      },
      orderBy: { gridColumnNumber: 'asc' },
      select: {
        gridColumnNumber: true,
        gridColumnName: true,
        gridColumnWidth: true,
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
      },
    });
    return columns.map((col) => ({
      grid_column_number: col.gridColumnNumber,
      grid_column_name: col.gridColumnName,
      grid_column_width: col.gridColumnWidth !== null ? Number(col.gridColumnWidth) : null,
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
    }));
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
  private prepareBaseSql(sql: string): string {
    return sql.trim().replace(/;+\s*$/g, '');
  }
  extractTopLevelFromTableName(sql: string): string | null {
    return this.extractTopLevelFromRelation(sql)?.tableName ?? null;
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
  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
