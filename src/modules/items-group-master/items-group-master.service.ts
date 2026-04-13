import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { ItemGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
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
const ITEM_GROUP_TABLE_NAME = 'item group master';
const ITEM_GROUP_AUDIT_SCREEN_NAME = 'Item Group Master';
const MIN_CONFIDENT_COLUMN_MATCH_SCORE = 2;
type ItemGroupWriteClient = Prisma.TransactionClient | PrismaService;
type SearchColumnDescriptor = {
  normalized: string;
  tokens: string[];
  lastToken: string;
};
@Injectable()
export class ItemsGroupMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveItemGroupDto: SaveItemGroupDto): Promise<ItemGroupPayload> {
    if (saveItemGroupDto.itg_id) {
      return this.updateItemGroup(saveItemGroupDto);
    }
    return this.createItemGroup(saveItemGroupDto);
  }
  async list(
    queryDto: ListItemGroupQueryDto,
  ): Promise<ConfiguredGridListResult<ItemGroupListItem, ItemGroupListMeta>> {
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
  ): Promise<ConfiguredGridListResult<ItemGroupListItem, ItemGroupListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ITEM_GROUP_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ITEM_GROUP_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: ITEM_GROUP_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      const baseSql = validation.normalizedSql;
      const searchableFieldNames = queryDto.search?.trim()
        ? await this.getConfiguredSearchableFieldNames(configuredGrid.gridId, baseSql)
        : [];
      const { sql: filteredSql, params } = this.buildConfiguredGridListSql(
        baseSql,
        queryDto,
        searchableFieldNames,
      );

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<ItemGroupListItem>({
          baseSql: filteredSql,
          alias: 'item_group_grid',
          params,
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });
        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
          styles: result.styles,
        };
      } catch {
        continue;
      }
    }

    return null;
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
        gridColumnNumber: true,
      },
    });
    const normalizedSqlFields = sqlFieldNames.map((fieldName) => ({
      fieldName,
      descriptor: this.describeSearchColumnName(fieldName),
    }));
    const usedSqlFieldIndexes = new Set<number>();
    const matchedFieldNames: string[] = [];
    for (const column of configuredColumns) {
      const columnName = column.gridColumnName.trim();
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
        const sqlFieldIndexFromColumnNumber = column.gridColumnNumber - 1;
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
        matchedFieldNames.push(normalizedSqlFields[matchedSqlFieldIndex].fieldName);
      }
    }
    return matchedFieldNames;
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
  private parseSqlIdentifierToken(token: string): string | null {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }
    if (/^"([^"]|"")+"$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    if (/^[a-z_][a-z0-9_$]*$/i.test(trimmed)) {
      // PostgreSQL folds unquoted identifiers to lowercase.
      return trimmed.toLowerCase();
    }
    return null;
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
      });
      if (!existing) {
        this.throwNotFound(itgId);
      }
      const subtreeIds = await this.getActiveSubtreeIds(tx, itgId);
      const ancestorIds = await this.getAncestorIds(tx, existing.itgParentId);
      const modifiedOn = new Date();
      const result = await tx.itemGroupMaster.updateMany({
        where: {
          itgId,
          itgIsDeleted: false,
        },
        data: {
          itgIsDeleted: true,
          itgModifiedOn: modifiedOn,
          itgModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(itgId);
      }
      await this.removePathIds(tx, ancestorIds, subtreeIds);
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        itgIsDeleted: true,
        itgModifiedOn: modifiedOn,
        itgModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ITEM_GROUP_TABLE_NAME,
          screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: itgId,
          displayName: existing.itgName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Item group soft deleted',
        },
        tx,
      );
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
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              itgPathIdsCache: this.mergePathIds(created.itgPathIdsCache, [created.itgId]),
            })
          : this.toPayload(refreshed);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_GROUP_TABLE_NAME,
            screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.itg_id,
            displayName: payload.itg_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Item group created',
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
        const nextParentId = hasParentField
          ? (saveItemGroupDto.itg_parent_id ?? null)
          : existing.itgParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.itgParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, itgId) : [];
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.itgParentId)
          : [];
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
        const payload = this.toPayload(refreshed ?? updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_GROUP_TABLE_NAME,
            screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: itgId,
            displayName: payload.itg_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Item group updated',
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
