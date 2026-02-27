import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GodownLocation, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListOrGetGodownQueryDto } from './dto/list-or-get-godown-query.dto';
import { SaveGodownDto } from './dto/save-godown.dto';
import {
  GodownErrorDetail,
  GodownErrorResponse,
  GodownListItem,
  GodownListMeta,
  GodownPayload,
} from './types/godown-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const GODOWN_LOCATION_TABLE_NAME = 'godown_locations';
const GODOWN_LOCATION_AUDIT_SCREEN_NAME = 'Godown Location Master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;

type GodownLocationWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class GodownsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveGodownDto: SaveGodownDto): Promise<GodownPayload> {
    const normalizedSaveGodownDto = this.normalizeLegacySaveGodownDto(saveGodownDto);

    if (normalizedSaveGodownDto.gdl_id) {
      return this.updateGodownLocation(normalizedSaveGodownDto);
    }

    return this.createGodownLocation(normalizedSaveGodownDto);
  }

  async getList(
    queryDto: ListOrGetGodownQueryDto,
  ): Promise<{ items: GodownListItem[]; meta: GodownListMeta }> {
    return this.list(queryDto);
  }

  async list(
    queryDto: ListOrGetGodownQueryDto,
  ): Promise<{ items: GodownListItem[]; meta: GodownListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const configuredList = await this.listFromConfiguredGridSql(queryDto, page, limit, skip);
    if (configuredList) {
      return configuredList;
    }
    const where = this.buildListWhere(queryDto);

    const [total, records] = await Promise.all([
      this.prisma.godownLocation.count({ where }),
      this.prisma.godownLocation.findMany({
        where,
        orderBy: [{ gdlSort: 'asc' }, { gdlName: 'asc' }, { gdlId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  private async listFromConfiguredGridSql(
    queryDto: ListOrGetGodownQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ items: GodownListItem[]; meta: GodownListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: GODOWN_LOCATION_TABLE_NAME,
          mode: 'insensitive',
        },
      },
      orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
      select: {
        gridId: true,
        gridSql: true,
      },
    });
    const rawGridSql = configuredGrid?.gridSql?.trim();
    if (!configuredGrid || !rawGridSql) {
      return null;
    }

    const baseSql = this.validateConfiguredGridSql(rawGridSql);
    const searchableFieldNames = queryDto.search?.trim()
      ? await this.getConfiguredSearchableFieldNames(configuredGrid.gridId, baseSql)
      : [];
    const { sql: filteredSql, params } = this.buildConfiguredGridListSql(
      baseSql,
      queryDto,
      searchableFieldNames,
    );
    const countSql = `SELECT COUNT(*)::bigint AS total FROM (${filteredSql}) AS godown_grid_count`;
    const rowsSql = `SELECT * FROM (${filteredSql}) AS godown_grid_rows LIMIT $${
      params.length + 1
    } OFFSET $${params.length + 2}`;

    try {
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(
          countSql,
          ...params,
        ),
        this.prisma.$queryRawUnsafe<GodownListItem[]>(rowsSql, ...params, limit, skip),
      ]);
      const total = this.parseCountValue(countResult[0]?.total);

      return {
        items: rows,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch {
      this.throwBadRequest('Invalid grid_sql configuration for godown location list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for godown_locations',
        },
      ]);
    }
  }

  private buildConfiguredGridListSql(
    baseSql: string,
    queryDto: ListOrGetGodownQueryDto,
    searchableFieldNames: string[],
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (queryDto.gdl_godown_id !== undefined) {
      params.push(queryDto.gdl_godown_id);
      conditions.push(`godown_grid.gdl_godown_id = $${params.length}`);
    }

    if (queryDto.gdl_branch_id !== undefined) {
      params.push(queryDto.gdl_branch_id);
      conditions.push(`godown_grid.gdl_branch_id = $${params.length}`);
    }

    if (queryDto.gdl_parent_id !== undefined) {
      params.push(queryDto.gdl_parent_id);
      conditions.push(`godown_grid.gdl_parent_id = $${params.length}`);
    }

    if (queryDto.gdl_is_active !== undefined) {
      params.push(queryDto.gdl_is_active);
      conditions.push(`godown_grid.gdl_is_active = $${params.length}`);
    }

    if (queryDto.search?.trim()) {
      const searchText = `%${queryDto.search.trim()}%`;
      if (searchableFieldNames.length > 0) {
        const searchConditions: string[] = [];
        for (const fieldName of searchableFieldNames) {
          params.push(fieldName);
          const columnParamIndex = params.length;
          params.push(searchText);
          const valueParamIndex = params.length;
          searchConditions.push(
            `EXISTS (` +
              `SELECT 1 FROM jsonb_each_text(row_to_json(godown_grid)::jsonb) AS grid_kv(key, value) ` +
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
      sql: `SELECT * FROM (${baseSql}) AS godown_grid${whereClause}`,
      params,
    };
  }

  private async getConfiguredSearchableFieldNames(
    gridId: bigint,
    baseSql: string,
  ): Promise<string[]> {
    const sqlFieldNames = this.extractSelectFieldNames(baseSql);
    if (sqlFieldNames.length === 0) {
      return [];
    }

    const configuredColumns = await this.prisma.gridColumn.findMany({
      where: {
        gridId,
        gridColumnIsDeleted: false,
        gridColumnFilter: true,
        grid: {
          gridIsDeleted: false,
        },
      },
      orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
      select: {
        gridColumnName: true,
      },
    });

    const filteredColumnNames: string[] = [];
    for (const column of configuredColumns) {
      const columnName = column.gridColumnName.trim();
      if (!columnName) {
        continue;
      }
      filteredColumnNames.push(columnName);
    }

    const normalizedSqlFields = sqlFieldNames.map((fieldName) => ({
      fieldName,
      normalizedFieldName: this.normalizeSearchColumnName(fieldName),
    }));
    const usedSqlFieldIndexes = new Set<number>();
    const matchedFieldNames: string[] = [];

    for (const columnName of filteredColumnNames) {
      const normalizedColumnName = this.normalizeSearchColumnName(columnName);
      if (!normalizedColumnName) {
        continue;
      }

      const matchedSqlFieldIndex = normalizedSqlFields.findIndex(
        (sqlField, index) =>
          !usedSqlFieldIndexes.has(index) && sqlField.normalizedFieldName === normalizedColumnName,
      );
      if (matchedSqlFieldIndex !== -1) {
        usedSqlFieldIndexes.add(matchedSqlFieldIndex);
        matchedFieldNames.push(normalizedSqlFields[matchedSqlFieldIndex].fieldName);
      }
    }

    if (matchedFieldNames.length > 0) {
      return matchedFieldNames;
    }

    const fallbackFieldCount = Math.min(filteredColumnNames.length, sqlFieldNames.length);
    return sqlFieldNames.slice(0, fallbackFieldCount);
  }

  private normalizeSearchColumnName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
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

    for (let i = selectStartIndex; i < trimmed.length; i += 1) {
      const current = trimmed[i];
      const next = trimmed[i + 1];

      if (insideSingleQuote) {
        if (current === "'" && next === "'") {
          i += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }

      if (insideDoubleQuote) {
        if (current === '"' && next === '"') {
          i += 1;
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
        /^from$/i.test(trimmed.slice(i, i + 4)) &&
        (i === 0 || /\s/.test(trimmed[i - 1])) &&
        (i + 4 >= trimmed.length || /\s/.test(trimmed[i + 4]))
      ) {
        return trimmed.slice(selectStartIndex, i).trim();
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

    for (let i = 0; i < value.length; i += 1) {
      const current = value[i];
      const next = value[i + 1];

      if (insideSingleQuote) {
        if (current === "'" && next === "'") {
          i += 1;
          continue;
        }
        if (current === "'") {
          insideSingleQuote = false;
        }
        continue;
      }

      if (insideDoubleQuote) {
        if (current === '"' && next === '"') {
          i += 1;
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
        chunks.push(value.slice(startIndex, i).trim());
        startIndex = i + 1;
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

    const simpleColumnMatch = trimmed.match(
      /^((?:"([^"]|"")+"|[a-z_][a-z0-9_$]*)\.)*(?:"([^"]|"")+"|[a-z_][a-z0-9_$]*)$/i,
    );
    if (simpleColumnMatch) {
      const parts = trimmed.split('.');
      return this.parseSqlIdentifierToken(parts[parts.length - 1]);
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
      return trimmed;
    }

    return null;
  }

  private validateConfiguredGridSql(sql: string): string {
    const normalized = sql.trim().replace(/;+\s*$/g, '');
    if (!/^select\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for godown location list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }
    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for godown location list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }
    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for godown location list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }
    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for godown location list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }
    if (!/\bgodown_locations\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for godown location list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference godown_locations table',
        },
      ]);
    }
    return normalized;
  }

  private parseCountValue(value: bigint | number | string | undefined): number {
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

  async getById(gdlId: string): Promise<GodownPayload> {
    const record = await this.findActiveLocation(this.prisma, gdlId);

    if (!record) {
      this.throwNotFound(gdlId);
    }

    return this.toPayload(record);
  }

  async softDelete(gdlId: string): Promise<{ gdl_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.getActiveLocationOrThrow(tx, gdlId);
      const now = new Date();
      const subtreeIds = await this.getActiveSubtreeIds(tx, gdlId);
      const ancestorIds = await this.getAncestorIds(tx, existing.gdlParentId);

      const result = await tx.godownLocation.updateMany({
        where: {
          gdlId,
          gdlIsDeleted: false,
        },
        data: {
          gdlIsDeleted: true,
          gdlModifiedOn: now,
          gdlModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(gdlId);
      }

      await this.removePathIds(tx, ancestorIds, subtreeIds);

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        gdlIsDeleted: true,
        gdlModifiedOn: now,
        gdlModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: GODOWN_LOCATION_TABLE_NAME,
          screenName: GODOWN_LOCATION_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: gdlId,
          displayName: existing.gdlName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Godown location soft deleted',
        },
        tx,
      );

      return {
        gdl_id: gdlId,
        deleted: true,
      };
    });
  }

  private async createGodownLocation(saveGodownDto: SaveGodownDto): Promise<GodownPayload> {
    const { gdlName, gdlGodownId, gdlBranchId } = this.validateCreatePayload(saveGodownDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        await this.validateParentAssignment(tx, {
          parentId: saveGodownDto.gdl_parent_id ?? null,
          gdlGodownId,
          gdlBranchId,
        });

        const data: Prisma.GodownLocationUncheckedCreateInput = {
          gdlGodownId,
          gdlBranchId,
          gdlName,
          gdlCreatedOn: now,
          gdlCreatedBy: DEFAULT_ACTOR,
          gdlModifiedOn: now,
          gdlModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveGodownDto);

        const created = await tx.godownLocation.create({ data });
        await this.ensureSelfInPath(tx, created.gdlId);

        if (saveGodownDto.gdl_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveGodownDto.gdl_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.gdlId]);
        }

        const refreshed = await this.findActiveLocation(tx, created.gdlId);
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              gdlPathIdsCache: this.mergePathIds(created.gdlPathIdsCache, [created.gdlId]),
            })
          : this.toPayload(refreshed);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: GODOWN_LOCATION_TABLE_NAME,
            screenName: GODOWN_LOCATION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.gdl_id,
            displayName: payload.gdl_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Godown location created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateGodownLocation(saveGodownDto: SaveGodownDto): Promise<GodownPayload> {
    const gdlId = saveGodownDto.gdl_id!;
    if (!saveGodownDto.gdl_godown_id) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_godown_id',
          message: 'gdl_godown_id is required for update',
        },
      ]);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.getActiveLocationOrThrow(tx, gdlId);
        const gdlGodownId = saveGodownDto.gdl_godown_id ?? existing.gdlGodownId;
        const gdlBranchId = saveGodownDto.gdl_branch_id ?? existing.gdlBranchId;
        const parentId = this.hasOwnProperty(saveGodownDto, 'gdl_parent_id')
          ? (saveGodownDto.gdl_parent_id ?? null)
          : existing.gdlParentId;

        await this.validateParentAssignment(tx, {
          currentId: gdlId,
          parentId,
          gdlGodownId,
          gdlBranchId,
        });

        const hasParentField = this.hasOwnProperty(saveGodownDto, 'gdl_parent_id');
        const nextParentId = hasParentField
          ? (saveGodownDto.gdl_parent_id ?? null)
          : existing.gdlParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.gdlParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, gdlId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.gdlParentId)
          : [];

        const data: Prisma.GodownLocationUncheckedUpdateInput = {};
        this.applyOptionalFields(data, saveGodownDto);

        if (this.hasOwnProperty(saveGodownDto, 'gdl_name')) {
          if (!saveGodownDto.gdl_name?.trim()) {
            this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
              {
                field: 'gdl_name',
                message: 'gdl_name cannot be empty',
              },
            ]);
          }

          data.gdlName = saveGodownDto.gdl_name.trim();
        }

        if (Object.keys(data).length === 0) {
          return this.toPayload(existing);
        }

        data.gdlModifiedOn = new Date();
        data.gdlModifiedBy = DEFAULT_ACTOR;

        const updated = await tx.godownLocation.update({
          where: {
            gdlId,
          },
          data,
        });

        await this.ensureSelfInPath(tx, gdlId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await this.findActiveLocation(tx, gdlId);
        const payload = this.toPayload(refreshed ?? updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: GODOWN_LOCATION_TABLE_NAME,
            screenName: GODOWN_LOCATION_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.gdl_id,
            displayName: payload.gdl_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Godown location updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private buildListWhere(queryDto: ListOrGetGodownQueryDto): Prisma.GodownLocationWhereInput {
    const where: Prisma.GodownLocationWhereInput = {
      gdlIsDeleted: false,
    };

    if (queryDto.gdl_is_active !== undefined) {
      where.gdlIsActive = queryDto.gdl_is_active;
    }

    if (queryDto.gdl_godown_id) {
      where.gdlGodownId = queryDto.gdl_godown_id;
    }

    if (queryDto.gdl_branch_id) {
      where.gdlBranchId = queryDto.gdl_branch_id;
    }

    if (queryDto.gdl_parent_id !== undefined) {
      where.gdlParentId = queryDto.gdl_parent_id;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { gdlName: { contains: search, mode: 'insensitive' } },
        { gdlShort: { contains: search, mode: 'insensitive' } },
        { gdlCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private normalizeLegacySaveGodownDto(saveGodownDto: SaveGodownDto): SaveGodownDto {
    const normalized: SaveGodownDto = { ...saveGodownDto };

    if (normalized.gdl_id === undefined && normalized.gdl_location_id !== undefined) {
      normalized.gdl_id = normalized.gdl_location_id;
    }

    if (normalized.gdl_godown_id === undefined && normalized.godown_id !== undefined) {
      normalized.gdl_godown_id = normalized.godown_id;
    }

    if (normalized.gdl_branch_id === undefined && normalized.branch_id !== undefined) {
      normalized.gdl_branch_id = normalized.branch_id;
    }

    if (normalized.gdl_name === undefined && normalized.godown_name !== undefined) {
      normalized.gdl_name = normalized.godown_name;
    }

    if (normalized.gdl_code === undefined && normalized.godown_code !== undefined) {
      normalized.gdl_code = normalized.godown_code;
    }

    if (normalized.gdl_short === undefined) {
      if (normalized.godown_short !== undefined) {
        normalized.gdl_short = normalized.godown_short;
      } else if (normalized.godown_alias !== undefined) {
        normalized.gdl_short = normalized.godown_alias;
      }
    }

    if (normalized.gdl_remarks === undefined && normalized.godown_description !== undefined) {
      normalized.gdl_remarks = normalized.godown_description;
    }

    if (normalized.gdl_sort === undefined && normalized.godown_sort !== undefined) {
      normalized.gdl_sort = normalized.godown_sort;
    }

    if (normalized.gdl_parent_id === undefined && normalized.parent_id !== undefined) {
      normalized.gdl_parent_id = normalized.parent_id;
    }

    if (normalized.gdl_is_active === undefined && normalized.is_active !== undefined) {
      normalized.gdl_is_active = normalized.is_active;
    }

    return normalized;
  }

  private validateCreatePayload(saveGodownDto: SaveGodownDto): {
    gdlName: string;
    gdlGodownId: string;
    gdlBranchId: string;
  } {
    const gdlName = saveGodownDto.gdl_name?.trim();
    if (!gdlName) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_name',
          message: 'gdl_name is required',
        },
      ]);
    }

    if (!saveGodownDto.gdl_branch_id) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_branch_id',
          message: 'gdl_branch_id is required',
        },
      ]);
    }

    return {
      gdlName,
      gdlGodownId: saveGodownDto.gdl_godown_id ?? randomUUID(),
      gdlBranchId: saveGodownDto.gdl_branch_id,
    };
  }

  private async findActiveLocation(
    client: GodownLocationWriteClient,
    gdlId: string,
  ): Promise<GodownLocation | null> {
    return client.godownLocation.findFirst({
      where: {
        gdlId,
        gdlIsDeleted: false,
      },
    });
  }

  private async getActiveLocationOrThrow(
    client: GodownLocationWriteClient,
    gdlId: string,
  ): Promise<GodownLocation> {
    const record = await this.findActiveLocation(client, gdlId);
    if (!record) {
      this.throwNotFound(gdlId);
    }

    return record;
  }

  private async validateParentAssignment(
    tx: GodownLocationWriteClient,
    params: {
      parentId: string | null;
      gdlGodownId: string;
      gdlBranchId: string;
      currentId?: string;
    },
  ): Promise<void> {
    if (!params.parentId) {
      return;
    }

    if (params.currentId && params.parentId === params.currentId) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_parent_id',
          message: 'gdl_parent_id cannot be the same as gdl_id',
        },
      ]);
    }

    const parent = await this.findActiveLocation(tx, params.parentId);
    if (!parent) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_parent_id',
          message: `No active parent location found with id ${params.parentId}`,
        },
      ]);
    }

    const isSameHierarchy =
      parent.gdlGodownId === params.gdlGodownId && parent.gdlBranchId === params.gdlBranchId;
    if (!isSameHierarchy) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_parent_id',
          message: 'Parent location must belong to the same gdl_godown_id and gdl_branch_id',
        },
      ]);
    }
  }

  private async getAncestorIds(
    tx: GodownLocationWriteClient,
    startParentId: string | null | undefined,
  ): Promise<string[]> {
    const ancestorIds: string[] = [];
    const visited = new Set<string>();
    let currentParentId = startParentId;

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        break;
      }
      visited.add(currentParentId);

      const parent = await tx.godownLocation.findFirst({
        where: {
          gdlId: currentParentId,
          gdlIsDeleted: false,
        },
        select: {
          gdlId: true,
          gdlParentId: true,
        },
      });
      if (!parent) {
        break;
      }

      ancestorIds.push(parent.gdlId);
      currentParentId = parent.gdlParentId;
    }

    return ancestorIds;
  }

  private async getActiveSubtreeIds(
    tx: GodownLocationWriteClient,
    rootId: string,
  ): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = await tx.godownLocation.findFirst({
        where: {
          gdlId: currentId,
          gdlIsDeleted: false,
        },
        select: {
          gdlId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.gdlId);

      const children = await tx.godownLocation.findMany({
        where: {
          gdlParentId: node.gdlId,
          gdlIsDeleted: false,
        },
        select: {
          gdlId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.gdlId)) {
          queue.push(child.gdlId);
        }
      }
    }

    return subtreeIds;
  }

  private async appendPathIds(
    tx: GodownLocationWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.godownLocation.findMany({
      where: {
        gdlId: {
          in: normalizedTargetIds,
        },
        gdlIsDeleted: false,
      },
      select: {
        gdlId: true,
        gdlPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.gdlPathIdsCache, normalizedIdsToAdd);
      if (this.areSameIds(record.gdlPathIdsCache, nextPathIds)) {
        continue;
      }

      await tx.godownLocation.update({
        where: {
          gdlId: record.gdlId,
        },
        data: {
          gdlPathIdsCache: nextPathIds,
        },
      });
    }
  }

  private async removePathIds(
    tx: GodownLocationWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.godownLocation.findMany({
      where: {
        gdlId: {
          in: normalizedTargetIds,
        },
        gdlIsDeleted: false,
      },
      select: {
        gdlId: true,
        gdlPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.gdlPathIdsCache, normalizedIdsToRemove);
      if (this.areSameIds(record.gdlPathIdsCache, nextPathIds)) {
        continue;
      }

      await tx.godownLocation.update({
        where: {
          gdlId: record.gdlId,
        },
        data: {
          gdlPathIdsCache: nextPathIds,
        },
      });
    }
  }

  private async ensureSelfInPath(tx: GodownLocationWriteClient, gdlId: string): Promise<void> {
    await this.appendPathIds(tx, [gdlId], [gdlId]);
  }

  private mergePathIds(existingIds: readonly string[], idsToAdd: readonly string[]): string[] {
    return this.toUniqueIds([...existingIds, ...idsToAdd]);
  }

  private excludePathIds(existingIds: readonly string[], idsToRemove: readonly string[]): string[] {
    const removeSet = new Set(idsToRemove);
    return existingIds.filter((id) => !removeSet.has(id));
  }

  private toUniqueIds(ids: readonly string[]): string[] {
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }
    return uniqueIds;
  }

  private areSameIds(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
    return true;
  }

  private applyOptionalFields(
    data: Prisma.GodownLocationUncheckedCreateInput | Prisma.GodownLocationUncheckedUpdateInput,
    saveGodownDto: SaveGodownDto,
  ): void {
    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_godown_id') &&
      saveGodownDto.gdl_godown_id !== undefined
    ) {
      data.gdlGodownId = saveGodownDto.gdl_godown_id;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_branch_id') &&
      saveGodownDto.gdl_branch_id !== undefined
    ) {
      data.gdlBranchId = saveGodownDto.gdl_branch_id;
    }

    if (this.hasOwnProperty(saveGodownDto, 'gdl_short') && saveGodownDto.gdl_short !== undefined) {
      data.gdlShort = saveGodownDto.gdl_short;
    }

    if (this.hasOwnProperty(saveGodownDto, 'gdl_code') && saveGodownDto.gdl_code !== undefined) {
      data.gdlCode = saveGodownDto.gdl_code;
    }

    if (this.hasOwnProperty(saveGodownDto, 'gdl_type') && saveGodownDto.gdl_type !== undefined) {
      if (!saveGodownDto.gdl_type.trim()) {
        this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
          {
            field: 'gdl_type',
            message: 'gdl_type cannot be empty',
          },
        ]);
      }

      data.gdlType = saveGodownDto.gdl_type.trim();
    }

    if (this.hasOwnProperty(saveGodownDto, 'gdl_parent_id')) {
      data.gdlParentId = saveGodownDto.gdl_parent_id ?? null;
    }

    if (this.hasOwnProperty(saveGodownDto, 'gdl_sort') && saveGodownDto.gdl_sort !== undefined) {
      data.gdlSort = saveGodownDto.gdl_sort;
    }

    if (this.hasOwnProperty(saveGodownDto, 'gdl_level') && saveGodownDto.gdl_level !== undefined) {
      data.gdlLevel = saveGodownDto.gdl_level;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_del_sheet') &&
      saveGodownDto.gdl_del_sheet !== undefined
    ) {
      data.gdlDelSheet = saveGodownDto.gdl_del_sheet;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_split_stock') &&
      saveGodownDto.gdl_split_stock !== undefined
    ) {
      data.gdlSplitStock = saveGodownDto.gdl_split_stock;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_negative_stock') &&
      saveGodownDto.gdl_negative_stock !== undefined
    ) {
      data.gdlNegativeStock = saveGodownDto.gdl_negative_stock;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_volume') &&
      saveGodownDto.gdl_volume !== undefined
    ) {
      data.gdlVolume = saveGodownDto.gdl_volume;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_is_active') &&
      saveGodownDto.gdl_is_active !== undefined
    ) {
      data.gdlIsActive = saveGodownDto.gdl_is_active;
    }

    if (
      this.hasOwnProperty(saveGodownDto, 'gdl_remarks') &&
      saveGodownDto.gdl_remarks !== undefined
    ) {
      data.gdlRemarks = saveGodownDto.gdl_remarks;
    }
  }

  private toPayload(record: GodownLocation): GodownPayload {
    return {
      gdl_id: record.gdlId,
      gdl_godown_id: record.gdlGodownId,
      gdl_branch_id: record.gdlBranchId,
      gdl_name: record.gdlName,
      gdl_short: record.gdlShort,
      gdl_code: record.gdlCode,
      gdl_type: record.gdlType,
      gdl_parent_id: record.gdlParentId,
      gdl_sort: record.gdlSort,
      gdl_level: record.gdlLevel,
      gdl_path_ids_cache: record.gdlPathIdsCache,
      gdl_del_sheet: record.gdlDelSheet,
      gdl_split_stock: record.gdlSplitStock,
      gdl_negative_stock: record.gdlNegativeStock,
      gdl_volume: this.toNumber(record.gdlVolume),
      gdl_is_active: record.gdlIsActive,
      gdl_is_deleted: record.gdlIsDeleted,
      gdl_created_on: record.gdlCreatedOn.toISOString(),
      gdl_created_by: record.gdlCreatedBy,
      gdl_modified_on: record.gdlModifiedOn.toISOString(),
      gdl_modified_by: record.gdlModifiedBy,
      gdl_remarks: record.gdlRemarks,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Godown location already exists', [
          {
            field: 'gdl_name',
            message: 'Duplicate gdl_name under the same parent is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'gdl_parent_id',
          message: 'Invalid gdl_parent_id reference',
        },
      ]);
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2003';
  }

  private throwNotFound(gdlId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Godown location not found', [
        {
          field: 'gdl_id',
          message: `No active godown location found with id ${gdlId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: GodownErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: GodownErrorDetail[] = [],
  ): GodownErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
