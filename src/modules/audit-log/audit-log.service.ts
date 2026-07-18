import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditScreenType, Prisma } from '@prisma/client';
import { isIP } from 'node:net';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  AuditAction,
  CaptureScreenSnapshotInput,
  CreateAuditLogInput,
  LogEntityChangeInput,
} from './types/audit-log.types';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogListItem, AuditLogListMeta } from './types/audit-log-api.types';
import { getAuditScreenSql } from './audit-screen-sql.constants';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_PATTERN = /^\d+$/;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DISPLAY_FIELD_PATTERN = /\b(name|title)\b/i;
const AUDIT_LOG_SELECT = {
  logId: true,
  logDate: true,
  logAction: true,
  logScreenId: true,
  logTableName: true,
  logPk: true,
  logDisplayName: true,
  logOriginalRecord: true,
  logModifiedRecord: true,
  logChangedFields: true,
  logNotes: true,
  logUserId: true,
  logBranchId: true,
  auditScreen: { select: { screenName: true } },
} satisfies Prisma.AuditLogSelect;
type AuditWriteClient = Prisma.TransactionClient | PrismaService;
type AuditLogListRecord = Prisma.AuditLogGetPayload<{
  select: typeof AUDIT_LOG_SELECT;
}>;
type AuditFieldDefinition = {
  sourceFieldName: string | null;
  targetFieldName: string;
};
type ResolvedAuditScreen = {
  screenId: number;
  auditFields: AuditFieldDefinition[];
};
type PreparedAuditLogListRecord = {
  record: AuditLogListRecord;
  screenName: string;
  auditFields: AuditFieldDefinition[];
  originalRecord: Prisma.JsonValue | null;
  modifiedRecord: Prisma.JsonValue | null;
  changedFields: Prisma.JsonValue | null;
};
type AuditReferenceLookupType =
  | 'accountGroup'
  | 'area'
  | 'branch'
  | 'category'
  | 'city'
  | 'company'
  | 'customer'
  | 'customerGroup'
  | 'employeeDepartment'
  | 'employeeDesignation'
  | 'godownGroup'
  | 'godownLocation'
  | 'gspProvider'
  | 'item'
  | 'itemBrand'
  | 'itemGroup'
  | 'itemSection'
  | 'itemTax'
  | 'ledger'
  | 'state'
  | 'supplierGroup'
  | 'tenderType'
  | 'unit'
  | 'unitRate';
