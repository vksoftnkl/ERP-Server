import { Injectable } from '@nestjs/common';
import { AppSettingDef, AppSettingValue, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runSettingsListQuery,
} from 'src/common/utils/module-list.utils';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  normalizeNullableString,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';
import { ListAppSettingValueQueryDto } from './dto/list-app-setting-value-query.dto';
import { SaveAppSettingValueDto } from './dto/save-app-setting-value.dto';
import { isScopeWithinMax, toAllowedValues, validateSettingValue } from './app-settings.validation';
import {
  APP_SETTING_SCOPE_ID_FIELD,
  APP_SETTING_SCOPE_ID_FIELDS,
  AppSettingDataType,
  AppSettingResolveScope,
  AppSettingResolvedValue,
  AppSettingScope,
  AppSettingScopeIdField,
  AppSettingScopeTarget,
  AppSettingValueDeleteResult,
  AppSettingValueListItem,
  AppSettingValuePayload,
  AppSettingsErrorDetail,
  AppSettingsListMeta,
  AppSettingsResolved,
} from './types/app-settings-api.types';

const APP_SETTING_VALUE_TABLE_NAME = 'app setting value';
const APP_SETTING_VALUE_AUDIT_SCREEN_NAME = 'App Settings';
const APP_SETTING_VALUE_GRID_ALIAS = 'app_setting_value_grid';

// Which master each scope's id points into, for the existence check the FK
// makes too — the FK answers 23503 naming a constraint, this answers 400 naming
// the field the caller sent.
const SCOPE_ID_LABEL: Record<AppSettingScopeIdField, string> = {
  asvCompanyId: 'company',
  asvBranchId: 'branch',
  asvDeviceId: 'device',
  asvUserId: 'user',
};

/**
 * CRUD over `public.app_setting_value` — the OVERRIDES — plus the two read
 * endpoints that answer what a setting actually resolves to.
 *
 * A row exists here only where somebody changed something. Three things follow
 * from that, and they are the whole shape of this service:
 *
 *  - **Saving is an upsert**, keyed on (setting, scope target) rather than on
 *    an id. That is what ux_asv_scope_target means by "one row per target", and
 *    it is what a settings screen means by Save: the second save of the same
 *    box moves the row it wrote the first time instead of colliding with it.
 *  - **Resetting is a DELETE**, never a write of the default. The row goes and
 *    the layer above takes over again; writing the default value instead would
 *    freeze today's default into a permanent override that stops tracking it.
 *  - **Reading resolved values goes to `fn_app_settings`**, not to a merge
 *    written here. The precedence lives in one place so the client and the
 *    server-side rules cannot drift apart.
 */
