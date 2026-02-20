import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import {
  ItemGroupErrorDetail,
  ItemGroupErrorResponse,
  ItemGroupListItem,
  ItemGroupListMeta,
  ItemGroupPayload,
} from './types/item-group-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ITEM_GROUP_GRID_ID = BigInt(1);
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;
type ItemGroupWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class ItemsGroupMasterService {
  constructor(private readonly prisma: PrismaService) {}
  async save(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    if (saveItemGroupDto.itg_id) {
      return this.updateItemGroup(saveItemGroupDto);
    }
    return this.createItemGroup(saveItemGroupDto);
  }
  async list(
    queryDto: ListItemGroupQueryDto,
  ): Promise<{ items: ItemGroupListItem[]; meta: ItemGroupListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const configuredList = await this.listFromConfiguredGridSql(queryDto, page, limit, skip);
    if (configuredList) {
      return configuredList;
    }
    const where: Prisma.ItemGroupMasterWhereInput = {
      itgIsDeleted: false,
    };
    if (queryDto.itg_parent_id !== undefined) {
      where.itgParentId = queryDto.itg_parent_id;
    }
    if (queryDto.itg_is_active !== undefined) {
      where.itgIsActive = queryDto.itg_is_active;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { itgName: { contains: search, mode: 'insensitive' } },
        { itgAlias: { contains: search, mode: 'insensitive' } },
        { itgDescription: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.itemGroupMaster.count({ where }),
      this.prisma.itemGroupMaster.findMany({
        where,
        orderBy: [{ itgSort: 'asc' }, { itgName: 'asc' }],
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
    queryDto: ListItemGroupQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ items: ItemGroupListItem[]; meta: ItemGroupListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridId: ITEM_GROUP_GRID_ID,
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
        },
      },
      select: {
        gridSql: true,
      },
    });
    const rawGridSql = configuredGrid?.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }
    const baseSql = this.validateConfiguredGridSql(rawGridSql);
    const searchableFieldNames = queryDto.search?.trim()
      ? await this.getConfiguredSearchableFieldNames(ITEM_GROUP_GRID_ID, baseSql)
      : [];
    const { sql: filteredSql, params } = this.buildConfiguredGridListSql(
      baseSql,
      queryDto,
      searchableFieldNames,
    );
    const countSql = `SELECT COUNT(*)::bigint AS total FROM (${filteredSql}) AS item_group_grid_count`;
    const rowsSql = `SELECT * FROM (${filteredSql}) AS item_group_grid_rows LIMIT $${
      params.length + 1
    } OFFSET $${params.length + 2}`;
    try {
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(
          countSql,
          ...params,
        ),
        this.prisma.$queryRawUnsafe<ItemGroupListItem[]>(rowsSql, ...params, limit, skip),
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
      this.throwBadRequest('Invalid grid_sql configuration for item group list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for item_group_master',
        },
      ]);
    }
  }
  private buildConfiguredGridListSql(
    baseSql: string,
    queryDto: ListItemGroupQueryDto,
    searchableFieldNames: string[],
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (queryDto.itg_parent_id !== undefined) {
      params.push(queryDto.itg_parent_id);
      conditions.push(`item_group_grid.itg_parent_id = $${params.length}`);
    }
    if (queryDto.itg_is_active !== undefined) {
      params.push(queryDto.itg_is_active);
      conditions.push(`item_group_grid.itg_is_active = $${params.length}`);
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
              `SELECT 1 FROM jsonb_each_text(row_to_json(item_group_grid)::jsonb) AS grid_kv(key, value) ` +
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
      sql: `SELECT * FROM (${baseSql}) AS item_group_grid${whereClause}`,
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

    const explicitAliasMatch = trimmed.match(
      /\s+as\s+("([^"]|"")+"|[a-z_][a-z0-9_$]*)\s*$/i,
    );
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
      this.throwBadRequest('Invalid grid_sql configuration for item group list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }
    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for item group list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }
    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item group list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }
    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item group list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }
    if (!/\bitem_group_master\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for item group list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference item_group_master table',
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
  async getById(itgId: string): Promise<ItemGroupPayload> {
    const record = await this.prisma.itemGroupMaster.findFirst({
      where: {
        itgId,
        itgIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(itgId);
    }
    return this.toPayload(record);
  }
  async softDelete(itgId: string): Promise<{ itg_id: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.itemGroupMaster.findFirst({
        where: {
          itgId,
          itgIsDeleted: false,
        },
        select: {
          itgParentId: true,
        },
      });
      if (!existing) {
        this.throwNotFound(itgId);
      }

      const subtreeIds = await this.getActiveSubtreeIds(tx, itgId);
      const ancestorIds = await this.getAncestorIds(tx, existing.itgParentId);
      const result = await tx.itemGroupMaster.updateMany({
        where: {
          itgId,
          itgIsDeleted: false,
        },
        data: {
          itgIsDeleted: true,
          itgModifiedOn: new Date(),
          itgModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(itgId);
      }

      await this.removePathIds(tx, ancestorIds, subtreeIds);
      return {
        itg_id: itgId,
        deleted: true,
      };
    });
  }
  private async createItemGroup(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (saveItemGroupDto.itg_parent_id) {
          await this.ensureParentExists(saveItemGroupDto.itg_parent_id, tx);
        }
        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data: Prisma.ItemGroupMasterUncheckedCreateInput = {
          itgName: saveItemGroupDto.itg_name.trim(),
          itgCreatedOn: now,
          itgCreatedBy: createdBy,
          itgModifiedOn: now,
          itgModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        const created = await tx.itemGroupMaster.create({ data });
        await this.ensureSelfInPath(tx, created.itgId);

        if (saveItemGroupDto.itg_parent_id) {
          const ancestorIds = await this.getAncestorIds(tx, saveItemGroupDto.itg_parent_id);
          await this.appendPathIds(tx, ancestorIds, [created.itgId]);
        }

        const refreshed = await tx.itemGroupMaster.findFirst({
          where: {
            itgId: created.itgId,
            itgIsDeleted: false,
          },
        });
        if (!refreshed) {
          return this.toPayload({
            ...created,
            itgPathIdsCache: this.mergePathIds(created.itgPathIdsCache, [created.itgId]),
          });
        }
        return this.toPayload(refreshed);
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async updateItemGroup(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    const itgId = saveItemGroupDto.itg_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemGroupMaster.findFirst({
          where: {
            itgId,
            itgIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(itgId);
        }
        if (saveItemGroupDto.itg_parent_id === itgId) {
          this.throwBadRequest('Item group cannot be its own parent', [
            {
              field: 'itg_parent_id',
              message: 'itg_parent_id cannot be same as itg_id',
            },
          ]);
        }
        if (saveItemGroupDto.itg_parent_id) {
          await this.ensureParentExists(saveItemGroupDto.itg_parent_id, tx);
        }

        const hasParentField = this.hasOwnProperty(saveItemGroupDto, 'itg_parent_id');
        const nextParentId = hasParentField ? (saveItemGroupDto.itg_parent_id ?? null) : existing.itgParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.itgParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, itgId) : [];
        const oldAncestorIds = isParentChanged ? await this.getAncestorIds(tx, existing.itgParentId) : [];

        const data: Prisma.ItemGroupMasterUncheckedUpdateInput = {
          itgName: saveItemGroupDto.itg_name.trim(),
          itgModifiedOn: new Date(),
          itgModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        const updated = await tx.itemGroupMaster.update({
          where: {
            itgId,
          },
          data,
        });

        await this.ensureSelfInPath(tx, itgId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removePathIds(tx, oldAncestorIds, subtreeIds);
          await this.appendPathIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await tx.itemGroupMaster.findFirst({
          where: {
            itgId,
            itgIsDeleted: false,
          },
        });
        return this.toPayload(refreshed ?? updated);
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async ensureParentExists(parentId: string, tx: ItemGroupWriteClient): Promise<void> {
    const parent = await tx.itemGroupMaster.findFirst({
      where: {
        itgId: parentId,
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
      },
    });
    if (!parent) {
      this.throwBadRequest('Parent item group does not exist', [
        {
          field: 'itg_parent_id',
          message: `No active item group found with id ${parentId}`,
        },
      ]);
    }
  }
  private applyOptionalFields(
    data: Prisma.ItemGroupMasterUncheckedCreateInput | Prisma.ItemGroupMasterUncheckedUpdateInput,
    saveItemGroupDto: SaveItemGroupDto,
  ): void {
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_alias')) {
      data.itgAlias = saveItemGroupDto.itg_alias;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_short')) {
      data.itgShort = saveItemGroupDto.itg_short;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_description')) {
      data.itgDescription = saveItemGroupDto.itg_description;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_parent_id')) {
      data.itgParentId = saveItemGroupDto.itg_parent_id;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_sort')) {
      data.itgSort = saveItemGroupDto.itg_sort;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_level')) {
      data.itgLevel = saveItemGroupDto.itg_level;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_tax_claim')) {
      data.itgTaxClaim = saveItemGroupDto.itg_tax_claim;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_tax_id')) {
      data.itgDefaultTaxId = saveItemGroupDto.itg_default_tax_id;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_hsn')) {
      data.itgDefaultHsn = saveItemGroupDto.itg_default_hsn;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_uom_id')) {
      data.itgDefaultUomId = saveItemGroupDto.itg_default_uom_id;
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_photo')) {
      data.itgPhoto = this.decodePhotoInput(saveItemGroupDto.itg_photo);
    }
    if (this.hasOwnProperty(saveItemGroupDto, 'itg_photo_url')) {
      data.itgPhotoUrl = saveItemGroupDto.itg_photo_url;
    }
  }
  private async getAncestorIds(
    tx: ItemGroupWriteClient,
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

      const parent = await tx.itemGroupMaster.findFirst({
        where: {
          itgId: currentParentId,
          itgIsDeleted: false,
        },
        select: {
          itgId: true,
          itgParentId: true,
        },
      });
      if (!parent) {
        break;
      }

      ancestorIds.push(parent.itgId);
      currentParentId = parent.itgParentId;
    }

    return ancestorIds;
  }
  private async getActiveSubtreeIds(tx: ItemGroupWriteClient, rootId: string): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = await tx.itemGroupMaster.findFirst({
        where: {
          itgId: currentId,
          itgIsDeleted: false,
        },
        select: {
          itgId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.itgId);

      const children = await tx.itemGroupMaster.findMany({
        where: {
          itgParentId: node.itgId,
          itgIsDeleted: false,
        },
        select: {
          itgId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.itgId)) {
          queue.push(child.itgId);
        }
      }
    }

    return subtreeIds;
  }
  private async appendPathIds(
    tx: ItemGroupWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.itemGroupMaster.findMany({
      where: {
        itgId: {
          in: normalizedTargetIds,
        },
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
        itgPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.mergePathIds(record.itgPathIdsCache, normalizedIdsToAdd);
      if (this.areSameIds(record.itgPathIdsCache, nextPathIds)) {
        continue;
      }
      await tx.itemGroupMaster.update({
        where: {
          itgId: record.itgId,
        },
        data: {
          itgPathIdsCache: nextPathIds,
        },
      });
    }
  }
  private async removePathIds(
    tx: ItemGroupWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.itemGroupMaster.findMany({
      where: {
        itgId: {
          in: normalizedTargetIds,
        },
        itgIsDeleted: false,
      },
      select: {
        itgId: true,
        itgPathIdsCache: true,
      },
    });

    for (const record of records) {
      const nextPathIds = this.excludePathIds(record.itgPathIdsCache, normalizedIdsToRemove);
      if (this.areSameIds(record.itgPathIdsCache, nextPathIds)) {
        continue;
      }
      await tx.itemGroupMaster.update({
        where: {
          itgId: record.itgId,
        },
        data: {
          itgPathIdsCache: nextPathIds,
        },
      });
    }
  }
  private async ensureSelfInPath(tx: ItemGroupWriteClient, itgId: string): Promise<void> {
    await this.appendPathIds(tx, [itgId], [itgId]);
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
  private decodePhotoInput(
    photo: string | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (photo === undefined) {
      return undefined;
    }
    if (photo === null) {
      return null;
    }
    const trimmed = photo.trim();
    if (!trimmed) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'itg_photo',
          message: 'itg_photo must be a non-empty base64 string',
        },
      ]);
    }
    const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    const normalized = candidate.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      this.throwBadRequest('Invalid base64 image provided', [
        {
          field: 'itg_photo',
          message: 'itg_photo must be valid base64 content',
        },
      ]);
    }
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }
  private toPayload(record: ItemGroupMaster): ItemGroupPayload {
    return {
      itg_id: record.itgId,
      itg_name: record.itgName,
      itg_alias: record.itgAlias,
      itg_short: record.itgShort,
      itg_description: record.itgDescription,
      itg_parent_id: record.itgParentId,
      itg_sort: record.itgSort,
      itg_level: record.itgLevel,
      itg_path_ids_cache: record.itgPathIdsCache,
      itg_tax_claim: record.itgTaxClaim,
      itg_default_tax_id: record.itgDefaultTaxId,
      itg_default_hsn: record.itgDefaultHsn,
      itg_default_uom_id: record.itgDefaultUomId,
      itg_photo: record.itgPhoto ? Buffer.from(record.itgPhoto).toString('base64') : null,
      itg_photo_url: record.itgPhotoUrl,
      itg_sync_date: record.itgSyncDate ? record.itgSyncDate.toISOString() : null,
      itg_is_active: record.itgIsActive,
      itg_is_deleted: record.itgIsDeleted,
      itg_created_on: record.itgCreatedOn.toISOString(),
      itg_created_by: record.itgCreatedBy,
      itg_modified_on: record.itgModifiedOn.toISOString(),
      itg_modified_by: record.itgModifiedBy,
    };
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item group name already exists', [
          {
            field: 'itg_name',
            message: 'Duplicate itg_name is not allowed',
          },
        ]),
      );
    }
  }
  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2002';
  }
  private throwNotFound(itgId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item group not found', [
        {
          field: 'itg_id',
          message: `No active item group found with id ${itgId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: ItemGroupErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: ItemGroupErrorDetail[] = [],
  ): ItemGroupErrorResponse {
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