type AuditReferenceNameLookup = Partial<Record<AuditReferenceLookupType, ReadonlyMap<string, string>>>;
const normalizeAuditFieldLookupToken = (value: string): string =>
  value
    .replace(/["'`]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
const createAuditReferenceTypeMap = (
  entries: readonly (readonly [string, AuditReferenceLookupType])[],
): ReadonlyMap<string, AuditReferenceLookupType> =>
  new Map(
    entries.map(([label, lookupType]) => [normalizeAuditFieldLookupToken(label), lookupType] as const),
  );
const GLOBAL_AUDIT_FIELD_REFERENCE_TYPES = createAuditReferenceTypeMap([
  ['Area ID', 'area'],
  ['Base Unit ID', 'unit'],
  ['Branch ID', 'branch'],
  ['City ID', 'city'],
  ['Company ID', 'company'],
  ['Company IDs', 'company'],
  ['Customer Group ID', 'customerGroup'],
  ['Customer ID', 'customer'],
  ['Default Tax ID', 'itemTax'],
  ['Default UOM ID', 'unit'],
  ['Department ID', 'employeeDepartment'],
  ['Designation ID', 'employeeDesignation'],
  ['GSP Provider ID', 'gspProvider'],
  ['Item ID', 'item'],
  ['Ledger ID', 'ledger'],
  ['State ID', 'state'],
  ['Supplier Group ID', 'supplierGroup'],
  ['Tax ID', 'itemTax'],
  ['Tender Type ID', 'tenderType'],
  ['Unit ID', 'unit'],
  ['Unit Rate ID', 'unitRate'],
]);
const SCREEN_AUDIT_FIELD_REFERENCE_TYPES = new Map<
  string,
  ReadonlyMap<string, AuditReferenceLookupType>
>([
  [
    'Account Group Master',
    createAuditReferenceTypeMap([
      ['Child IDs', 'accountGroup'],
      ['Group ID', 'accountGroup'],
      ['Parent Group ID', 'accountGroup'],
    ]),
  ],
  [
    'Account Ledger Master',
    createAuditReferenceTypeMap([
      ['Group ID', 'accountGroup'],
    ]),
  ],
  [
    'Category Master',
    createAuditReferenceTypeMap([
      ['Parent Category ID', 'category'],
      ['Path IDs Cache', 'category'],
    ]),
  ],
  [
    'Godown Location Master',
    createAuditReferenceTypeMap([
      ['Godown ID', 'godownGroup'],
      ['Parent Location ID', 'godownLocation'],
      ['Path IDs Cache', 'godownLocation'],
    ]),
  ],
  [
    'Item Brand Master',
    createAuditReferenceTypeMap([
      ['Parent Brand ID', 'itemBrand'],
      ['Path IDs', 'itemBrand'],
    ]),
  ],
  [
    'Item EAN Code Master',
    createAuditReferenceTypeMap([
      ['Godown ID', 'godownLocation'],
    ]),
  ],
  [
    'Item Group Master',
    createAuditReferenceTypeMap([
      ['Parent Group ID', 'itemGroup'],
      ['Path IDs Cache', 'itemGroup'],
    ]),
  ],
  [
    'Item Reorder Master',
    createAuditReferenceTypeMap([
      ['Godown ID', 'godownLocation'],
    ]),
  ],
  [
    'Item Section Master',
    createAuditReferenceTypeMap([
      ['Parent Section ID', 'itemSection'],
      ['Path IDs', 'itemSection'],
    ]),
  ],
]);
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async captureScreenSnapshot(
    input: CaptureScreenSnapshotInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.JsonValue | null> {
    const client = tx ?? this.prisma;
    const screen = await client.auditScreen.findFirst({
      where: {
        screenId: input.screenId,
        screenStatus: true,
      },
      select: {
        screenId: true,
      },
    });
    if (!screen) {
      throw new BadRequestException(`No active audit screen found with id ${input.screenId}`);
    }
    // Snapshot SQL templates are intentionally disabled.
    return null;
  }
  async list(
  queryDto: ListAuditLogQueryDto,
): Promise<{ items: AuditLogListItem[]; meta: AuditLogListMeta }> {

  // ── 1. Sanitize pagination params ──────────────────────────────────────────
  const limit        = Math.min(queryDto.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const page         = queryDto.page ?? DEFAULT_PAGE;
  const cursor       = queryDto.cursor?.trim() || undefined;
  const includeTotal = queryDto.include_total === true; // opt-in to avoid COUNT(*)

  // ── 2. Build WHERE clause ──────────────────────────────────────────────────
  const where = this.buildWhereClause(queryDto);

  // ── 3. Consistent ORDER BY (must match the composite index) ───────────────
  const orderBy: Prisma.AuditLogOrderByWithRelationInput[] = [
    { logDate: 'desc' },
    { logId:   'desc' },
  ];

  // ── 4. Single DB round-trip: data  +  optional COUNT  ─────────────────────
  const findArgs: Prisma.AuditLogFindManyArgs = {
    where,
    select:  AUDIT_LOG_SELECT,
    orderBy,
    take:    limit,
    ...(cursor
      ? { cursor: { logId: cursor }, skip: 1 }          // cursor path
      : { skip: (page - 1) * limit }),                  // offset path
  };

  const [records, total] = await Promise.all([
    this.prisma.auditLog.findMany(findArgs) as unknown as AuditLogListRecord[],
    includeTotal
      ? this.prisma.auditLog.count({ where })
      : Promise.resolve(null),
  ]);

  // ── 5. Prepare records once; derive lookup keys in the same pass ───────────
  const preparedRecords  = records.map((r) => this.prepareAuditLogListRecord(r));

  // Extract unique IDs in one pass — avoids iterating arrays multiple times
  const userIds   = [...new Set(records.map((r) => r.logUserId).filter((id): id is string => id !== null))];
  const branchIds = [...new Set(records.map((r) => r.logBranchId).filter((id): id is string => id !== null))];

  // ── 6. All secondary lookups fire in parallel ──────────────────────────────
  const [userNameById, branchNameById, auditReferenceNameLookup] = await Promise.all([
    this.getUserNameByIds(userIds),                     // pass pre-extracted IDs
    this.getBranchNameByIds(branchIds),
    this.getAuditReferenceNameLookup(preparedRecords),
  ]);

  // ── 7. Assemble response ───────────────────────────────────────────────────
  const nextCursor =
    records.length === limit
      ? (records[records.length - 1]?.logId ?? null)
      : null;

  return {
    items: preparedRecords.map((r) =>
      this.toListItem(r, userNameById, branchNameById, auditReferenceNameLookup),
    ),
    meta: {
      page:        cursor ? null : page,
      limit,
      total,
      total_pages: total !== null ? Math.ceil(total / limit) : null,
      next_cursor: nextCursor,
    },
  };
}

// ─── Extracted: WHERE builder ─────────────────────────────────────────────────

private buildWhereClause(queryDto: ListAuditLogQueryDto): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (queryDto.action?.trim()) {
    where.logAction = this.normalizeAction(queryDto.action) as
      | 'insert' | 'update' | 'approve' | 'cancel';
  }

  if (queryDto.screen_id !== undefined) {
    where.logScreenId = queryDto.screen_id;
  }

  if (queryDto.screen_name?.trim()) {
    where.auditScreen = { is: { screenName: queryDto.screen_name.trim() } };
  }

  if (queryDto.record_pk?.trim()) {
    where.logPk = queryDto.record_pk.trim();
  }

  // ── Date range ──────────────────────────────────────────────────────────────
  const dateFrom = queryDto.date_from
    ? this.parseDateBoundary(queryDto.date_from, 'start')
    : undefined;
  const dateTo = queryDto.date_to
    ? this.parseDateBoundary(queryDto.date_to, 'end')
    : undefined;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new BadRequestException('date_from must be less than or equal to date_to');
  }

  if (dateFrom || dateTo) {
    where.logDate = {
      ...(dateFrom && { gte: dateFrom }),
      ...(dateTo   && { lte: dateTo }),
    };
  }

  // ── Full-text search ────────────────────────────────────────────────────────
  if (queryDto.search?.trim()) {
    const search = queryDto.search.trim();
    where.OR = [
      { logTableName:   { contains: search, mode: 'insensitive' } },
      { logPk:          { contains: search, mode: 'insensitive' } },
      { logDisplayName: { contains: search, mode: 'insensitive' } },
      { logNotes:       { contains: search, mode: 'insensitive' } },
      { auditScreen: { is: { screenName: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  return where;
}
  async createAuditLog(input: CreateAuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const action = this.normalizeAction(input.action);
    const prismaAction = action as unknown as Prisma.AuditLogUncheckedCreateInput['logAction'];
    const normalizedTableName = input.tableName.trim();
    if (!normalizedTableName) {
      throw new BadRequestException('tableName is required for audit log');
    }
    const resolvedUserId = this.resolveAuditUserId(input.userId);
    const resolvedIpAddress = this.resolveAuditIpAddress();
    const data: Prisma.AuditLogUncheckedCreateInput = {
      logAction: prismaAction,
      logScreenId: input.screenId,
      logTableName: normalizedTableName,
      logPk: this.normalizePk(input.pk),
      logDisplayName: this.normalizeOptionalText(input.displayName),
      logEntityId: this.normalizeUuid(input.entityId),
      logOriginalRecord: this.toJsonInput(input.originalRecord),
      logModifiedRecord: this.toJsonInput(input.modifiedRecord),
      logChangedFields: this.toJsonInput(input.changedFields),
      logUserId: resolvedUserId,
      logBranchId: this.normalizeUuid(input.branchId),
      logIp: resolvedIpAddress,
      logNotes: this.normalizeOptionalText(input.notes),
    };
    await client.auditLog.create({
      data,
    });
  }
  async logEntityChange(input: LogEntityChangeInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const action = this.normalizeAction(input.action);
    const screen = await this.resolveAuditScreen(input, client);
    const screenId = screen.screenId;
    const originalRecord = this.projectAuditRecord(
      this.toNullableJson(input.originalRecord),
      screen.auditFields,
    );
    const isModifiedRecordProvided = input.modifiedRecord !== undefined;
    let modifiedRecord = this.projectAuditRecord(
      this.toNullableJson(input.modifiedRecord),
      screen.auditFields,
    );
    if (!isModifiedRecordProvided) {
      const pk = this.normalizePk(input.pk);
      if (pk !== null) {
        modifiedRecord = this.projectAuditRecord(
          await this.captureScreenSnapshot(
            {
              screenId,
              keyNo: pk,
              accYear: input.accYear ?? null,
            },
            tx,
          ),
          screen.auditFields,
        );
      }
    }
    if (!isModifiedRecordProvided && modifiedRecord === null) {
      throw new BadRequestException('modifiedRecord is required when auto snapshot is unavailable');
    }
    if (action === 'insert') {
      const insertOriginalRecord = originalRecord ?? modifiedRecord;
      if (insertOriginalRecord === null) {
        throw new BadRequestException(
          'originalRecord or modifiedRecord is required for insert audit log',
        );
      }
      await this.createAuditLog(
        {
          action,
          screenId,
          tableName: input.tableName,
          pk: input.pk,
          displayName: input.displayName,
          entityId: input.entityId,
          originalRecord: insertOriginalRecord,
          modifiedRecord: undefined,
          changedFields: undefined,
          userId: input.userId,
          branchId: input.branchId,
          notes: input.notes,
        },
        tx,
      );
      return;
    }
    if (action === 'update' && (originalRecord === null || modifiedRecord === null)) {
      throw new BadRequestException(
        'originalRecord and modifiedRecord are required for update audit log',
      );
    }
    const changedFields = this.computeChangedFields(originalRecord, modifiedRecord);
    await this.createAuditLog(
      {
        action,
        screenId,
        tableName: input.tableName,
        pk: input.pk,
        displayName: input.displayName,
        entityId: input.entityId,
        originalRecord,
        modifiedRecord,
        changedFields,
        userId: input.userId,
        branchId: input.branchId,
        notes: input.notes,
      },
      tx,
    );
  }
  private async resolveAuditScreen(
    input: LogEntityChangeInput,
    tx: AuditWriteClient,
  ): Promise<ResolvedAuditScreen> {
    if (input.screenId !== undefined) {
      if (!Number.isInteger(input.screenId) || input.screenId <= 0) {
        throw new BadRequestException('screenId must be a positive integer');
      }
      const existingScreen = await tx.auditScreen.findFirst({
        where: {
          screenId: input.screenId,
          screenStatus: true,
        },
        select: {
          screenId: true,
          screenName: true,
          screenAuditSql: true,
        },
      });
      if (!existingScreen) {
        throw new BadRequestException(`No active audit screen found with id ${input.screenId}`);
      }
      const resolvedScreen = await this.syncAuditScreenSqlIfNeeded(tx, existingScreen);
      return {
        screenId: resolvedScreen.screenId,
        auditFields: this.extractAuditFields(resolvedScreen.screenAuditSql),
      };
    }
    const screenName = input.screenName?.trim();
    if (!screenName) {
      throw new BadRequestException('Either screenId or screenName is required');
    }
    const existingScreen = await tx.auditScreen.findFirst({
      where: {
        screenName,
        screenStatus: true,
      },
      select: {
        screenId: true,
        screenName: true,
        screenAuditSql: true,
      },
      orderBy: {
        screenId: 'asc',
      },
    });
    if (existingScreen) {
      const resolvedScreen = await this.syncAuditScreenSqlIfNeeded(tx, existingScreen);
      return {
        screenId: resolvedScreen.screenId,
        auditFields: this.extractAuditFields(resolvedScreen.screenAuditSql),
      };
    }
    const screenAuditSql = getAuditScreenSql(screenName);
    const createdScreen = await tx.auditScreen.create({
      data: {
        screenName,
        screenType: this.normalizeScreenType(input.screenType),
        screenStatus: true,
        screenAuditSql,
      },
      select: {
        screenId: true,
        screenAuditSql: true,
      },
    });
    return {
      screenId: createdScreen.screenId,
      auditFields: this.extractAuditFields(createdScreen.screenAuditSql),
    };
  }
  private async syncAuditScreenSqlIfNeeded(
    tx: AuditWriteClient,
    screen: { screenId: number; screenName: string; screenAuditSql: string | null },
  ): Promise<{ screenId: number; screenAuditSql: string | null }> {
    const desiredScreenAuditSql = getAuditScreenSql(screen.screenName);
    if (!desiredScreenAuditSql || screen.screenAuditSql === desiredScreenAuditSql) {
      return {
        screenId: screen.screenId,
        screenAuditSql: screen.screenAuditSql,
      };
    }
    return tx.auditScreen.update({
      where: {
        screenId: screen.screenId,
      },
      data: {
        screenAuditSql: desiredScreenAuditSql,
      },
      select: {
        screenId: true,
        screenAuditSql: true,
      },
    });
  }
  private normalizeAction(action: string): AuditAction {
    const normalizedAction = action.trim().toLowerCase();
    switch (normalizedAction) {
      case 'new':
        return 'insert';
      case 'insert':
      case 'update':
      case 'approve':
      case 'cancel':
        return normalizedAction;
      default:
        throw new BadRequestException(`Unsupported audit action: ${action}`);
    }
  }
  private parseDateBoundary(value: string, boundary: 'start' | 'end'): Date {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
      return new Date(`${normalized}${suffix}`);
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }
    return parsed;
  }
  private toListItem(
    preparedRecord: PreparedAuditLogListRecord,
    userNameById: ReadonlyMap<string, string>,
    branchNameById: ReadonlyMap<string, string>,
    auditReferenceNameLookup: AuditReferenceNameLookup,
  ): AuditLogListItem {
    const { record, screenName } = preparedRecord;
    const originalRecord = this.resolveAuditReferenceNames(
      preparedRecord.originalRecord,
      screenName,
      auditReferenceNameLookup,
    );
    const modifiedRecord = this.resolveAuditReferenceNames(
      preparedRecord.modifiedRecord,
      screenName,
      auditReferenceNameLookup,
    );
    const changedFields = this.resolveAuditReferenceNames(
      preparedRecord.changedFields,
      screenName,
      auditReferenceNameLookup,
    );
    const displayName =
      this.normalizeOptionalText(record.logDisplayName) ??
      this.findAuditDisplayName(modifiedRecord) ??
      this.findAuditDisplayName(originalRecord);
    const userName = record.logUserId ? (userNameById.get(record.logUserId) ?? null) : null;
    const branchName = record.logBranchId ? (branchNameById.get(record.logBranchId) ?? null) : null;
    return {
      log_id: record.logId,
      log_date: record.logDate.toISOString(),
      log_action: record.logAction === 'insert' ? 'New' : record.logAction,
      log_screen_id: record.logScreenId,
      screen_name: screenName,
      log_table_name: record.logTableName,
      log_pk: displayName ?? record.logPk,
      log_display_name: displayName,
      log_original_record: originalRecord,
      log_modified_record: modifiedRecord,
      log_changed_fields: changedFields,
      log_user_id: userName ? null : record.logUserId,
      log_user_name: userName,
      log_branch_id: branchName ? null : record.logBranchId,
      log_branch_name: branchName,
      log_notes: record.logNotes,
    };
  }
  private prepareAuditLogListRecord(record: AuditLogListRecord): PreparedAuditLogListRecord {
    const screenName = record.auditScreen.screenName;
    const auditFields = this.extractAuditFields(getAuditScreenSql(screenName));
    return {
      record,
      screenName,
      auditFields,
      originalRecord: this.renameAuditRecordFields(record.logOriginalRecord, auditFields),
      modifiedRecord: this.renameAuditRecordFields(record.logModifiedRecord, auditFields),
      changedFields: this.renameAuditRecordFields(record.logChangedFields, auditFields),
    };
  }
  private renameAuditRecordFields(
    record: Prisma.JsonValue | null,
    auditFields: readonly AuditFieldDefinition[],
  ): Prisma.JsonValue | null {
    if (record === null || auditFields.length === 0 || !this.isJsonObject(record)) {
      return record;
    }
    const renamedRecord: Prisma.JsonObject = {};
    for (const [key, value] of Object.entries(record)) {
      const auditField = this.findAuditFieldDefinitionByKey(key, auditFields);
      const targetKey = auditField?.targetFieldName ?? key;
      renamedRecord[targetKey] = value as Prisma.JsonValue;
    }
    return renamedRecord;
  }
  private findAuditFieldDefinitionByKey(
    key: string,
    auditFields: readonly AuditFieldDefinition[],
  ): AuditFieldDefinition | null {
    const lookupTokens = new Set(this.buildAuditFieldLookupTokens(key));
    if (lookupTokens.size === 0) {
      return null;
    }
    for (const auditField of auditFields) {
      const candidateFieldNames = [
        auditField.sourceFieldName,
        auditField.targetFieldName,
      ].filter((fieldName): fieldName is string => Boolean(fieldName));
      for (const candidateFieldName of candidateFieldNames) {
        const candidateTokens = this.buildAuditFieldLookupTokens(candidateFieldName);
        if (candidateTokens.some((token) => lookupTokens.has(token))) {
          return auditField;
        }
      }
    }
    return null;
  }
  private async getAuditReferenceNameLookup(
    preparedRecords: readonly PreparedAuditLogListRecord[],
  ): Promise<AuditReferenceNameLookup> {
    const referenceIdsByType = new Map<AuditReferenceLookupType, Set<string>>();
    for (const preparedRecord of preparedRecords) {
      this.collectAuditReferenceIds(
        preparedRecord.originalRecord,
        preparedRecord.screenName,
        referenceIdsByType,
      );
      this.collectAuditReferenceIds(
        preparedRecord.modifiedRecord,
        preparedRecord.screenName,
        referenceIdsByType,
      );
      this.collectAuditReferenceIds(
        preparedRecord.changedFields,
        preparedRecord.screenName,
        referenceIdsByType,
      );
    }
    const entries = await Promise.all(
      Array.from(referenceIdsByType.entries()).map(async ([lookupType, ids]) => [
        lookupType,
        await this.fetchAuditReferenceNameMap(lookupType, Array.from(ids)),
      ]),
    );
    return Object.fromEntries(entries) as AuditReferenceNameLookup;
  }
  private collectAuditReferenceIds(
    value: Prisma.JsonValue | null,
    screenName: string,
    referenceIdsByType: Map<AuditReferenceLookupType, Set<string>>,
  ): void {
    if (value === null) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectAuditReferenceIds(item, screenName, referenceIdsByType);
      }
      return;
    }
    if (!this.isJsonObject(value)) {
      return;
    }
    for (const [fieldName, fieldValue] of Object.entries(value)) {
      const normalizedFieldValue = (fieldValue ?? null) as Prisma.JsonValue;
      const lookupType = this.resolveAuditFieldReferenceType(screenName, fieldName);
      if (!lookupType) {
        this.collectAuditReferenceIds(normalizedFieldValue, screenName, referenceIdsByType);
        continue;
      }
      if (this.isAuditDiffLeaf(normalizedFieldValue)) {
        this.collectAuditReferenceLeafId(normalizedFieldValue.from, lookupType, referenceIdsByType);
        this.collectAuditReferenceLeafId(normalizedFieldValue.to, lookupType, referenceIdsByType);
        continue;
      }
      this.collectAuditReferenceLeafId(normalizedFieldValue, lookupType, referenceIdsByType);
    }
  }
  private collectAuditReferenceLeafId(
    value: Prisma.JsonValue,
    lookupType: AuditReferenceLookupType,
    referenceIdsByType: Map<AuditReferenceLookupType, Set<string>>,
  ): void {
    if (value === null) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectAuditReferenceLeafId(item, lookupType, referenceIdsByType);
      }
      return;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
      return;
    }
    const normalizedValue = String(value).trim();
    if (!normalizedValue || !this.isValidAuditReferenceId(lookupType, normalizedValue)) {
      return;
    }
    const existingIds = referenceIdsByType.get(lookupType) ?? new Set<string>();
    existingIds.add(normalizedValue);
    referenceIdsByType.set(lookupType, existingIds);
  }
  private resolveAuditReferenceNames(
    value: Prisma.JsonValue | null,
    screenName: string,
    auditReferenceNameLookup: AuditReferenceNameLookup,
  ): Prisma.JsonValue | null {
    if (value === null) {
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((item) =>
        this.resolveAuditReferenceNames(item, screenName, auditReferenceNameLookup),
      );
    }
    if (!this.isJsonObject(value)) {
      return value;
    }
    const transformedValue: Prisma.JsonObject = {};
    for (const [fieldName, fieldValue] of Object.entries(value)) {
      const normalizedFieldValue = (fieldValue ?? null) as Prisma.JsonValue;
      const lookupType = this.resolveAuditFieldReferenceType(screenName, fieldName);
      if (!lookupType) {
        transformedValue[fieldName] = this.resolveAuditReferenceNames(
          normalizedFieldValue,
          screenName,
          auditReferenceNameLookup,
        ) as Prisma.JsonValue;
        continue;
      }
      if (this.isAuditDiffLeaf(normalizedFieldValue)) {
        transformedValue[fieldName] = {
          from: this.resolveAuditReferenceLeafValue(
            normalizedFieldValue.from,
            lookupType,
            auditReferenceNameLookup,
          ),
          to: this.resolveAuditReferenceLeafValue(
            normalizedFieldValue.to,
            lookupType,
            auditReferenceNameLookup,
          ),
        };
        continue;
      }
      transformedValue[fieldName] = this.resolveAuditReferenceLeafValue(
        normalizedFieldValue,
        lookupType,
        auditReferenceNameLookup,
      );
    }
    return transformedValue;
  }
  private resolveAuditReferenceLeafValue(
    value: Prisma.JsonValue,
    lookupType: AuditReferenceLookupType,
    auditReferenceNameLookup: AuditReferenceNameLookup,
  ): Prisma.JsonValue {
    if (value === null) {
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((item) =>
        this.resolveAuditReferenceLeafValue(item, lookupType, auditReferenceNameLookup),
      );
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
      return value;
    }
    const normalizedValue = String(value).trim();
    if (!normalizedValue) {
      return value;
    }
    return auditReferenceNameLookup[lookupType]?.get(normalizedValue) ?? value;
  }
  private resolveAuditFieldReferenceType(
    screenName: string,
    fieldName: string,
  ): AuditReferenceLookupType | null {
    const normalizedFieldName = this.normalizeAuditFieldLookup(fieldName);
    const screenResolver = SCREEN_AUDIT_FIELD_REFERENCE_TYPES.get(screenName);
    if (screenResolver?.has(normalizedFieldName)) {
      return screenResolver.get(normalizedFieldName) ?? null;
    }
    return GLOBAL_AUDIT_FIELD_REFERENCE_TYPES.get(normalizedFieldName) ?? null;
  }
  private isValidAuditReferenceId(lookupType: AuditReferenceLookupType, value: string): boolean {
    if (lookupType === 'tenderType') {
      return NUMERIC_ID_PATTERN.test(value);
    }
    return UUID_PATTERN.test(value);
  }
  private isAuditDiffLeaf(
    value: Prisma.JsonValue,
  ): value is Prisma.JsonObject & { from: Prisma.JsonValue; to: Prisma.JsonValue } {
    return (
      this.isJsonObject(value) &&
      Object.prototype.hasOwnProperty.call(value, 'from') &&
      Object.prototype.hasOwnProperty.call(value, 'to')
    );
  }
  private findAuditDisplayName(value: Prisma.JsonValue | null): string | null {
    if (!this.isJsonObject(value)) {
      return null;
    }
    for (const [fieldName, fieldValue] of Object.entries(value)) {
      const normalizedFieldValue = (fieldValue ?? null) as Prisma.JsonValue;
      if (
        !DISPLAY_FIELD_PATTERN.test(fieldName) ||
        fieldName.toLowerCase().startsWith('parent ') ||
        fieldName.toLowerCase().includes('contact')
      ) {
        continue;
      }
      if (
        normalizedFieldValue === null ||
        Array.isArray(normalizedFieldValue) ||
        this.isJsonObject(normalizedFieldValue)
      ) {
        continue;
      }
      const normalizedValue = String(normalizedFieldValue).trim();
      if (normalizedValue) {
        return normalizedValue;
      }
    }
    return null;
  }
  private async fetchAuditReferenceNameMap(
    lookupType: AuditReferenceLookupType,
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (ids.length === 0) {
      return new Map<string, string>();
    }
    switch (lookupType) {
      case 'accountGroup': {
        const groups = await this.prisma.accountGroup.findMany({
          where: {
            accGroupId: {
              in: [...ids],
            },
          },
          select: {
            accGroupId: true,
            accGroupName: true,
          },
        });
        return new Map(groups.map((group) => [group.accGroupId, group.accGroupName]));
      }
      case 'area': {
        const areas = await this.prisma.areaMaster.findMany({
          where: {
            armId: {
              in: [...ids],
            },
          },
          select: {
            armId: true,
            armName: true,
          },
        });
        return new Map(areas.map((area) => [area.armId, area.armName]));
      }
      case 'branch':
        return this.getBranchNameByIds(ids);
      case 'category': {
        const categories = await this.prisma.categoryMaster.findMany({
          where: {
            categoryId: {
              in: [...ids],
            },
          },
          select: {
            categoryId: true,
            categoryName: true,
          },
        });
        return new Map(categories.map((category) => [category.categoryId, category.categoryName]));
      }
      case 'city': {
        const cities = await this.prisma.cityMaster.findMany({
          where: {
            ctmId: {
              in: [...ids],
            },
          },
          select: {
            ctmId: true,
            ctmName: true,
          },
        });
        return new Map(cities.map((city) => [city.ctmId, city.ctmName]));
      }
      case 'company': {
        const companies = await this.prisma.company.findMany({
          where: {
            compId: {
              in: [...ids],
            },
          },
          select: {
            compId: true,
            compName: true,
          },
        });
        return new Map(companies.map((company) => [company.compId, company.compName]));
      }
      case 'customer': {
        const customers = await this.prisma.customer.findMany({
          where: {
            cusId: {
              in: [...ids],
            },
          },
          select: {
            cusId: true,
            cusName: true,
            cusCode: true,
          },
        });
        return new Map(
          customers.map((customer) => [
            customer.cusId,
            customer.cusName?.trim() || customer.cusCode?.trim() || customer.cusId,
          ]),
        );
      }
      case 'customerGroup': {
        const groups = await this.prisma.custGroup.findMany({
          where: {
            cgrId: {
              in: [...ids],
            },
          },
          select: {
            cgrId: true,
            cgrName: true,
          },
        });
        return new Map(groups.map((group) => [group.cgrId, group.cgrName]));
      }
      case 'employeeDepartment': {
        const departments = await this.prisma.employeeDepartment.findMany({
          where: {
            edptId: {
              in: [...ids],
            },
          },
          select: {
            edptId: true,
            edptName: true,
          },
        });
        return new Map(
          departments.map((department) => [department.edptId, department.edptName]),
        );
      }
      case 'employeeDesignation': {
        const designations = await this.prisma.employeeDesignation.findMany({
          where: {
            edId: {
              in: [...ids],
            },
          },
          select: {
            edId: true,
            edName: true,
          },
        });
        return new Map(
          designations.map((designation) => [designation.edId, designation.edName]),
        );
      }
      case 'godownGroup': {
        const godownLocations = await this.prisma.godownLocation.findMany({
          where: {
            gdlId: {
              in: [...ids],
            },
          },
          select: {
            gdlId: true,
            gdlName: true,
            gdlParentId: true,
            gdlLevel: true,
            gdlSort: true,
          },
          orderBy: [{ gdlLevel: 'asc' }, { gdlSort: 'asc' }, { gdlName: 'asc' }],
        });
        const godownNameById = new Map<string, string>();
        for (const location of godownLocations) {
          if (!godownNameById.has(location.gdlId)) {
            godownNameById.set(location.gdlId, location.gdlName);
          }
        }
        return godownNameById;
      }
      case 'godownLocation': {
        const locations = await this.prisma.godownLocation.findMany({
          where: {
            gdlId: {
              in: [...ids],
            },
          },
          select: {
            gdlId: true,
            gdlName: true,
          },
        });
        return new Map(locations.map((location) => [location.gdlId, location.gdlName]));
      }
      case 'gspProvider': {
        const providers = await this.prisma.gspProviderMaster.findMany({
          where: {
            gspProviderId: {
              in: [...ids],
            },
          },
          select: {
            gspProviderId: true,
            gspProviderName: true,
          },
        });
        return new Map(
          providers.map((provider) => [provider.gspProviderId, provider.gspProviderName]),
        );
      }
      case 'item': {
        const items = await this.prisma.itemMaster.findMany({
          where: {
            itemId: {
              in: [...ids],
            },
          },
          select: {
            itemId: true,
            itemNameEn: true,
          },
        });
        return new Map(items.map((item) => [item.itemId, item.itemNameEn]));
      }
      case 'itemBrand': {
        const brands = await this.prisma.itemBrandMaster.findMany({
          where: {
            brand_id: {
              in: [...ids],
            },
          },
          select: {
            brand_id: true,
            brand_name: true,
          },
        });
        return new Map(brands.map((brand) => [brand.brand_id, brand.brand_name]));
      }
      case 'itemGroup': {
        const groups = await this.prisma.itemGroupMaster.findMany({
          where: {
            itgId: {
              in: [...ids],
            },
          },
          select: {
            itgId: true,
            itgName: true,
          },
        });
        return new Map(groups.map((group) => [group.itgId, group.itgName]));
      }
      case 'itemSection': {
        const sections = await this.prisma.itemSectionMaster.findMany({
          where: {
            secId: {
              in: [...ids],
            },
          },
          select: {
            secId: true,
            secName: true,
          },
        });
        return new Map(sections.map((section) => [section.secId, section.secName]));
      }
      case 'itemTax': {
        const taxes = await this.prisma.itemTaxMaster.findMany({
          where: {
            taxId: {
              in: [...ids],
            },
          },
          select: {
            taxId: true,
            taxName: true,
          },
        });
        return new Map(taxes.map((tax) => [tax.taxId, tax.taxName]));
      }
      case 'ledger': {
        const ledgers = await this.prisma.accLedgerMaster.findMany({
          where: {
            ledId: {
              in: [...ids],
            },
          },
          select: {
            ledId: true,
            ledName: true,
          },
        });
        return new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName]));
      }
      case 'state': {
        const states = await this.prisma.stateMaster.findMany({
          where: {
            stmId: {
              in: [...ids],
            },
          },
          select: {
            stmId: true,
            stmName: true,
          },
        });
        return new Map(states.map((state) => [state.stmId, state.stmName]));
      }
      case 'supplierGroup': {
        const groups = await this.prisma.supplierGroup.findMany({
          where: {
            spgId: {
              in: [...ids],
            },
          },
          select: {
            spgId: true,
            spgName: true,
          },
        });
        return new Map(groups.map((group) => [group.spgId, group.spgName]));
      }
      case 'tenderType': {
        const tenderTypeIds = ids.map((id) => BigInt(id));
        const tenderTypes = await this.prisma.accountTenderTypes.findMany({
          where: {
            accttTypeId: {
              in: tenderTypeIds,
            },
          },
          select: {
            accttTypeId: true,
            accttTypeName: true,
          },
        });
        return new Map(
          tenderTypes.map((tenderType) => [
            tenderType.accttTypeId.toString(),
            tenderType.accttTypeName,
          ]),
        );
      }
      case 'unit': {
        const units = await this.prisma.unit.findMany({
          where: {
            unit_id: {
              in: [...ids],
            },
          },
          select: {
            unit_id: true,
            unit_name: true,
          },
        });
        return new Map(units.map((unit) => [unit.unit_id, unit.unit_name]));
      }
      case 'unitRate': {
        const unitRates = await this.prisma.itemPriceMaster.findMany({
          where: {
            ipmId: {
              in: [...ids],
            },
          },
          select: {
            ipmId: true,
            item: {
              select: {
                itemNameEn: true,
              },
            },
            // ipm_uc_unit_id is a FK to item_unit_conversion; the unit is one hop out.
            itemUnitConversion: {
              select: {
                unit: {
                  select: {
                    unit_name: true,
                  },
                },
              },
            },
            godown: {
              select: {
                gdlName: true,
              },
            },
          },
        });
        return new Map(
          unitRates.map((unitRate) => [
            unitRate.ipmId,
            [
              unitRate.item.itemNameEn,
              unitRate.itemUnitConversion.unit.unit_name,
              unitRate.godown?.gdlName,
            ]
              .filter(Boolean)
              .join(' / '),
          ]),
        );
      }
    }
  }
  private async getUserNameByIds(userIds: readonly string[]): Promise<Map<string, string>> {
    const users = await this.prisma.userMaster.findMany({
      where: {
        usrId: {
          in: [...userIds],
        },
      },
      select: {
        usrId: true,
        usrDisplayName: true,
      },
    });
    return new Map(users.map((user) => [user.usrId, user.usrDisplayName]));
  }
  private async getBranchNameByIds(branchIds: readonly string[]): Promise<Map<string, string>> {
    const branches = await this.prisma.branchMaster.findMany({
      where: {
        brId: {
          in: [...branchIds],
        },
      },
      select: {
        brId: true,
        brName: true,
      },
    });
    return new Map(branches.map((branch) => [branch.brId, branch.brName]));
  }
  private normalizeScreenType(screenType?: string): AuditScreenType {
    const normalizedScreenType = screenType?.trim().toLowerCase();
    switch (normalizedScreenType) {
      case undefined:
      case '':
      case 'other':
        return 'other';
      case 'master':
        return 'master';
      case 'transaction':
        return 'transaction';
      case 'settings':
        return 'settings';
      default:
        throw new BadRequestException(`Unsupported audit screen type: ${screenType}`);
    }
  }
  private projectAuditRecord(
    record: Prisma.JsonValue | null,
    auditFields: readonly AuditFieldDefinition[],
  ): Prisma.JsonValue | null {
    if (record === null || auditFields.length === 0 || !this.isJsonObject(record)) {
      return record;
    }
    const projectedRecord: Prisma.JsonObject = {};
    for (const auditField of auditFields) {
      projectedRecord[auditField.targetFieldName] = this.resolveAuditFieldValue(record, auditField);
    }
    return projectedRecord;
  }
  private resolveAuditFieldValue(
    record: Prisma.JsonObject,
    auditField: AuditFieldDefinition,
  ): Prisma.JsonValue {
    const sourceKey = auditField.sourceFieldName
      ? this.findAuditFieldKey(record, auditField.sourceFieldName)
      : null;
    if (sourceKey) {
      return (record[sourceKey] as Prisma.JsonValue | null | undefined) ?? null;
    }
    const targetKey = this.findAuditFieldKey(record, auditField.targetFieldName);
    if (!targetKey) {
      return null;
    }
    return (record[targetKey] as Prisma.JsonValue | null | undefined) ?? null;
  }
  private findAuditFieldKey(record: Prisma.JsonObject, auditFieldName: string): string | null {
    const lookupTokens = new Set(this.buildAuditFieldLookupTokens(auditFieldName));
    if (lookupTokens.size === 0) {
      return null;
    }
    for (const key of Object.keys(record)) {
      const keyTokens = this.buildAuditFieldLookupTokens(key);
      if (keyTokens.some((token) => lookupTokens.has(token))) {
        return key;
      }
    }
    return null;
  }
  private buildAuditFieldLookupTokens(value: string): string[] {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return [];
    }
    const normalizedSnake = this.toSnakeCase(normalizedValue);
    return Array.from(
      new Set(
        [
          this.normalizeAuditFieldLookup(normalizedValue),
          normalizedSnake,
          this.normalizeAuditFieldLookup(this.toCamelCase(normalizedSnake)),
        ].filter(Boolean),
      ),
    );
  }
  private extractAuditFields(screenAuditSql?: string | null): AuditFieldDefinition[] {
    const normalizedSql = screenAuditSql?.trim();
    if (!normalizedSql) {
      return [];
    }
    const selectClauseMatch = normalizedSql.match(/^\s*select\s+([\s\S]+?)\s+from\b/i);
    if (!selectClauseMatch) {
      return [];
    }
    const fields = this.splitSelectClause(selectClauseMatch[1])
      .map((fieldExpression) => this.extractAuditFieldDefinition(fieldExpression))
      .filter((field): field is AuditFieldDefinition => Boolean(field));
    const seen = new Set<string>();
    return fields.filter((field) => {
      if (seen.has(field.targetFieldName)) {
        return false;
      }
      seen.add(field.targetFieldName);
      return true;
    });
  }
  private splitSelectClause(selectClause: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let parenthesisDepth = 0;
    let insideSingleQuote = false;
    let insideDoubleQuote = false;
    for (const character of selectClause) {
      if (character === "'" && !insideDoubleQuote) {
        insideSingleQuote = !insideSingleQuote;
      } else if (character === '"' && !insideSingleQuote) {
        insideDoubleQuote = !insideDoubleQuote;
      } else if (!insideSingleQuote && !insideDoubleQuote) {
        if (character === '(') {
          parenthesisDepth += 1;
        } else if (character === ')' && parenthesisDepth > 0) {
          parenthesisDepth -= 1;
        } else if (character === ',' && parenthesisDepth === 0) {
          const field = currentField.trim();
          if (field) {
            fields.push(field);
          }
          currentField = '';
          continue;
        }
      }
      currentField += character;
    }
    const trailingField = currentField.trim();
    if (trailingField) {
      fields.push(trailingField);
    }
    return fields;
  }
  private extractAuditFieldDefinition(fieldExpression: string): AuditFieldDefinition | null {
    const normalizedExpression = fieldExpression.trim();
    if (!normalizedExpression) {
      return null;
    }
    const explicitAliasMatch = normalizedExpression.match(
      /^(?<source>[\s\S]+?)\s+as\s+("(?<quotedAlias>[^"]+)"|(?<alias>[A-Za-z_][A-Za-z0-9_]*))\s*$/i,
    );
    if (explicitAliasMatch?.groups) {
      const targetFieldName =
        explicitAliasMatch.groups.quotedAlias ?? explicitAliasMatch.groups.alias ?? null;
      if (!targetFieldName) {
        return null;
      }
      return {
        sourceFieldName: this.extractSourceFieldName(explicitAliasMatch.groups.source),
        targetFieldName,
      };
    }
    const sourceFieldName = this.extractSourceFieldName(normalizedExpression);
    if (!sourceFieldName) {
      return null;
    }
    return {
      sourceFieldName,
      targetFieldName: sourceFieldName,
    };
  }
  private extractSourceFieldName(expression: string): string | null {
    const expressionWithoutCast = expression
      .trim()
      .replace(/::\s*("[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(\[\])?\s*$/g, '')
      .trim();
    const quotedIdentifierMatch = expressionWithoutCast.match(/"([^"]+)"\s*$/);
    if (quotedIdentifierMatch) {
      return quotedIdentifierMatch[1];
    }
    const identifierMatch = expressionWithoutCast.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    return identifierMatch?.[1] ?? null;
  }
  private toSnakeCase(value: string): string {
    return this.normalizeAuditFieldLookup(value.replace(/([a-z0-9])([A-Z])/g, '$1_$2'));
  }
  private toCamelCase(value: string): string {
    const normalized = this.normalizeAuditFieldLookup(value);
    if (!normalized) {
      return '';
    }
    return normalized
      .split('_')
      .filter(Boolean)
      .map((segment, index) =>
        index === 0 ? segment : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`,
      )
      .join('');
  }
  private normalizeAuditFieldLookup(value: string): string {
    return normalizeAuditFieldLookupToken(value);
  }
  private computeChangedFields(
    originalRecord: Prisma.JsonValue | null,
    modifiedRecord: Prisma.JsonValue | null,
  ): Prisma.JsonValue | null {
    const diff = this.computeJsonDiff(originalRecord, modifiedRecord);
    return diff ?? null;
  }
  private computeJsonDiff(
    left: Prisma.JsonValue | null,
    right: Prisma.JsonValue | null,
  ): Prisma.JsonValue | undefined {
    if (this.areJsonValuesEqual(left, right)) {
      return undefined;
    }
    if (this.isJsonObject(left) && this.isJsonObject(right)) {
      const diff: Prisma.JsonObject = {};
      const keys = new Set<string>([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) {
        const hasLeft = Object.prototype.hasOwnProperty.call(left, key);
        const hasRight = Object.prototype.hasOwnProperty.call(right, key);
        const leftValue = hasLeft ? (left[key] as Prisma.JsonValue) : null;
        const rightValue = hasRight ? (right[key] as Prisma.JsonValue) : null;
        const childDiff = this.computeJsonDiff(leftValue, rightValue);
        if (childDiff !== undefined) {
          diff[key] = childDiff;
        }
      }
      return Object.keys(diff).length > 0 ? diff : undefined;
    }
    return {
      from: left ?? null,
      to: right ?? null,
    };
  }
  private areJsonValuesEqual(
    left: Prisma.JsonValue | null,
    right: Prisma.JsonValue | null,
  ): boolean {
    if (left === right) {
      return true;
    }
    if (left === null || right === null) {
      return false;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        return false;
      }
      for (let index = 0; index < left.length; index += 1) {
        if (!this.areJsonValuesEqual(left[index], right[index])) {
          return false;
        }
      }
      return true;
    }
    if (this.isJsonObject(left) && this.isJsonObject(right)) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) {
        return false;
      }
      for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) {
          return false;
        }
        if (
          !this.areJsonValuesEqual(left[key] as Prisma.JsonValue, right[key] as Prisma.JsonValue)
        ) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  private isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return this.normalizeJsonValue(value) as Prisma.InputJsonValue;
  }
  private toNullableJson(value: unknown): Prisma.JsonValue | null {
    if (value === undefined || value === null) {
      return null;
    }
    return this.normalizeJsonValue(value);
  }
  private normalizeJsonValue(value: unknown): Prisma.JsonValue {
    return JSON.parse(
      JSON.stringify(value, (_key, nestedValue) =>
        typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
      ),
    ) as Prisma.JsonValue;
  }
  private normalizePk(value: string | number | bigint | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = String(value).trim();
    return normalized || null;
  }
  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = value.trim();
    return normalized || null;
  }
  private normalizeUuid(value: string | number | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return null;
    }
    return UUID_PATTERN.test(normalized) ? normalized : null;
  }
  private resolveAuditUserId(providedUserId: string | number | null | undefined): string | null {
    const explicitUserId = this.normalizeUuid(providedUserId);
    if (explicitUserId) {
      return explicitUserId;
    }
    return this.normalizeUuid(this.requestContextService.getUserId());
  }
  private resolveAuditIpAddress(): string | null {
    const requestIpAddress = this.requestContextService.getIpAddress();
    return this.normalizeIpAddress(requestIpAddress);
  }
  private normalizeIpAddress(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    return isIP(normalized) === 0 ? null : normalized;
  }
}
