import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { AccLedgerMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListAccountLedgerMasterQueryDto } from './dto/list-account-ledger-master-query.dto';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import {
  AccountLedgerMasterErrorDetail,
  AccountLedgerMasterErrorResponse,
  AccountLedgerMasterListItem,
  AccountLedgerMasterListMeta,
  AccountLedgerMasterPayload,
} from './types/account-ledger-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ACCOUNT_LEDGER_MASTER_TABLE_NAME = 'acc_ledger_master';
const ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME = 'Account Ledger Master';
const MIN_CONFIDENT_COLUMN_MATCH_SCORE = 2;

type AccountLedgerWriteClient = Prisma.TransactionClient | PrismaService;

type SearchColumnDescriptor = {
  normalized: string;
  tokens: string[];
  lastToken: string;
};

@Injectable()
export class AccountLedgerMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    if (saveAccountLedgerMasterDto.ledId) {
      return this.updateLedger(saveAccountLedgerMasterDto);
    }
    return this.createLedger(saveAccountLedgerMasterDto);
  }
  async list(
    queryDto: ListAccountLedgerMasterQueryDto,
  ): Promise<ConfiguredGridListResult<AccountLedgerMasterListItem, AccountLedgerMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const configuredList = await this.listFromConfiguredGridSql(queryDto, page, limit, skip);
    if (configuredList) {
      return configuredList;
    }
    const where: Prisma.AccLedgerMasterWhereInput = {
      ledIsDeleted: false,
    };
    if (queryDto.ledCompanyId !== undefined) {
      where.ledCompanyId = queryDto.ledCompanyId;
    }
    if (queryDto.ledGroupId !== undefined) {
      where.ledGroupId = queryDto.ledGroupId;
    }
    if (queryDto.ledCategory?.trim()) {
      where.ledCategory = queryDto.ledCategory.trim();
    }
    if (queryDto.ledIsActive !== undefined) {
      where.ledIsActive = queryDto.ledIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ledName: { contains: search, mode: 'insensitive' } },
        { ledAlias: { contains: search, mode: 'insensitive' } },
        { ledShort: { contains: search, mode: 'insensitive' } },
        { ledTallyName: { contains: search, mode: 'insensitive' } },
        { ledTallyGroupName: { contains: search, mode: 'insensitive' } },
        { ledContactPerson: { contains: search, mode: 'insensitive' } },
        { ledEmail: { contains: search, mode: 'insensitive' } },
        { ledCity: { contains: search, mode: 'insensitive' } },
        { ledDistrict: { contains: search, mode: 'insensitive' } },
        { ledStateName: { contains: search, mode: 'insensitive' } },
        { ledGstinNo: { contains: search, mode: 'insensitive' } },
        { ledPanNo: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.accLedgerMaster.count({ where }),
      this.prisma.accLedgerMaster.findMany({
        where,
        orderBy: [{ ledName: 'asc' }, { ledId: 'asc' }],
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
    queryDto: ListAccountLedgerMasterQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<
    ConfiguredGridListResult<AccountLedgerMasterListItem, AccountLedgerMasterListMeta> | null
  > {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      ACCOUNT_LEDGER_MASTER_TABLE_NAME,
    );
    const configuredGrid = primaryConfiguredGrids[0];
    if (!configuredGrid) {
      return null;
    }
    const rawGridSql = configuredGrid.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }
    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: rawGridSql,
      tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for account ledger list', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
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
      const result = await this.configuredGridSqlService.runPagedQuery<AccountLedgerMasterListItem>(
        {
          baseSql: filteredSql,
          alias: 'account_ledger_master_grid',
          params,
          limit,
          skip,
        },
      );
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
      this.throwBadRequest('Invalid grid_sql configuration for account ledger list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for acc_ledger_master',
        },
      ]);
    }
  }
  private buildConfiguredGridListSql(
    baseSql: string,
    queryDto: ListAccountLedgerMasterQueryDto,
    searchableFieldNames: string[],
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (queryDto.ledCompanyId !== undefined) {
      params.push(queryDto.ledCompanyId);
      conditions.push(`account_ledger_grid.led_company_id = $${params.length}`);
    }
    if (queryDto.ledGroupId !== undefined) {
      params.push(queryDto.ledGroupId);
      conditions.push(`account_ledger_grid.led_group_id = $${params.length}`);
    }
    if (queryDto.ledCategory?.trim()) {
      params.push(queryDto.ledCategory.trim());
      conditions.push(`account_ledger_grid.led_category = $${params.length}`);
    }
    if (queryDto.ledIsActive !== undefined) {
      params.push(queryDto.ledIsActive);
      conditions.push(`account_ledger_grid.led_is_active = $${params.length}`);
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
              `SELECT 1 FROM jsonb_each_text(row_to_json(account_ledger_grid)::jsonb) AS grid_kv(key, value) ` +
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
      sql: `SELECT * FROM (${baseSql}) AS account_ledger_grid${whereClause}`,
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
  async getById(ledId: string): Promise<AccountLedgerMasterPayload> {
    const record = await this.prisma.accLedgerMaster.findFirst({
      where: {
        ledId,
        ledIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(ledId);
    }
    return this.toPayload(record);
  }
  async softDelete(ledId: string): Promise<{ ledId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accLedgerMaster.findFirst({
        where: {
          ledId,
          ledIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(ledId);
      }
      const modifiedOn = new Date();
      const result = await tx.accLedgerMaster.updateMany({
        where: {
          ledId,
          ledIsDeleted: false,
        },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: modifiedOn,
          ledModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(ledId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ledIsDeleted: true,
        ledIsActive: false,
        ledModifiedOn: modifiedOn,
        ledModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
          screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ledId,
          displayName: existing.ledName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Account ledger soft deleted',
        },
        tx,
      );

      return {
        ledId,
        deleted: true,
      };
    });
  }

  private async createLedger(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = this.normalizeRequiredName(saveAccountLedgerMasterDto.ledName);

        await this.ensureGroupExists(saveAccountLedgerMasterDto.ledGroupId, tx);

        const companyId = saveAccountLedgerMasterDto.ledCompanyId?.trim();
        if (!companyId) {
          this.throwBadRequest('Validation failed', [
            {
              field: 'ledCompanyId',
              message: 'ledCompanyId is required',
            },
          ]);
        }

        const branchId = saveAccountLedgerMasterDto.ledBranchId;
        const groupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);

        const now = new Date();
        const createdBy = DEFAULT_ACTOR;

        const data: Prisma.AccLedgerMasterUncheckedCreateInput = {
          ledCompanyId: companyId,
          ledBranchId: branchId,
          ledGroupId: groupId,
          ledName: normalizedName,
          ledCreatedOn: now,
          ledCreatedBy: createdBy,
          ledModifiedOn: now,
          ledModifiedBy: createdBy,
        };

        this.applyOptionalFields(data, saveAccountLedgerMasterDto);

        const created = await tx.accLedgerMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
            screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ledId,
            displayName: payload.ledName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Account ledger created',
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

  private async updateLedger(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    const ledId = saveAccountLedgerMasterDto.ledId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accLedgerMaster.findFirst({
          where: {
            ledId,
            ledIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(ledId);
        }

        const normalizedName = this.normalizeRequiredName(saveAccountLedgerMasterDto.ledName);

        const nextGroupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureGroupExists(nextGroupId, tx);

        const nextCompanyId = this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')
          ? saveAccountLedgerMasterDto.ledCompanyId?.trim()
          : existing.ledCompanyId;
        if (!nextCompanyId) {
          this.throwBadRequest('Validation failed', [
            {
              field: 'ledCompanyId',
              message: 'ledCompanyId is required',
            },
          ]);
        }

        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, ledId);

        const data: Prisma.AccLedgerMasterUncheckedUpdateInput = {
          ledBranchId: saveAccountLedgerMasterDto.ledBranchId,
          ledGroupId: nextGroupId,
          ledName: normalizedName,
          ledModifiedOn: new Date(),
          ledModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveAccountLedgerMasterDto);

        const updated = await tx.accLedgerMaster.update({
          where: {
            ledId,
          },
          data,
        });

        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
            screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ledId,
            displayName: payload.ledName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Account ledger updated',
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

  private async ensureGroupExists(groupId: string, tx: AccountLedgerWriteClient): Promise<void> {
    const group = await tx.accountGroup.findFirst({
      where: {
        accGroupId: groupId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
      },
    });

    if (!group) {
      this.throwBadRequest('Account group does not exist', [
        {
          field: 'ledGroupId',
          message: `No active account group found with id ${groupId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: AccountLedgerWriteClient,
    ledgerName: string,
    companyId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.accLedgerMaster.findFirst({
      where: {
        ledIsDeleted: false,
        ledCompanyId: companyId,
        ledName: {
          equals: ledgerName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              ledId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        ledId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Account ledger name already exists for this company', [
          {
            field: 'ledName',
            message: 'Duplicate ledName is not allowed for this company',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.AccLedgerMasterUncheckedCreateInput | Prisma.AccLedgerMasterUncheckedUpdateInput,
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): void {
    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')) {
      data.ledCompanyId = saveAccountLedgerMasterDto.ledCompanyId;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBranchId')) {
      data.ledBranchId = saveAccountLedgerMasterDto.ledBranchId;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAlias')) {
      data.ledAlias = saveAccountLedgerMasterDto.ledAlias;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledShort')) {
      data.ledShort = saveAccountLedgerMasterDto.ledShort;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyName')) {
      data.ledTallyName = saveAccountLedgerMasterDto.ledTallyName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyGroupName')) {
      data.ledTallyGroupName = saveAccountLedgerMasterDto.ledTallyGroupName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyGuid')) {
      data.ledTallyGuid = saveAccountLedgerMasterDto.ledTallyGuid;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCategory')) {
      data.ledCategory = saveAccountLedgerMasterDto.ledCategory;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsBillByBill')) {
      data.ledIsBillByBill = saveAccountLedgerMasterDto.ledIsBillByBill;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsCostCenterReq')) {
      data.ledIsCostCenterReq = saveAccountLedgerMasterDto.ledIsCostCenterReq;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsInterestApplicable')) {
      data.ledIsInterestApplicable = saveAccountLedgerMasterDto.ledIsInterestApplicable;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledInterestRate')) {
      data.ledInterestRate = saveAccountLedgerMasterDto.ledInterestRate;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledContactPerson')) {
      data.ledContactPerson = saveAccountLedgerMasterDto.ledContactPerson;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledEmail')) {
      data.ledEmail = saveAccountLedgerMasterDto.ledEmail;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTel')) {
      data.ledTel = saveAccountLedgerMasterDto.ledTel;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPhone1')) {
      data.ledPhone1 = saveAccountLedgerMasterDto.ledPhone1;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPhone2')) {
      data.ledPhone2 = saveAccountLedgerMasterDto.ledPhone2;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledWhatsappNo')) {
      data.ledWhatsappNo = saveAccountLedgerMasterDto.ledWhatsappNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr1')) {
      data.ledAddr1 = saveAccountLedgerMasterDto.ledAddr1;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr2')) {
      data.ledAddr2 = saveAccountLedgerMasterDto.ledAddr2;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr3')) {
      data.ledAddr3 = saveAccountLedgerMasterDto.ledAddr3;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCity')) {
      data.ledCity = saveAccountLedgerMasterDto.ledCity;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledDistrict')) {
      data.ledDistrict = saveAccountLedgerMasterDto.ledDistrict;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledStateName')) {
      data.ledStateName = saveAccountLedgerMasterDto.ledStateName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledStateCode')) {
      data.ledStateCode = saveAccountLedgerMasterDto.ledStateCode;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPin')) {
      data.ledPin = saveAccountLedgerMasterDto.ledPin;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCountry')) {
      data.ledCountry = saveAccountLedgerMasterDto.ledCountry;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionName')) {
      data.ledRegionName = saveAccountLedgerMasterDto.ledRegionName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr1')) {
      data.ledRegionAddr1 = saveAccountLedgerMasterDto.ledRegionAddr1;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr2')) {
      data.ledRegionAddr2 = saveAccountLedgerMasterDto.ledRegionAddr2;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr3')) {
      data.ledRegionAddr3 = saveAccountLedgerMasterDto.ledRegionAddr3;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionCity')) {
      data.ledRegionCity = saveAccountLedgerMasterDto.ledRegionCity;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionDistrict')) {
      data.ledRegionDistrict = saveAccountLedgerMasterDto.ledRegionDistrict;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionStateName')) {
      data.ledRegionStateName = saveAccountLedgerMasterDto.ledRegionStateName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionCountry')) {
      data.ledRegionCountry = saveAccountLedgerMasterDto.ledRegionCountry;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstPartyRegType')) {
      data.ledGstPartyRegType = saveAccountLedgerMasterDto.ledGstPartyRegType;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstinNo')) {
      data.ledGstinNo = saveAccountLedgerMasterDto.ledGstinNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPanNo')) {
      data.ledPanNo = saveAccountLedgerMasterDto.ledPanNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAadharNo')) {
      data.ledAadharNo = saveAccountLedgerMasterDto.ledAadharNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledEcommerceGstin')) {
      data.ledEcommerceGstin = saveAccountLedgerMasterDto.ledEcommerceGstin;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsSez')) {
      data.ledIsSez = saveAccountLedgerMasterDto.ledIsSez;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledChequeName')) {
      data.ledHolderName = saveAccountLedgerMasterDto.ledChequeName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankName')) {
      data.ledBankName = saveAccountLedgerMasterDto.ledBankName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankBranch')) {
      data.ledBankBranch = saveAccountLedgerMasterDto.ledBankBranch;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankAcNo')) {
      data.ledBankAcNo = saveAccountLedgerMasterDto.ledBankAcNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankIfsc')) {
      data.ledBankIfsc = saveAccountLedgerMasterDto.ledBankIfsc;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledUpiId')) {
      data.ledUpiId = saveAccountLedgerMasterDto.ledUpiId;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledObAmount')) {
      data.ledObAmount = saveAccountLedgerMasterDto.ledObAmount;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledObType')) {
      data.ledObType = saveAccountLedgerMasterDto.ledObType;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledObAsOn')) {
      data.ledObAsOn = saveAccountLedgerMasterDto.ledObAsOn;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTotalDr')) {
      data.ledTotalDr = saveAccountLedgerMasterDto.ledTotalDr;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTotalCr')) {
      data.ledTotalCr = saveAccountLedgerMasterDto.ledTotalCr;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTotalBalance')) {
      data.ledTotalBalance = saveAccountLedgerMasterDto.ledTotalBalance;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsActive')) {
      data.ledIsActive = saveAccountLedgerMasterDto.ledIsActive;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAllowEdit')) {
      data.ledAllowEdit = saveAccountLedgerMasterDto.ledAllowEdit;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsEntry')) {
      data.ledIsEntry = saveAccountLedgerMasterDto.ledIsEntry;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAllowSms')) {
      data.ledAllowSms = saveAccountLedgerMasterDto.ledAllowSms;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRemarks')) {
      data.ledRemarks = saveAccountLedgerMasterDto.ledRemarks;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ledName',
          message: 'ledName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: AccLedgerMaster): AccountLedgerMasterPayload {
    return {
      ledId: record.ledId,
      ledCompanyId: record.ledCompanyId,
      ledBranchId: record.ledBranchId,
      ledGroupId: record.ledGroupId,
      ledName: record.ledName,
      ledAlias: record.ledAlias,
      ledShort: record.ledShort,
      ledTallyName: record.ledTallyName,
      ledTallyGroupName: record.ledTallyGroupName,
      ledTallyGuid: record.ledTallyGuid,
      ledCategory: record.ledCategory,
      ledIsBillByBill: record.ledIsBillByBill,
      ledIsCostCenterReq: record.ledIsCostCenterReq,
      ledIsInterestApplicable: record.ledIsInterestApplicable,
      ledInterestRate: this.toNullableNumber(record.ledInterestRate),
      ledContactPerson: record.ledContactPerson,
      ledEmail: record.ledEmail,
      ledTel: record.ledTel,
      ledPhone1: record.ledPhone1,
      ledPhone2: record.ledPhone2,
      ledWhatsappNo: record.ledWhatsappNo,
      ledAddr1: record.ledAddr1,
      ledAddr2: record.ledAddr2,
      ledAddr3: record.ledAddr3,
      ledCity: record.ledCity,
      ledDistrict: record.ledDistrict,
      ledStateName: record.ledStateName,
      ledStateCode: record.ledStateCode,
      ledPin: record.ledPin,
      ledCountry: record.ledCountry,
      ledRegionName: record.ledRegionName,
      ledRegionAddr1: record.ledRegionAddr1,
      ledRegionAddr2: record.ledRegionAddr2,
      ledRegionAddr3: record.ledRegionAddr3,
      ledRegionCity: record.ledRegionCity,
      ledRegionDistrict: record.ledRegionDistrict,
      ledRegionStateName: record.ledRegionStateName,
      ledRegionCountry: record.ledRegionCountry,
      ledGstPartyRegType: record.ledGstPartyRegType,
      ledGstinNo: record.ledGstinNo,
      ledPanNo: record.ledPanNo,
      ledAadharNo: record.ledAadharNo,
      ledEcommerceGstin: record.ledEcommerceGstin,
      ledIsSez: record.ledIsSez,
      ledChequeName: record.ledHolderName,
      ledBankName: record.ledBankName,
      ledBankBranch: record.ledBankBranch,
      ledBankAcNo: record.ledBankAcNo,
      ledBankIfsc: record.ledBankIfsc,
      ledUpiId: record.ledUpiId,
      ledObAmount: this.toNumber(record.ledObAmount),
      ledObType: record.ledObType,
      ledObAsOn: record.ledObAsOn ? record.ledObAsOn.toISOString() : null,
      ledTotalDr: this.toNumber(record.ledTotalDr),
      ledTotalCr: this.toNumber(record.ledTotalCr),
      ledTotalBalance: this.toNumber(record.ledTotalBalance),
      ledIsActive: record.ledIsActive,
      ledIsDeleted: record.ledIsDeleted,
      ledAllowEdit: record.ledAllowEdit,
      ledIsEntry: record.ledIsEntry,
      ledAllowSms: record.ledAllowSms,
      ledRemarks: record.ledRemarks,
      ledSyncDate: record.ledSyncDate ? record.ledSyncDate.toISOString() : null,
      ledCreatedOn: record.ledCreatedOn.toISOString(),
      ledCreatedBy: record.ledCreatedBy,
      ledModifiedOn: record.ledModifiedOn.toISOString(),
      ledModifiedBy: record.ledModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return this.toNumber(value);
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Account ledger already exists', [
          {
            field: 'ledName',
            message: 'Duplicate ledName is not allowed',
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

  private throwNotFound(ledId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Account ledger not found', [
        {
          field: 'ledId',
          message: `No active account ledger found with id ${ledId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: AccountLedgerMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: AccountLedgerMasterErrorDetail[] = [],
  ): AccountLedgerMasterErrorResponse {
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