@Injectable()
export class AppSettingValueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveDto: SaveAppSettingValueDto): Promise<AppSettingValuePayload> {
    if (saveDto.asvId) {
      return this.updateValue(saveDto);
    }
    return this.upsertValue(saveDto);
  }

  async list(
    queryDto: ListAppSettingValueQueryDto,
  ): Promise<ConfiguredGridListResult<AppSettingValueListItem, AppSettingsListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where = this.buildListWhere(queryDto);
    return runSettingsListQuery(
      { page, limit },
      {
        hasStructuredFilters: this.hasStructuredFilters(queryDto),
        configuredGridFn: () =>
          runConfiguredGridQuery<AppSettingValueListItem>(this.configuredGridSqlService, {
            tableName: APP_SETTING_VALUE_TABLE_NAME,
            alias: APP_SETTING_VALUE_GRID_ALIAS,
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.appSettingValue.count({ where }),
        findManyFn: () =>
          this.prisma.appSettingValue.findMany({
            where,
            orderBy: [{ asvSettingKey: 'asc' }, { asvScope: 'asc' }, { asvId: 'asc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(asvId: string): Promise<AppSettingValuePayload> {
    const record = await this.prisma.appSettingValue.findFirst({
      where: { asvId, asvIsDeleted: false },
    });
    if (!record) {
      this.throwNotFound(asvId);
    }
    return this.toPayload(record);
  }

  /**
   * Reset — the override goes away and whatever the layer above says takes over
   * again.
   *
   * A soft delete IS the reset: ux_asv_scope_target is partial on
   * `asv_is_deleted = false`, so the slot is free for a new override the moment
   * this returns, and the deleted row stays as the record of what somebody once
   * set and when.
   */
  async softDelete(asvId: string): Promise<AppSettingValueDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.appSettingValue.findFirst({
        where: { asvId, asvIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(asvId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const deleted = await tx.appSettingValue.update({
        where: { asvId },
        data: { asvIsDeleted: true, asvModifiedOn: new Date(), asvModifiedBy: actor },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'delete',
          tableName: APP_SETTING_VALUE_TABLE_NAME,
          screenName: APP_SETTING_VALUE_AUDIT_SCREEN_NAME,
          screenType: 'settings',
          pk: asvId,
          displayName: this.displayName(existing),
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload(deleted),
          userId: actor,
          ...(existing.asvBranchId ? { branchId: existing.asvBranchId } : {}),
          notes: `Override reset to the ${existing.asvScope} layer above`,
        },
        tx,
      );
      return { asvId, asvSettingKey: existing.asvSettingKey, deleted: true };
    });
  }

  /**
   * The whole resolved settings object for one caller — GLOBAL < COMPANY <
   * BRANCH < DEVICE < USER, values cast per `asd_data_type`, keys that resolve
   * to nothing omitted.
   *
   * Straight through to `public.fn_app_settings`: the five-layer merge is the
   * database's, so a rule evaluated in SQL and the same rule evaluated in the
   * client cannot disagree. Never reimplement it here.
   */
  async resolve(scope: AppSettingResolveScope): Promise<AppSettingsResolved> {
    const rows = await this.prisma.$queryRaw<Array<{ data: AppSettingsResolved | null }>>`
      SELECT public.fn_app_settings(
        ${scope.companyId ?? null}::uuid,
        ${scope.branchId ?? null}::uuid,
        ${scope.deviceId ?? null}::uuid,
        ${scope.userId ?? null}::uuid) AS data`;
    return rows[0]?.data ?? {};
  }

  /**
   * One setting for one caller, as raw text — the server-side form, for a rule
   * that needs a single answer and will cast it itself.
   *
   * `null` means the setting resolves to nothing, or that there is no such key:
   * to a caller asking "may I do this?", those are the same answer, and
   * distinguishing them is what the catalog endpoints are for.
   */
  async resolveOne(key: string, scope: AppSettingResolveScope): Promise<AppSettingResolvedValue> {
    const rows = await this.prisma.$queryRaw<Array<{ value: string | null }>>`
      SELECT public.fn_app_setting(
        ${key}::varchar,
        ${scope.companyId ?? null}::uuid,
        ${scope.branchId ?? null}::uuid,
        ${scope.deviceId ?? null}::uuid,
        ${scope.userId ?? null}::uuid) AS value`;
    return { key, value: rows[0]?.value ?? null };
  }

  // Create the override, or move the one already sitting on this target. Both
  // halves run inside one transaction with the uniqueness read, so two screens
  // saving the same box at once end on the unique index rather than on two rows.
  private async upsertValue(saveDto: SaveAppSettingValueDto): Promise<AppSettingValuePayload> {
    const asvSettingKey = this.requireField(saveDto.asvSettingKey, 'asvSettingKey');
    const asvScope = this.requireScope(saveDto.asvScope);
    const target = this.resolveTarget(asvScope, saveDto);
    const now = new Date();
    const actor = resolveActor(saveDto.asvCreatedBy, this.requestContextService.getUserId());
    try {
      return await this.prisma.$transaction(async (tx) => {
        const def = await this.loadWritableDef(tx, asvSettingKey);
        this.ensureScopeIsPermitted(asvScope, def);
        await this.ensureTargetExists(tx, target);
        const value = normalizeNullableString(saveDto.asvValue) ?? null;
        this.ensureValueIsAllowed(value, def);

        const existing = await tx.appSettingValue.findFirst({
          where: { asvSettingKey, asvIsDeleted: false, ...target },
        });
        if (existing) {
          return this.applyUpdate(tx, existing, saveDto, value, actor, 'Override updated');
        }
        const created = await tx.appSettingValue.create({
          data: {
            asvSettingKey,
            asvScope,
            ...target,
            asvValue: value,
            asvRemarks: normalizeNullableString(saveDto.asvRemarks) ?? null,
            asvCreatedOn: now,
            asvCreatedBy: actor,
            ...(saveDto.asvSyncDate !== undefined && { asvSyncDate: saveDto.asvSyncDate }),
          },
        });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: APP_SETTING_VALUE_TABLE_NAME,
            screenName: APP_SETTING_VALUE_AUDIT_SCREEN_NAME,
            screenType: 'settings',
            pk: payload.asvId,
            displayName: this.displayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            ...(created.asvBranchId ? { branchId: created.asvBranchId } : {}),
            notes: `${asvScope} override set`,
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AppSettingsErrorDetail>(error, 'Override already exists', [
        {
          field: 'asvScope',
          message: `An override for "${asvSettingKey}" already exists on this ${asvScope} target`,
        },
      ]);
      throw error;
    }
  }

  // Edit one override by id. What it points AT is fixed: pointing an override at
  // a different setting or a different branch is a reset plus a new override,
  // not an edit, and treating it as an edit would move somebody's audit trail
  // onto a target they never set.
  private async updateValue(saveDto: SaveAppSettingValueDto): Promise<AppSettingValuePayload> {
    const asvId = saveDto.asvId!;
    const actor = resolveActor(saveDto.asvModifiedBy, this.requestContextService.getUserId());
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.appSettingValue.findFirst({
        where: { asvId, asvIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(asvId);
      }
      this.ensureTargetIsUnchanged(saveDto, existing);
      const def = await this.loadWritableDef(tx, existing.asvSettingKey);
      // Re-checked on every edit, not only when the scope is sent: asdMaxScope
      // may have been narrowed since this row was written, and a row that can no
      // longer be written is one the caller has to reset rather than edit.
      this.ensureScopeIsPermitted(existing.asvScope as AppSettingScope, def);
      const value =
        saveDto.asvValue !== undefined
          ? (normalizeNullableString(saveDto.asvValue) ?? null)
          : existing.asvValue;
      this.ensureValueIsAllowed(value, def);
      return this.applyUpdate(tx, existing, saveDto, value, actor, 'Override updated');
    });
  }

  private async applyUpdate(
    tx: SettingsWriteClient,
    existing: AppSettingValue,
    saveDto: SaveAppSettingValueDto,
    value: string | null,
    actor: string,
    notes: string,
  ): Promise<AppSettingValuePayload> {
    const data: Prisma.AppSettingValueUncheckedUpdateInput = {
      asvValue: value,
      asvModifiedOn: new Date(),
      asvModifiedBy: actor,
      ...(saveDto.asvRemarks !== undefined && {
        asvRemarks: normalizeNullableString(saveDto.asvRemarks) ?? null,
      }),
      ...(saveDto.asvSyncDate !== undefined && { asvSyncDate: saveDto.asvSyncDate }),
    };
    const updated = await tx.appSettingValue.update({ where: { asvId: existing.asvId }, data });
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: APP_SETTING_VALUE_TABLE_NAME,
        screenName: APP_SETTING_VALUE_AUDIT_SCREEN_NAME,
        screenType: 'settings',
        pk: existing.asvId,
        displayName: this.displayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: actor,
        ...(updated.asvBranchId ? { branchId: updated.asvBranchId } : {}),
        notes,
      },
      tx as Prisma.TransactionClient,
    );
    return payload;
  }

  // The catalog row this override answers to. A retired setting (asdIsActive =
  // false) keeps the overrides it has — they are history — but takes no new
  // ones, which is exactly what tr_asv_check_scope says too.
  private async loadWritableDef(
    tx: SettingsWriteClient,
    asvSettingKey: string,
  ): Promise<AppSettingDef> {
    const def = await tx.appSettingDef.findFirst({
      where: { asdKey: asvSettingKey, asdIsDeleted: false },
    });
    if (!def) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Unknown setting', [
        {
          field: 'asvSettingKey',
          message: `No setting exists with key "${asvSettingKey}"`,
        },
      ]);
    }
    if (!def.asdIsActive) {
      throwSettingsConflict<AppSettingsErrorDetail>('Setting is retired', [
        {
          field: 'asvSettingKey',
          message: `"${asvSettingKey}" has been retired and can no longer be overridden`,
        },
      ]);
    }
    return def;
  }

  private ensureScopeIsPermitted(asvScope: AppSettingScope, def: AppSettingDef): void {
    if (!isScopeWithinMax(asvScope, def.asdMaxScope as AppSettingScope)) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Scope is too deep', [
        {
          field: 'asvScope',
          message:
            `"${def.asdKey}" may not be overridden below ${def.asdMaxScope} scope ` +
            `(asked for ${asvScope})`,
        },
      ]);
    }
  }

  private ensureValueIsAllowed(value: string | null, def: AppSettingDef): void {
    const details = validateSettingValue(
      value,
      {
        asdKey: def.asdKey,
        asdDataType: def.asdDataType as AppSettingDataType,
        asdAllowedValues: toAllowedValues(def.asdAllowedValues),
        asdMinValue: toNullableNumber(def.asdMinValue),
        asdMaxValue: toNullableNumber(def.asdMaxValue),
      },
      'asvValue',
    );
    if (details.length > 0) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Invalid setting value', details);
    }
  }

  /**
   * The four id columns for one scope: the id that scope names, and nulls for
   * the rest.
   *
   * ck_asv_scope_ids allows nothing else, and it matters more than it looks: it
   * is what makes ux_asv_scope_target (which is NULLS NOT DISTINCT) mean "one
   * row per target", and what keeps each layer of the resolver's lookup from
   * matching two rows that disagree.
   */
  private resolveTarget(
    asvScope: AppSettingScope,
    saveDto: SaveAppSettingValueDto,
  ): AppSettingScopeTarget {
    const required = APP_SETTING_SCOPE_ID_FIELD[asvScope];
    const target: AppSettingScopeTarget = {
      asvCompanyId: null,
      asvBranchId: null,
      asvDeviceId: null,
      asvUserId: null,
    };
    const details: AppSettingsErrorDetail[] = [];
    for (const field of APP_SETTING_SCOPE_ID_FIELDS) {
      const supplied = saveDto[field] ?? null;
      if (field === required) {
        if (!supplied) {
          details.push({ field, message: `${field} is required when asvScope is ${asvScope}` });
          continue;
        }
        target[field] = supplied;
        continue;
      }
      if (supplied) {
        details.push({
          field,
          message:
            `${field} must be omitted when asvScope is ${asvScope} — an override carries the id ` +
            'its scope names and nothing else',
        });
      }
    }
    if (details.length > 0) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Invalid scope target', details);
    }
    return target;
  }

  private ensureTargetIsUnchanged(
    saveDto: SaveAppSettingValueDto,
    existing: AppSettingValue,
  ): void {
    const details: AppSettingsErrorDetail[] = [];
    if (saveDto.asvSettingKey && saveDto.asvSettingKey !== existing.asvSettingKey) {
      details.push({
        field: 'asvSettingKey',
        message: `asvSettingKey cannot be changed (stored value is "${existing.asvSettingKey}")`,
      });
    }
    if (saveDto.asvScope && saveDto.asvScope !== (existing.asvScope as AppSettingScope)) {
      details.push({
        field: 'asvScope',
        message: `asvScope cannot be changed (stored value is ${existing.asvScope})`,
      });
    }
    for (const field of APP_SETTING_SCOPE_ID_FIELDS) {
      const supplied = saveDto[field];
      if (supplied !== undefined && (supplied ?? null) !== existing[field]) {
        details.push({
          field,
          message:
            `${field} cannot be changed. Point an override somewhere else by resetting this one ` +
            'and setting the new target',
        });
      }
    }
    if (details.length > 0) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Override target is immutable', details);
    }
  }

  // The FKs are ON DELETE CASCADE, so the row would be accepted and then vanish
  // with whatever it pointed at; checking here means a typo'd id is a 400
  // naming the field rather than a 23503, or worse, a silent no-op later.
  private async ensureTargetExists(
    tx: SettingsWriteClient,
    target: AppSettingScopeTarget,
  ): Promise<void> {
    if (target.asvCompanyId) {
      const company = await tx.company.findFirst({
        where: { compId: target.asvCompanyId, compIsDeleted: false },
        select: { compId: true },
      });
      if (!company) this.throwMissingTarget('asvCompanyId', target.asvCompanyId);
    }
    if (target.asvBranchId) {
      const branch = await tx.branchMaster.findFirst({
        where: { brId: target.asvBranchId, brIsDeleted: false },
        select: { brId: true },
      });
      if (!branch) this.throwMissingTarget('asvBranchId', target.asvBranchId);
    }
    if (target.asvDeviceId) {
      const device = await tx.deviceMaster.findFirst({
        where: { devId: target.asvDeviceId, devIsDeleted: false },
        select: { devId: true },
      });
      if (!device) this.throwMissingTarget('asvDeviceId', target.asvDeviceId);
    }
    if (target.asvUserId) {
      const user = await tx.userMaster.findFirst({
        where: { usrId: target.asvUserId, usrIsDeleted: false },
        select: { usrId: true },
      });
      if (!user) this.throwMissingTarget('asvUserId', target.asvUserId);
    }
  }

  private throwMissingTarget(field: AppSettingScopeIdField, id: string): never {
    throwSettingsBadRequest<AppSettingsErrorDetail>('Scope target does not exist', [
      { field, message: `No active ${SCOPE_ID_LABEL[field]} found with id ${id}` },
    ]);
  }

  private buildListWhere(queryDto: ListAppSettingValueQueryDto): Prisma.AppSettingValueWhereInput {
    const where: Prisma.AppSettingValueWhereInput = { asvIsDeleted: false };
    if (queryDto.asvSettingKey) where.asvSettingKey = queryDto.asvSettingKey;
    if (queryDto.asvScope) where.asvScope = queryDto.asvScope;
    if (queryDto.asvCompanyId) where.asvCompanyId = queryDto.asvCompanyId;
    if (queryDto.asvBranchId) where.asvBranchId = queryDto.asvBranchId;
    if (queryDto.asvDeviceId) where.asvDeviceId = queryDto.asvDeviceId;
    if (queryDto.asvUserId) where.asvUserId = queryDto.asvUserId;
    // Filtering by module reads through the FK rather than duplicating
    // asd_module here — the catalog is the only place a setting's home is
    // stated, and it moves when the catalog says so.
    if (queryDto.asdModule) where.setting = { asdModule: queryDto.asdModule };
    const search = queryDto.search?.trim();
    if (search) {
      where.OR = [
        { asvSettingKey: { contains: search, mode: 'insensitive' } },
        { asvValue: { contains: search, mode: 'insensitive' } },
        { asvRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private hasStructuredFilters(queryDto: ListAppSettingValueQueryDto): boolean {
    return (
      queryDto.asvSettingKey !== undefined ||
      queryDto.asdModule !== undefined ||
      queryDto.asvScope !== undefined ||
      queryDto.asvCompanyId !== undefined ||
      queryDto.asvBranchId !== undefined ||
      queryDto.asvDeviceId !== undefined ||
      queryDto.asvUserId !== undefined
    );
  }

  private requireScope(asvScope: AppSettingScope | undefined): AppSettingScope {
    if (!asvScope) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field: 'asvScope', message: 'asvScope must be provided when setting an override' },
      ]);
    }
    return asvScope;
  }

  private requireField(value: string | undefined, field: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field, message: `${field} must be provided when setting an override` },
      ]);
    }
    return trimmed;
  }

  private displayName(record: AppSettingValue): string {
    const targetId =
      record.asvCompanyId ?? record.asvBranchId ?? record.asvDeviceId ?? record.asvUserId;
    return targetId
      ? `${record.asvSettingKey} @ ${record.asvScope} ${targetId}`
      : `${record.asvSettingKey} @ ${record.asvScope}`;
  }

  private throwNotFound(asvId: string): never {
    throwSettingsNotFound<AppSettingsErrorDetail>(
      'Override not found',
      'asvId',
      `No override found with id ${asvId}`,
    );
  }

  private toPayload(record: AppSettingValue): AppSettingValuePayload {
    return {
      asvId: record.asvId,
      asvSettingKey: record.asvSettingKey,
      asvScope: record.asvScope as AppSettingScope,
      asvCompanyId: record.asvCompanyId,
      asvBranchId: record.asvBranchId,
      asvDeviceId: record.asvDeviceId,
      asvUserId: record.asvUserId,
      asvValue: record.asvValue,
      asvRemarks: record.asvRemarks,
      asvIsDeleted: record.asvIsDeleted,
      asvSyncDate: record.asvSyncDate ? record.asvSyncDate.toISOString() : null,
      asvCreatedOn: record.asvCreatedOn.toISOString(),
      asvCreatedBy: record.asvCreatedBy,
      asvModifiedOn: record.asvModifiedOn ? record.asvModifiedOn.toISOString() : null,
      asvModifiedBy: record.asvModifiedBy,
    };
  }
}
