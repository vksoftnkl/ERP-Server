import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { AccountGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListAccountGroupQueryDto } from './dto/list-account-group-query.dto';
import { SaveAccountGroupDto } from './dto/save-account-group.dto';
import {
  AccountGroupErrorDetail,
  AccountGroupListItem,
  AccountGroupListMeta,
  AccountGroupPayload,
} from './types/account-group-api.types';
import {
  DEFAULT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  hasOwnProperty,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
const ACCOUNT_GROUP_TABLE_NAME = 'account groups';
const ACCOUNT_GROUP_AUDIT_SCREEN_NAME = 'Account Group Master';
const MIN_CONFIDENT_COLUMN_MATCH_SCORE = 2;
type AccountGroupWriteClient = AccountsWriteClient;
type SearchColumnDescriptor = {
  normalized: string;
  tokens: string[];
  lastToken: string;
};
type AccountGroupParentRecord = {
  accGroupId: string;
  accGroupCompanyId: string | null;
};
@Injectable()
export class AccountsGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveAccountGroupDto: SaveAccountGroupDto): Promise<AccountGroupPayload> {
    if (saveAccountGroupDto.accGroupId) {
      return this.updateAccountGroup(saveAccountGroupDto);
    }
    return this.createAccountGroup(saveAccountGroupDto);
  }
  async list(
    queryDto: ListAccountGroupQueryDto,
  ): Promise<ConfiguredGridListResult<AccountGroupListItem, AccountGroupListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const configuredList = await this.listFromConfiguredGridSql(queryDto, page, limit, skip);
    if (configuredList) {
      return configuredList;
    }
    const where: Prisma.AccountGroupWhereInput = {
      accGroupIsDeleted: false,
    };
    if (queryDto.accGroupCompanyId !== undefined) {
      where.accGroupCompanyId = queryDto.accGroupCompanyId;
    }
    if (queryDto.accGroupParentId !== undefined) {
      where.accGroupParentId = queryDto.accGroupParentId;
    }
    if (queryDto.accGroupIsActive !== undefined) {
      where.accGroupIsActive = queryDto.accGroupIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { accGroupName: { contains: search, mode: 'insensitive' } },
        { accGroupAlias: { contains: search, mode: 'insensitive' } },
        { accGroupShort: { contains: search, mode: 'insensitive' } },
        { accGroupDescription: { contains: search, mode: 'insensitive' } },
        { accGroupTallyName: { contains: search, mode: 'insensitive' } },
        { accGroupPrimaryName: { contains: search, mode: 'insensitive' } },
        { accGroupNature: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records, styles] = await Promise.all([
      this.prisma.accountGroup.count({ where }),
      this.prisma.accountGroup.findMany({
        where,
        orderBy: [{ accGroupSort: 'asc' }, { accGroupName: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(ACCOUNT_GROUP_TABLE_NAME),
    ]);
    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      ...(styles !== undefined && { styles }),
    };
  }
  private async listFromConfiguredGridSql(
    queryDto: ListAccountGroupQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<AccountGroupListItem, AccountGroupListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ACCOUNT_GROUP_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ACCOUNT_GROUP_TABLE_NAME,
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
        tableName: ACCOUNT_GROUP_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const baseSql = validation.normalizedSql;
        const searchableFieldNames = queryDto.search?.trim()
          ? await this.getConfiguredSearchableFieldNames(configuredGrid.gridId, baseSql)
          : [];
        const { sql: filteredSql, params } = this.buildConfiguredGridListSql(
          baseSql,
          queryDto,
          searchableFieldNames,
        );
        const result = await this.configuredGridSqlService.runPagedQuery<AccountGroupListItem>({
          baseSql: filteredSql,
          alias: 'account_group_grid',
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
    queryDto: ListAccountGroupQueryDto,
    searchableFieldNames: string[],
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (queryDto.accGroupCompanyId !== undefined) {
      params.push(queryDto.accGroupCompanyId);
      conditions.push(`account_group_grid.acc_group_company_id = $${params.length}`);
    }
    if (queryDto.accGroupParentId !== undefined) {
      params.push(queryDto.accGroupParentId);
      conditions.push(`account_group_grid.acc_group_parent_id = $${params.length}`);
    }
    if (queryDto.accGroupIsActive !== undefined) {
      params.push(queryDto.accGroupIsActive);
      conditions.push(`account_group_grid.acc_group_is_active = $${params.length}`);
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
              `SELECT 1 FROM jsonb_each_text(row_to_json(account_group_grid)::jsonb) AS grid_kv(key, value) ` +
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
      sql: `SELECT * FROM (${baseSql}) AS account_group_grid${whereClause}`,
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
  async getById(accGroupId: string): Promise<AccountGroupPayload> {
    const record = await this.prisma.accountGroup.findFirst({
      where: {
        accGroupId,
        accGroupIsDeleted: false,
      },
    });
    if (!record) {
      throwAccountsNotFound<AccountGroupErrorDetail>('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
    }
    return this.toPayload(record);
  }
  async softDelete(accGroupId: string): Promise<{ accGroupId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accountGroup.findFirst({
        where: {
          accGroupId,
          accGroupIsDeleted: false,
        },
      });
      if (!existing) {
        throwAccountsNotFound<AccountGroupErrorDetail>('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
      }
      const hasChildren = await tx.accountGroup.count({
        where: {
          accGroupParentId: accGroupId,
          accGroupIsDeleted: false,
        },
      });
      if (hasChildren > 0) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Cannot delete account group with active children', [
          {
            field: 'accGroupId',
            message: `Account group ${accGroupId} has child groups. Reassign or delete them first.`,
          },
        ]);
      }
      const ledgerCount = await tx.accLedgerMaster.count({
        where: {
          ledGroupId: accGroupId,
          ledIsDeleted: false,
        },
      });
      if (ledgerCount > 0) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Cannot delete account group with active ledgers', [
          {
            field: 'accGroupId',
            message: `Account group ${accGroupId} is used by ${ledgerCount} ledger(s).`,
          },
        ]);
      }
      const ancestorIds = await this.getAncestorIds(tx, existing.accGroupParentId);
      const modifiedOn = new Date();
      const result = await tx.accountGroup.updateMany({
        where: {
          accGroupId,
          accGroupIsDeleted: false,
        },
        data: {
          accGroupIsDeleted: true,
          accGroupIsActive: false,
          accGroupModifiedOn: modifiedOn,
          accGroupModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<AccountGroupErrorDetail>('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
      }
      await this.removeChildIds(tx, ancestorIds, [accGroupId]);
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        accGroupIsDeleted: true,
        accGroupIsActive: false,
        accGroupModifiedOn: modifiedOn,
        accGroupModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ACCOUNT_GROUP_TABLE_NAME,
          screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: accGroupId,
          displayName: existing.accGroupName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Account group soft deleted',
        },
        tx,
      );
      return {
        accGroupId,
        deleted: true,
      };
    });
  }
  private async createAccountGroup(
    saveAccountGroupDto: SaveAccountGroupDto,
  ): Promise<AccountGroupPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = normalizeRequiredText<AccountGroupErrorDetail>(saveAccountGroupDto.accGroupName, 'accGroupName');
        const normalizedTypeCode = this.normalizeTypeCode(saveAccountGroupDto.accGroupTypeCode);
        const parent = saveAccountGroupDto.accGroupParentId
          ? await this.ensureParentExists(saveAccountGroupDto.accGroupParentId, tx)
          : null;
        const requestedCompanyId = hasOwnProperty(saveAccountGroupDto, 'accGroupCompanyId')
          ? (saveAccountGroupDto.accGroupCompanyId ?? null)
          : undefined;
        const companyId = await this.resolveCompanyId(
          requestedCompanyId,
          null,
          parent?.accGroupCompanyId ?? null,
          tx,
        );
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const data: Prisma.AccountGroupUncheckedCreateInput = {
          accGroupCompanyId: companyId,
          accGroupName: normalizedName,
          accGroupTypeCode: normalizedTypeCode,
          accGroupChildIds: [],
          accGroupCreatedOn: now,
          accGroupCreatedBy: createdBy,
          accGroupModifiedOn: now,
          accGroupModifiedBy: createdBy,
        };
        this.applyOptionalFields(data, saveAccountGroupDto);
        const created = await tx.accountGroup.create({ data });
        await this.ensureSelfInChildIds(tx, created.accGroupId);
        if (created.accGroupParentId) {
          const ancestorIds = await this.getAncestorIds(tx, created.accGroupParentId);
          await this.appendChildIds(tx, ancestorIds, [created.accGroupId]);
        }
        const refreshed = await tx.accountGroup.findFirst({
          where: {
            accGroupId: created.accGroupId,
            accGroupIsDeleted: false,
          },
        });
        const payload = !refreshed
          ? this.toPayload({
              ...created,
              accGroupChildIds: this.mergeChildIds(created.accGroupChildIds, [
                created.accGroupId,
              ]),
            })
          : this.toPayload(refreshed);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ACCOUNT_GROUP_TABLE_NAME,
            screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.accGroupId,
            displayName: payload.accGroupName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Account group created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountGroupErrorDetail>(error, 'Account group already exists', [{ field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' }]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Invalid reference value provided', [{ field: 'accGroupCompanyId', message: 'Referenced company or parent account group does not exist' }]);
      }
      throw error;
    }
  }
  private async updateAccountGroup(
    saveAccountGroupDto: SaveAccountGroupDto,
  ): Promise<AccountGroupPayload> {
    const accGroupId = saveAccountGroupDto.accGroupId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accountGroup.findFirst({
          where: {
            accGroupId,
            accGroupIsDeleted: false,
          },
        });
        if (!existing) {
          throwAccountsNotFound<AccountGroupErrorDetail>('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
        }
        const normalizedName = normalizeRequiredText<AccountGroupErrorDetail>(saveAccountGroupDto.accGroupName, 'accGroupName');
        const normalizedTypeCode = this.normalizeTypeCode(saveAccountGroupDto.accGroupTypeCode);
        if (saveAccountGroupDto.accGroupParentId === accGroupId) {
          throwAccountsBadRequest<AccountGroupErrorDetail>('Account group cannot be its own parent', [
            {
              field: 'accGroupParentId',
              message: 'accGroupParentId cannot be same as accGroupId',
            },
          ]);
        }
        const hasParentField = hasOwnProperty(saveAccountGroupDto, 'accGroupParentId');
        const nextParentId = hasParentField
          ? (saveAccountGroupDto.accGroupParentId ?? null)
          : existing.accGroupParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.accGroupParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, accGroupId) : [];
        if (isParentChanged && nextParentId && subtreeIds.includes(nextParentId)) {
          throwAccountsBadRequest<AccountGroupErrorDetail>('Circular hierarchy is not allowed', [
            {
              field: 'accGroupParentId',
              message: 'Parent cannot be a child of the same account group',
            },
          ]);
        }
        const parent = nextParentId ? await this.ensureParentExists(nextParentId, tx) : null;
        const requestedCompanyId = hasOwnProperty(saveAccountGroupDto, 'accGroupCompanyId')
          ? (saveAccountGroupDto.accGroupCompanyId ?? null)
          : undefined;
        const nextCompanyId = await this.resolveCompanyId(
          requestedCompanyId,
          existing.accGroupCompanyId,
          parent?.accGroupCompanyId ?? null,
          tx,
        );
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId);
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.accGroupParentId)
          : [];
        const data: Prisma.AccountGroupUncheckedUpdateInput = {
          accGroupCompanyId: nextCompanyId,
          accGroupName: normalizedName,
          accGroupTypeCode: normalizedTypeCode,
          accGroupModifiedOn: new Date(),
          accGroupModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveAccountGroupDto);
        const updated = await tx.accountGroup.update({
          where: {
            accGroupId,
          },
          data,
        });
        await this.ensureSelfInChildIds(tx, accGroupId);
        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removeChildIds(tx, oldAncestorIds, subtreeIds);
          await this.appendChildIds(tx, newAncestorIds, subtreeIds);
        }
        const refreshed = await tx.accountGroup.findFirst({
          where: {
            accGroupId,
            accGroupIsDeleted: false,
          },
        });
        const payload = this.toPayload(refreshed ?? updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ACCOUNT_GROUP_TABLE_NAME,
            screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: accGroupId,
            displayName: payload.accGroupName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Account group updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountGroupErrorDetail>(error, 'Account group already exists', [{ field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' }]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Invalid reference value provided', [{ field: 'accGroupCompanyId', message: 'Referenced company or parent account group does not exist' }]);
      }
      throw error;
    }
  }
  private async ensureParentExists(
    parentId: string,
    tx: AccountGroupWriteClient,
  ): Promise<AccountGroupParentRecord> {
    const parent = await tx.accountGroup.findFirst({
      where: {
        accGroupId: parentId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupCompanyId: true,
      },
    });
    if (!parent) {
      throwAccountsBadRequest<AccountGroupErrorDetail>('Parent account group does not exist', [
        {
          field: 'accGroupParentId',
          message: `No active account group found with id ${parentId}`,
        },
      ]);
    }
    return parent;
  }
  private async ensureCompanyExists(compId: string, tx: AccountGroupWriteClient): Promise<void> {
    const company = await tx.company.findFirst({
      where: {
        compId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });
    if (!company) {
      throwAccountsBadRequest<AccountGroupErrorDetail>('Company does not exist', [
        {
          field: 'accGroupCompanyId',
          message: `No active company found with id ${compId}`,
        },
      ]);
    }
  }
  private async resolveCompanyId(
    requestedCompanyId: string | null | undefined,
    fallbackCompanyId: string | null,
    parentCompanyId: string | null,
    tx: AccountGroupWriteClient,
  ): Promise<string | null> {
    let companyId = requestedCompanyId === undefined ? fallbackCompanyId : requestedCompanyId;
    if (parentCompanyId !== null) {
      if (companyId === null) {
        companyId = parentCompanyId;
      } else if (companyId !== parentCompanyId) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Parent/company mismatch', [
          {
            field: 'accGroupCompanyId',
            message: `accGroupCompanyId ${companyId} must match parent company id ${parentCompanyId}`,
          },
        ]);
      }
    }
    if (companyId !== null) {
      await this.ensureCompanyExists(companyId, tx);
    }
    return companyId;
  }
  private async ensureNameIsUnique(
    tx: AccountGroupWriteClient,
    groupName: string,
    companyId?: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.accountGroup.findFirst({
      where: {
        accGroupIsDeleted: false,
        accGroupCompanyId: companyId,
        accGroupName: {
          equals: groupName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              accGroupId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        accGroupId: true,
      },
    });
    if (existing) {
      throwAccountsConflict<AccountGroupErrorDetail>('Account group name already exists for this company', [
        { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed for this company' },
      ]);
    }
  }
  private applyOptionalFields(
    data: Prisma.AccountGroupUncheckedCreateInput | Prisma.AccountGroupUncheckedUpdateInput,
    saveAccountGroupDto: SaveAccountGroupDto,
  ): void {
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupAlias')) {
      data.accGroupAlias = saveAccountGroupDto.accGroupAlias;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupShort')) {
      data.accGroupShort = saveAccountGroupDto.accGroupShort;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupDescription')) {
      data.accGroupDescription = saveAccountGroupDto.accGroupDescription;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupTallyName')) {
      data.accGroupTallyName = saveAccountGroupDto.accGroupTallyName;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupPrimaryName')) {
      data.accGroupPrimaryName = saveAccountGroupDto.accGroupPrimaryName;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupNature')) {
      data.accGroupNature = saveAccountGroupDto.accGroupNature;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupParentId')) {
      data.accGroupParentId = saveAccountGroupDto.accGroupParentId;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupSort')) {
      data.accGroupSort = saveAccountGroupDto.accGroupSort;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupIsDefault')) {
      data.accGroupIsDefault = saveAccountGroupDto.accGroupIsDefault;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupBehaveAsSubledger')) {
      data.accGroupBehaveAsSubledger = saveAccountGroupDto.accGroupBehaveAsSubledger;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupNetDebitCredit')) {
      data.accGroupNetDebitCredit = saveAccountGroupDto.accGroupNetDebitCredit;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupUsedForCalculation')) {
      data.accGroupUsedForCalculation = saveAccountGroupDto.accGroupUsedForCalculation;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupAffectsGrossProfit')) {
      data.accGroupAffectsGrossProfit = saveAccountGroupDto.accGroupAffectsGrossProfit;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupIsActive')) {
      data.accGroupIsActive = saveAccountGroupDto.accGroupIsActive;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupSyncDate')) {
      data.accGroupSyncDate = saveAccountGroupDto.accGroupSyncDate;
    }
  }
  private async getAncestorIds(
    tx: AccountGroupWriteClient,
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
      const parent = await tx.accountGroup.findFirst({
        where: {
          accGroupId: currentParentId,
          accGroupIsDeleted: false,
        },
        select: {
          accGroupId: true,
          accGroupParentId: true,
        },
      });
      if (!parent) {
        break;
      }
      ancestorIds.push(parent.accGroupId);
      currentParentId = parent.accGroupParentId;
    }
    return ancestorIds;
  }
  private async getActiveSubtreeIds(
    tx: AccountGroupWriteClient,
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
      const node = await tx.accountGroup.findFirst({
        where: {
          accGroupId: currentId,
          accGroupIsDeleted: false,
        },
        select: {
          accGroupId: true,
        },
      });
      if (!node) {
        continue;
      }
      subtreeIds.push(node.accGroupId);
      const children = await tx.accountGroup.findMany({
        where: {
          accGroupParentId: node.accGroupId,
          accGroupIsDeleted: false,
        },
        select: {
          accGroupId: true,
        },
      });
      for (const child of children) {
        if (!visited.has(child.accGroupId)) {
          queue.push(child.accGroupId);
        }
      }
    }
    return subtreeIds;
  }
  private async appendChildIds(
    tx: AccountGroupWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }
    const records = await tx.accountGroup.findMany({
      where: {
        accGroupId: {
          in: normalizedTargetIds,
        },
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupChildIds: true,
      },
    });
    for (const record of records) {
      const nextChildIds = this.mergeChildIds(record.accGroupChildIds, normalizedIdsToAdd);
      if (this.areSameIds(record.accGroupChildIds, nextChildIds)) {
        continue;
      }
      await tx.accountGroup.update({
        where: {
          accGroupId: record.accGroupId,
        },
        data: {
          accGroupChildIds: nextChildIds,
        },
      });
    }
  }
  private async removeChildIds(
    tx: AccountGroupWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }
    const records = await tx.accountGroup.findMany({
      where: {
        accGroupId: {
          in: normalizedTargetIds,
        },
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupChildIds: true,
      },
    });
    for (const record of records) {
      const nextChildIds = this.excludeChildIds(record.accGroupChildIds, normalizedIdsToRemove);
      if (this.areSameIds(record.accGroupChildIds, nextChildIds)) {
        continue;
      }
      await tx.accountGroup.update({
        where: {
          accGroupId: record.accGroupId,
        },
        data: {
          accGroupChildIds: nextChildIds,
        },
      });
    }
  }
  private async ensureSelfInChildIds(
    tx: AccountGroupWriteClient,
    accGroupId: string,
  ): Promise<void> {
    await this.appendChildIds(tx, [accGroupId], [accGroupId]);
  }
  private mergeChildIds(existingIds: readonly string[], idsToAdd: readonly string[]): string[] {
    return this.toUniqueIds([...existingIds, ...idsToAdd]);
  }
  private excludeChildIds(
    existingIds: readonly string[],
    idsToRemove: readonly string[],
  ): string[] {
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
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  }
  private normalizeTypeCode(typeCode: string): string {
    const normalized = typeCode.trim().toUpperCase();
    if (normalized.length !== 2) {
      throwAccountsBadRequest<AccountGroupErrorDetail>('Validation failed', [
        {
          field: 'accGroupTypeCode',
          message: 'accGroupTypeCode must be exactly 2 characters',
        },
      ]);
    }
    return normalized;
  }
  private toPayload(record: AccountGroup): AccountGroupPayload {
    return {
      accGroupId: record.accGroupId,
      accGroupCompanyId: record.accGroupCompanyId,
      accGroupName: record.accGroupName,
      accGroupAlias: record.accGroupAlias,
      accGroupShort: record.accGroupShort,
      accGroupDescription: record.accGroupDescription,
      accGroupTallyName: record.accGroupTallyName,
      accGroupPrimaryName: record.accGroupPrimaryName,
      accGroupNature: record.accGroupNature,
      accGroupParentId: record.accGroupParentId,
      accGroupSort: record.accGroupSort,
      accGroupChildIds: record.accGroupChildIds,
      accGroupTypeCode: record.accGroupTypeCode,
      accGroupIsDefault: record.accGroupIsDefault,
      accGroupBehaveAsSubledger: record.accGroupBehaveAsSubledger,
      accGroupNetDebitCredit: record.accGroupNetDebitCredit,
      accGroupUsedForCalculation: record.accGroupUsedForCalculation,
      accGroupAffectsGrossProfit: record.accGroupAffectsGrossProfit,
      accGroupIsActive: record.accGroupIsActive,
      accGroupIsDeleted: record.accGroupIsDeleted,
      accGroupSyncDate: record.accGroupSyncDate ? record.accGroupSyncDate.toISOString() : null,
      accGroupCreatedOn: record.accGroupCreatedOn.toISOString(),
      accGroupCreatedBy: record.accGroupCreatedBy,
      accGroupModifiedOn: record.accGroupModifiedOn.toISOString(),
      accGroupModifiedBy: record.accGroupModifiedBy,
    };
  }
}
