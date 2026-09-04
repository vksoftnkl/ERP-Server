import { Injectable } from '@nestjs/common';
import { AppSettingDef, AppSettingValue, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
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
import { SaveAppSettingValueDto } from './dto/save-app-setting-value.dto';
import { isScopeWithinMax, toAllowedValues, validateSettingValue } from './app-settings.validation';
import {
  APP_SETTING_SCOPE_ID_FIELD,
  APP_SETTING_SCOPE_ID_FIELDS,
  AppSettingDataType,
  AppSettingEffectiveItem,
  AppSettingResolveScope,
  AppSettingScope,
  AppSettingSource,
  AppSettingScopeIdField,
  AppSettingScopeTarget,
  AppSettingValueDeleteResult,
  AppSettingValuePayload,
  AppSettingsErrorDetail,
} from './types/app-settings-api.types';

/**
 * One row of `public.fn_app_settings_effective`, verbatim.
 *
 * The `out_` prefixes are the function's own output parameter names — a SQL
 * function whose OUT columns are called `asd_key` cannot also read `asd_key`
 * from its tables without ambiguity, so they are prefixed at the source and
 * unprefixed here in `toEffectiveItem`.
 */
interface AppSettingEffectiveRow {
  out_asd_id: string;
  out_asd_key: string;
  out_asd_module: string;
  out_asd_group: string;
  out_asd_data_type: string;
  out_asd_default_value: string | null;
  out_asd_allowed_values: unknown;
  out_asd_min_value: Prisma.Decimal | null;
  out_asd_max_value: Prisma.Decimal | null;
  out_asd_max_scope: string;
  out_asd_label: string;
  out_asd_description: string | null;
  out_asd_sort_order: number;
  out_asd_needs_relogin: boolean;
  // Null throughout when the catalog default stands.
  out_asv_id: string | null;
  out_asv_scope: string | null;
  out_asv_company_id: string | null;
  out_asv_branch_id: string | null;
  out_asv_device_id: string | null;
  out_asv_user_id: string | null;
  out_asv_value: string | null;
  out_asv_remarks: string | null;
  out_asv_sync_date: Date | null;
  out_asv_created_on: Date | null;
  out_asv_created_by: string | null;
  out_asv_modified_on: Date | null;
  out_asv_modified_by: string | null;
  out_effective_value: string | null;
  out_source: string;
}

const APP_SETTING_VALUE_TABLE_NAME = 'app setting value';
const APP_SETTING_VALUE_AUDIT_SCREEN_NAME = 'App Settings';

// One save is one transaction over the whole array, and each entry reads the
// catalog and its scope target before it writes — room for a page of settings
// without the 5s default cutting a legitimate batch short.
const APP_SETTING_VALUE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

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
 * Writes over `public.app_setting_value` — the OVERRIDES — plus the read that
 * answers what a setting actually comes to for one caller.
 *
 * A row exists here only where somebody changed something. Four things follow
 * from that, and they are the whole shape of this service:
 *
 *  - **Saving takes an ARRAY**, in one transaction. A settings screen saves a
 *    page of boxes, and all-or-nothing is the only answer a screen can act on:
 *    a half-applied page would leave the client unable to say which half took.
 *  - **Saving is an upsert**, keyed on (setting, scope target) rather than on
 *    an id. That is what ux_asv_scope_target means by "one row per target", and
 *    it is what a settings screen means by Save: the second save of the same
 *    box moves the row it wrote the first time instead of colliding with it.
 *  - **Resetting is a DELETE**, never a write of the default. The row goes and
 *    the layer above takes over again; writing the default value instead would
 *    freeze today's default into a permanent override that stops tracking it.
 *  - **Reading goes to `fn_app_settings_effective`**, not to a merge written
 *    here. The precedence lives in one place so the client and the server-side
 *    rules cannot drift apart.
 */
@Injectable()
export class AppSettingValueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  /**
   * Save a batch of overrides — the write path, and the only one.
   *
   * The payload is an ARRAY because a settings screen saves a page of boxes
   * rather than one box, and the whole array is ONE transaction: one bad entry
   * saves none of them, so a page can never be left half-applied with the
   * client unable to say which half took.
   *
   * Entries are independent otherwise — each creates (no `asvId`, upsert on its
   * scope target) or edits in place (`asvId`) by its own rules — and two
   * entries naming the same target are the second one winning, the same answer
   * as saving twice. Errors name the entry they came from (`data[2].asvValue`).
   */
  async save(saveDtos: SaveAppSettingValueDto[]): Promise<AppSettingValuePayload[]> {
    return this.prisma.$transaction(async (tx) => {
      const payloads: AppSettingValuePayload[] = [];
      for (const [index, saveDto] of saveDtos.entries()) {
        payloads.push(await this.saveOne(tx, saveDto, index));
      }
      return payloads;
    }, APP_SETTING_VALUE_TRANSACTION_OPTIONS);
  }

  private async saveOne(
    tx: SettingsWriteClient,
    saveDto: SaveAppSettingValueDto,
    index: number,
  ): Promise<AppSettingValuePayload> {
    try {
      return saveDto.asvId
        ? await this.updateValue(tx, saveDto, index)
        : await this.upsertValue(tx, saveDto, index);
    } catch (error: unknown) {
      // The read-then-write inside upsertValue is not atomic on its own; two
      // screens saving the same box at once end here, on ux_asv_scope_target.
      throwOnUniqueConstraintError<AppSettingsErrorDetail>(error, 'Override already exists', [
        {
          field: this.fieldPath(index, 'asvScope'),
          message:
            `An override for "${saveDto.asvSettingKey}" already exists on this ` +
            `${saveDto.asvScope} target`,
        },
      ]);
      throw error;
    }
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
          // The audit vocabulary is insert / update / approve / cancel — a soft
          // delete is a 'cancel', the same word every other module uses for it.
          action: 'cancel',
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
   * Every live setting as it stands for one caller: the override row where one
   * matched, the catalog row where none did, and the value the two come to.
   *
   * This is the read path — what to DRAW and what to APPLY in one answer: the
   * label, type and bounds to render a control, `override.asvId` to edit or
   * reset it, and the scope it was set at, so a screen can say "40%, set on
   * this branch" and offer Reset.
   *
   * A setting resolving to nothing is still returned, with `value: null`: an
   * empty box has to be drawn before it can be filled.
   *
   * The precedence is `public.fn_app_settings_effective` — GLOBAL < COMPANY <
   * BRANCH < DEVICE < USER — which `fn_app_settings` is itself built on, so a
   * rule evaluated in SQL and the same rule evaluated in the client cannot
   * drift apart. Never reimplement the merge here.
   */
  async resolveEffective(scope: AppSettingResolveScope): Promise<AppSettingEffectiveItem[]> {
    const rows = await this.prisma.$queryRaw<AppSettingEffectiveRow[]>`
      SELECT *
      FROM public.fn_app_settings_effective(
        ${scope.companyId ?? null}::uuid,
        ${scope.branchId ?? null}::uuid,
        ${scope.deviceId ?? null}::uuid,
        ${scope.userId ?? null}::uuid)`;
    return rows.map((row) => this.toEffectiveItem(row));
  }

  private toEffectiveItem(row: AppSettingEffectiveRow): AppSettingEffectiveItem {
    return {
      asdId: row.out_asd_id,
      asdKey: row.out_asd_key,
      asdModule: row.out_asd_module,
      asdGroup: row.out_asd_group,
      asdLabel: row.out_asd_label,
      asdDescription: row.out_asd_description,
      asdDataType: row.out_asd_data_type as AppSettingDataType,
      asdDefaultValue: row.out_asd_default_value,
      asdAllowedValues: toAllowedValues(row.out_asd_allowed_values),
      asdMinValue: toNullableNumber(row.out_asd_min_value),
      asdMaxValue: toNullableNumber(row.out_asd_max_value),
      asdMaxScope: row.out_asd_max_scope as AppSettingScope,
      asdSortOrder: row.out_asd_sort_order,
      asdNeedsRelogin: row.out_asd_needs_relogin,
      source: row.out_source as AppSettingSource,
      value: row.out_effective_value,
      // Keyed on the id, not on the value: an override that blanks a setting
      // has a null value and must still come back as an override, or the screen
      // would offer no way to undo it.
      override:
        row.out_asv_id === null
          ? null
          : {
              asvId: row.out_asv_id,
              asvScope: row.out_asv_scope as AppSettingScope,
              asvCompanyId: row.out_asv_company_id,
              asvBranchId: row.out_asv_branch_id,
              asvDeviceId: row.out_asv_device_id,
              asvUserId: row.out_asv_user_id,
              asvValue: row.out_asv_value,
              asvRemarks: row.out_asv_remarks,
              asvSyncDate: row.out_asv_sync_date ? row.out_asv_sync_date.toISOString() : null,
              asvCreatedOn: row.out_asv_created_on!.toISOString(),
              asvCreatedBy: row.out_asv_created_by!,
              asvModifiedOn: row.out_asv_modified_on ? row.out_asv_modified_on.toISOString() : null,
              asvModifiedBy: row.out_asv_modified_by,
            },
    };
  }

  // Create the override, or move the one already sitting on this target. The
  // uniqueness read shares the batch's transaction, so an entry that finds no
  // row and the row it then writes cannot be separated by another save.
  private async upsertValue(
    tx: SettingsWriteClient,
    saveDto: SaveAppSettingValueDto,
    index: number,
  ): Promise<AppSettingValuePayload> {
    const asvSettingKey = this.requireField(saveDto.asvSettingKey, 'asvSettingKey', index);
    const asvScope = this.requireScope(saveDto.asvScope, index);
    const target = this.resolveTarget(asvScope, saveDto, index);
    const now = new Date();
    const actor = resolveActor(saveDto.asvCreatedBy, this.requestContextService.getUserId());
    const def = await this.loadWritableDef(tx, asvSettingKey, index);
    this.ensureScopeIsPermitted(asvScope, def, index);
    await this.ensureTargetExists(tx, target, index);
    const value = normalizeNullableString(saveDto.asvValue) ?? null;
    this.ensureValueIsAllowed(value, def, index);

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
      tx as Prisma.TransactionClient,
    );
    return payload;
  }

  // Edit one override by id. What it points AT is fixed: pointing an override at
  // a different setting or a different branch is a reset plus a new override,
  // not an edit, and treating it as an edit would move somebody's audit trail
  // onto a target they never set.
  private async updateValue(
    tx: SettingsWriteClient,
    saveDto: SaveAppSettingValueDto,
    index: number,
  ): Promise<AppSettingValuePayload> {
    const asvId = saveDto.asvId!;
    const actor = resolveActor(saveDto.asvModifiedBy, this.requestContextService.getUserId());
    const existing = await tx.appSettingValue.findFirst({
      where: { asvId, asvIsDeleted: false },
    });
    if (!existing) {
      this.throwNotFound(asvId, index);
    }
    this.ensureTargetIsUnchanged(saveDto, existing, index);
    const def = await this.loadWritableDef(tx, existing.asvSettingKey, index);
    // Re-checked on every edit, not only when the scope is sent: asdMaxScope
    // may have been narrowed since this row was written, and a row that can no
    // longer be written is one the caller has to reset rather than edit.
    this.ensureScopeIsPermitted(existing.asvScope as AppSettingScope, def, index);
    const value =
      saveDto.asvValue !== undefined
        ? (normalizeNullableString(saveDto.asvValue) ?? null)
        : existing.asvValue;
    this.ensureValueIsAllowed(value, def, index);
    return this.applyUpdate(tx, existing, saveDto, value, actor, 'Override updated');
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
    index: number,
  ): Promise<AppSettingDef> {
    const def = await tx.appSettingDef.findFirst({
      where: { asdKey: asvSettingKey, asdIsDeleted: false },
    });
    if (!def) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Unknown setting', [
        {
          field: this.fieldPath(index, 'asvSettingKey'),
          message: `No setting exists with key "${asvSettingKey}"`,
        },
      ]);
    }
    if (!def.asdIsActive) {
      throwSettingsConflict<AppSettingsErrorDetail>('Setting is retired', [
        {
          field: this.fieldPath(index, 'asvSettingKey'),
          message: `"${asvSettingKey}" has been retired and can no longer be overridden`,
        },
      ]);
    }
    return def;
  }

  private ensureScopeIsPermitted(
    asvScope: AppSettingScope,
    def: AppSettingDef,
    index: number,
  ): void {
    if (!isScopeWithinMax(asvScope, def.asdMaxScope as AppSettingScope)) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Scope is too deep', [
        {
          field: this.fieldPath(index, 'asvScope'),
          message:
            `"${def.asdKey}" may not be overridden below ${def.asdMaxScope} scope ` +
            `(asked for ${asvScope})`,
        },
      ]);
    }
  }

  private ensureValueIsAllowed(value: string | null, def: AppSettingDef, index: number): void {
    const details = validateSettingValue(
      value,
      {
        asdKey: def.asdKey,
        asdDataType: def.asdDataType as AppSettingDataType,
        asdAllowedValues: toAllowedValues(def.asdAllowedValues),
        asdMinValue: toNullableNumber(def.asdMinValue),
        asdMaxValue: toNullableNumber(def.asdMaxValue),
      },
      this.fieldPath(index, 'asvValue'),
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
    index: number,
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
          details.push({
            field: this.fieldPath(index, field),
            message: `${field} is required when asvScope is ${asvScope}`,
          });
          continue;
        }
        target[field] = supplied;
        continue;
      }
      if (supplied) {
        details.push({
          field: this.fieldPath(index, field),
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
    index: number,
  ): void {
    const details: AppSettingsErrorDetail[] = [];
    if (saveDto.asvSettingKey && saveDto.asvSettingKey !== existing.asvSettingKey) {
      details.push({
        field: this.fieldPath(index, 'asvSettingKey'),
        message: `asvSettingKey cannot be changed (stored value is "${existing.asvSettingKey}")`,
      });
    }
    if (saveDto.asvScope && saveDto.asvScope !== (existing.asvScope as AppSettingScope)) {
      details.push({
        field: this.fieldPath(index, 'asvScope'),
        message: `asvScope cannot be changed (stored value is ${existing.asvScope})`,
      });
    }
    for (const field of APP_SETTING_SCOPE_ID_FIELDS) {
      const supplied = saveDto[field];
      if (supplied !== undefined && (supplied ?? null) !== existing[field]) {
        details.push({
          field: this.fieldPath(index, field),
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
    index: number,
  ): Promise<void> {
    if (target.asvCompanyId) {
      const company = await tx.company.findFirst({
        where: { compId: target.asvCompanyId, compIsDeleted: false },
        select: { compId: true },
      });
      if (!company) this.throwMissingTarget('asvCompanyId', target.asvCompanyId, index);
    }
    if (target.asvBranchId) {
      const branch = await tx.branchMaster.findFirst({
        where: { brId: target.asvBranchId, brIsDeleted: false },
        select: { brId: true },
      });
      if (!branch) this.throwMissingTarget('asvBranchId', target.asvBranchId, index);
    }
    if (target.asvDeviceId) {
      const device = await tx.deviceMaster.findFirst({
        where: { devId: target.asvDeviceId, devIsDeleted: false },
        select: { devId: true },
      });
      if (!device) this.throwMissingTarget('asvDeviceId', target.asvDeviceId, index);
    }
    if (target.asvUserId) {
      const user = await tx.userMaster.findFirst({
        where: { usrId: target.asvUserId, usrIsDeleted: false },
        select: { usrId: true },
      });
      if (!user) this.throwMissingTarget('asvUserId', target.asvUserId, index);
    }
  }

  private throwMissingTarget(field: AppSettingScopeIdField, id: string, index: number): never {
    throwSettingsBadRequest<AppSettingsErrorDetail>('Scope target does not exist', [
      {
        field: this.fieldPath(index, field),
        message: `No active ${SCOPE_ID_LABEL[field]} found with id ${id}`,
      },
    ]);
  }

  private requireScope(asvScope: AppSettingScope | undefined, index: number): AppSettingScope {
    if (!asvScope) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        {
          field: this.fieldPath(index, 'asvScope'),
          message: 'asvScope must be provided when setting an override',
        },
      ]);
    }
    return asvScope;
  }

  private requireField(value: string | undefined, field: string, index: number): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        {
          field: this.fieldPath(index, field),
          message: `${field} must be provided when setting an override`,
        },
      ]);
    }
    return trimmed;
  }

  // Which entry of the array the complaint is about. A batch save answers for a
  // page of boxes, and "asvValue is above the maximum" alone would not say which
  // box the screen has to put the message on.
  private fieldPath(index: number, field: string): string {
    return `data[${index}].${field}`;
  }

  private displayName(record: AppSettingValue): string {
    const targetId =
      record.asvCompanyId ?? record.asvBranchId ?? record.asvDeviceId ?? record.asvUserId;
    return targetId
      ? `${record.asvSettingKey} @ ${record.asvScope} ${targetId}`
      : `${record.asvSettingKey} @ ${record.asvScope}`;
  }

  // `index` is absent on the delete path, which names one row and not an entry
  // of a batch.
  private throwNotFound(asvId: string, index?: number): never {
    throwSettingsNotFound<AppSettingsErrorDetail>(
      'Override not found',
      index === undefined ? 'asvId' : this.fieldPath(index, 'asvId'),
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
