import { Injectable } from '@nestjs/common';
import { AppSettingDef, Prisma } from '@prisma/client';
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
import { ListAppSettingDefQueryDto } from './dto/list-app-setting-def-query.dto';
import { SaveAppSettingDefDto } from './dto/save-app-setting-def.dto';
import {
  AppSettingValueRules,
  isCastableToDataType,
  isScopeWithinMax,
  toAllowedValues,
  validateSettingValue,
} from './app-settings.validation';
import {
  APP_SETTING_KEY_PATTERN,
  AppSettingDataType,
  AppSettingDefDeleteResult,
  AppSettingDefListItem,
  AppSettingDefPayload,
  AppSettingScope,
  AppSettingsErrorDetail,
  AppSettingsListMeta,
} from './types/app-settings-api.types';

const APP_SETTING_DEF_TABLE_NAME = 'app setting def';
const APP_SETTING_DEF_AUDIT_SCREEN_NAME = 'App Settings';
const APP_SETTING_DEF_GRID_ALIAS = 'app_setting_def_grid';

/**
 * CRUD over `public.app_setting_def` — the CATALOG: one row per configurable
 * setting, forever. Adding a setting to the product is an INSERT here; there is
 * no DDL and no client release behind it.
 *
 * Two rules shape everything below, and neither is something the database can
 * state on its own:
 *
 *  - **A key is never renamed.** Overrides point at `asd_key`, not at the id,
 *    so renaming one would strand every override that names it. Retire the row
 *    (`asdIsActive = false`) and add a new key instead.
 *  - **The catalog decides what an override may say.** `asd_data_type`,
 *    `asd_allowed_values` and the min/max are what `tr_asv_check_scope` judges
 *    a value against, and `fn_app_settings` casts by. So loosening them is
 *    free, and TIGHTENING them — or changing the type — is refused while a
 *    stored value would stop passing: one uncastable value breaks the resolved
 *    settings object for every caller, not just for the row that holds it.
 */
@Injectable()
export class AppSettingDefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveDto: SaveAppSettingDefDto): Promise<AppSettingDefPayload> {
    if (saveDto.asdId) {
      return this.updateDef(saveDto);
    }
    return this.createDef(saveDto);
  }

  async list(
    queryDto: ListAppSettingDefQueryDto,
  ): Promise<ConfiguredGridListResult<AppSettingDefListItem, AppSettingsListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where = this.buildListWhere(queryDto);
    return runSettingsListQuery(
      { page, limit },
      {
        // A configured grid runs its own stored SQL and knows nothing about
        // these filters, so a filtered request has to take the Prisma path or
        // it would silently answer with the unfiltered catalog.
        hasStructuredFilters: this.hasStructuredFilters(queryDto),
        configuredGridFn: () =>
          runConfiguredGridQuery<AppSettingDefListItem>(this.configuredGridSqlService, {
            tableName: APP_SETTING_DEF_TABLE_NAME,
            alias: APP_SETTING_DEF_GRID_ALIAS,
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.appSettingDef.count({ where }),
        findManyFn: () =>
          this.prisma.appSettingDef.findMany({
            where,
            // The order the settings screen draws its tree in — the same one
            // ix_asd_module is built on.
            orderBy: [
              { asdModule: 'asc' },
              { asdGroup: 'asc' },
              { asdSortOrder: 'asc' },
              { asdKey: 'asc' },
            ],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(asdId: string): Promise<AppSettingDefPayload> {
    const record = await this.prisma.appSettingDef.findFirst({
      where: { asdId, asdIsDeleted: false },
    });
    if (!record) {
      this.throwNotFound('asdId', asdId);
    }
    return this.toPayload(record);
  }

  async getByKey(asdKey: string): Promise<AppSettingDefPayload> {
    const record = await this.prisma.appSettingDef.findFirst({
      where: { asdKey, asdIsDeleted: false },
    });
    if (!record) {
      this.throwNotFound('asdKey', asdKey);
    }
    return this.toPayload(record);
  }

  /**
   * Soft delete — for a setting that should never have existed.
   *
   * A setting anybody has actually SET is retired instead (`asdIsActive =
   * false`): its overrides stay on the record, no new one may be written, and
   * the resolver stops answering with it. Deleting one would leave those
   * override rows pointing at a catalog row nothing can read — which is also
   * why fk_asv_setting is ON DELETE RESTRICT — so this refuses rather than
   * quietly orphaning them.
   */
  async softDelete(asdId: string): Promise<AppSettingDefDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.appSettingDef.findFirst({
        where: { asdId, asdIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound('asdId', asdId);
      }
      const liveOverrides = await tx.appSettingValue.count({
        where: { asvSettingKey: existing.asdKey, asvIsDeleted: false },
      });
      if (liveOverrides > 0) {
        throwSettingsConflict<AppSettingsErrorDetail>('Setting is in use', [
          {
            field: 'asdKey',
            message:
              `${liveOverrides} override(s) still point at "${existing.asdKey}". Reset them ` +
              'first, or retire the setting instead by saving it with asdIsActive = false',
          },
        ]);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const deleted = await tx.appSettingDef.update({
        where: { asdId },
        data: { asdIsDeleted: true, asdModifiedOn: new Date(), asdModifiedBy: actor },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'delete',
          tableName: APP_SETTING_DEF_TABLE_NAME,
          screenName: APP_SETTING_DEF_AUDIT_SCREEN_NAME,
          screenType: 'settings',
          pk: asdId,
          displayName: existing.asdKey,
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload(deleted),
          userId: actor,
          notes: 'Setting soft deleted',
        },
        tx,
      );
      return { asdId, deleted: true };
    });
  }

  private async createDef(saveDto: SaveAppSettingDefDto): Promise<AppSettingDefPayload> {
    const now = new Date();
    const actor = resolveActor(saveDto.asdCreatedBy, this.requestContextService.getUserId());
    const asdKey = this.requireKey(saveDto.asdKey);
    const asdModule = this.requireField(saveDto.asdModule, 'asdModule');
    const asdLabel = this.requireField(saveDto.asdLabel, 'asdLabel');
    const asdDataType = this.requireDataType(saveDto.asdDataType);
    const asdMaxScope = saveDto.asdMaxScope ?? AppSettingScope.COMPANY;
    const allowedValues = this.normalizeAllowedValues(saveDto.asdAllowedValues);
    const minValue = saveDto.asdMinValue ?? null;
    const maxValue = saveDto.asdMaxValue ?? null;
    const defaultValue = normalizeNullableString(saveDto.asdDefaultValue) ?? null;
    this.ensureShapeIsCoherent({
      asdKey,
      asdDataType,
      asdAllowedValues: allowedValues,
      asdMinValue: minValue,
      asdMaxValue: maxValue,
      asdDefaultValue: defaultValue,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureKeyIsFree(tx, asdKey);
        const data: Prisma.AppSettingDefUncheckedCreateInput = {
          asdKey,
          asdModule,
          asdDataType,
          asdLabel,
          asdMaxScope,
          asdDefaultValue: defaultValue,
          asdAllowedValues: allowedValues === null ? Prisma.DbNull : allowedValues,
          asdMinValue: minValue,
          asdMaxValue: maxValue,
          asdDescription: normalizeNullableString(saveDto.asdDescription) ?? null,
          asdCreatedOn: now,
          asdCreatedBy: actor,
          ...(saveDto.asdGroup !== undefined && { asdGroup: saveDto.asdGroup }),
          ...(saveDto.asdSortOrder !== undefined && { asdSortOrder: saveDto.asdSortOrder }),
          ...(saveDto.asdIsActive !== undefined && { asdIsActive: saveDto.asdIsActive }),
          ...(saveDto.asdNeedsRelogin !== undefined && {
            asdNeedsRelogin: saveDto.asdNeedsRelogin,
          }),
          ...(saveDto.asdSyncDate !== undefined && { asdSyncDate: saveDto.asdSyncDate }),
        };
        const created = await tx.appSettingDef.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: APP_SETTING_DEF_TABLE_NAME,
            screenName: APP_SETTING_DEF_AUDIT_SCREEN_NAME,
            screenType: 'settings',
            pk: payload.asdId,
            displayName: payload.asdKey,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Setting created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AppSettingsErrorDetail>(error, 'Setting key already exists', [
        { field: 'asdKey', message: `A setting with key "${asdKey}" already exists` },
      ]);
      throw error;
    }
  }

  private async updateDef(saveDto: SaveAppSettingDefDto): Promise<AppSettingDefPayload> {
    const asdId = saveDto.asdId!;
    const actor = resolveActor(saveDto.asdModifiedBy, this.requestContextService.getUserId());
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.appSettingDef.findFirst({
        where: { asdId, asdIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound('asdId', asdId);
      }
      this.ensureKeyIsUnchanged(saveDto, existing);

      // The merged row is what the rules will be judged on: a request that
      // changes only the type is still judged against the stored allowed values
      // and bounds, and vice versa.
      const nextDataType = saveDto.asdDataType ?? (existing.asdDataType as AppSettingDataType);
      const nextAllowed =
        saveDto.asdAllowedValues !== undefined
          ? this.normalizeAllowedValues(saveDto.asdAllowedValues)
          : this.readAllowedValues(existing);
      const nextMin =
        saveDto.asdMinValue !== undefined
          ? saveDto.asdMinValue
          : toNullableNumber(existing.asdMinValue);
      const nextMax =
        saveDto.asdMaxValue !== undefined
          ? saveDto.asdMaxValue
          : toNullableNumber(existing.asdMaxValue);
      const nextDefault =
        saveDto.asdDefaultValue !== undefined
          ? (normalizeNullableString(saveDto.asdDefaultValue) ?? null)
          : existing.asdDefaultValue;
      const nextMaxScope = saveDto.asdMaxScope ?? (existing.asdMaxScope as AppSettingScope);
      this.ensureShapeIsCoherent({
        asdKey: existing.asdKey,
        asdDataType: nextDataType,
        asdAllowedValues: nextAllowed,
        asdMinValue: nextMin,
        asdMaxValue: nextMax,
        asdDefaultValue: nextDefault,
      });
      await this.ensureStoredOverridesStillPass(tx, existing, {
        asdKey: existing.asdKey,
        asdDataType: nextDataType,
        asdAllowedValues: nextAllowed,
        asdMinValue: nextMin,
        asdMaxValue: nextMax,
      });
      await this.ensureNoOverrideIsDeeperThan(tx, existing, nextMaxScope);

      const data: Prisma.AppSettingDefUncheckedUpdateInput = {
        asdModifiedOn: new Date(),
        asdModifiedBy: actor,
        ...(saveDto.asdModule !== undefined && { asdModule: saveDto.asdModule }),
        ...(saveDto.asdGroup !== undefined && { asdGroup: saveDto.asdGroup }),
        ...(saveDto.asdLabel !== undefined && { asdLabel: saveDto.asdLabel }),
        ...(saveDto.asdDescription !== undefined && {
          asdDescription: normalizeNullableString(saveDto.asdDescription) ?? null,
        }),
        ...(saveDto.asdSortOrder !== undefined && { asdSortOrder: saveDto.asdSortOrder }),
        ...(saveDto.asdIsActive !== undefined && { asdIsActive: saveDto.asdIsActive }),
        ...(saveDto.asdNeedsRelogin !== undefined && { asdNeedsRelogin: saveDto.asdNeedsRelogin }),
        ...(saveDto.asdSyncDate !== undefined && { asdSyncDate: saveDto.asdSyncDate }),
        ...(saveDto.asdDataType !== undefined && { asdDataType: nextDataType }),
        ...(saveDto.asdMaxScope !== undefined && { asdMaxScope: nextMaxScope }),
        ...(saveDto.asdDefaultValue !== undefined && { asdDefaultValue: nextDefault }),
        ...(saveDto.asdMinValue !== undefined && { asdMinValue: nextMin }),
        ...(saveDto.asdMaxValue !== undefined && { asdMaxValue: nextMax }),
        ...(saveDto.asdAllowedValues !== undefined && {
          asdAllowedValues: nextAllowed === null ? Prisma.DbNull : nextAllowed,
        }),
      };
      const updated = await tx.appSettingDef.update({ where: { asdId }, data });
      const payload = this.toPayload(updated);
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: APP_SETTING_DEF_TABLE_NAME,
          screenName: APP_SETTING_DEF_AUDIT_SCREEN_NAME,
          screenType: 'settings',
          pk: asdId,
          displayName: payload.asdKey,
          originalRecord: this.toPayload(existing),
          modifiedRecord: payload,
          userId: actor,
          notes:
            existing.asdIsActive && payload.asdIsActive === false
              ? 'Setting retired'
              : 'Setting updated',
        },
        tx,
      );
      return payload;
    });
  }

  // ux_app_setting_def_key covers EVERY row, soft-deleted ones included — the
  // index is not partial on asd_is_deleted, deliberately: a retired key must
  // stay taken so nothing can bring it back meaning something else while old
  // overrides still name it.
  private async ensureKeyIsFree(tx: SettingsWriteClient, asdKey: string): Promise<void> {
    const existing = await tx.appSettingDef.findFirst({
      where: { asdKey },
      select: { asdId: true, asdIsDeleted: true },
    });
    if (!existing) {
      return;
    }
    throwSettingsConflict<AppSettingsErrorDetail>('Setting key already exists', [
      {
        field: 'asdKey',
        message: existing.asdIsDeleted
          ? `A deleted setting still holds the key "${asdKey}". Keys are never reused — pick a new one`
          : `A setting with key "${asdKey}" already exists`,
      },
    ]);
  }

  private ensureKeyIsUnchanged(saveDto: SaveAppSettingDefDto, existing: AppSettingDef): void {
    if (saveDto.asdKey && saveDto.asdKey !== existing.asdKey) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Setting key is immutable', [
        {
          field: 'asdKey',
          message:
            `asdKey cannot be changed (stored value is "${existing.asdKey}"). Overrides point at ` +
            'the key, so renaming one would strand them — retire this setting and add a new key',
        },
      ]);
    }
  }

  /**
   * Is the catalog row internally consistent? These are the CHECK constraints
   * (ck_asd_key, ck_asd_data_type, ck_asd_max_scope, ck_asd_range,
   * ck_asd_allowed_values) plus the one rule the DB cannot make: THE DEFAULT
   * ITSELF MUST BE READABLE.
   *
   * Nothing in Postgres validates `asd_default_value` against
   * `asd_data_type` — and `fn_app_settings` casts it for every caller who has
   * not overridden the setting, so a default of 'abc' on an INT row does not
   * break that row, it breaks the whole settings object for everybody.
   */
  private ensureShapeIsCoherent(shape: {
    asdKey: string;
    asdDataType: AppSettingDataType;
    asdAllowedValues: string[] | null;
    asdMinValue: number | null;
    asdMaxValue: number | null;
    asdDefaultValue: string | null;
  }): void {
    const details: AppSettingsErrorDetail[] = [];
    if (
      shape.asdMinValue !== null &&
      shape.asdMaxValue !== null &&
      shape.asdMinValue > shape.asdMaxValue
    ) {
      details.push({
        field: 'asdMinValue',
        message: `asdMinValue (${shape.asdMinValue}) cannot be above asdMaxValue (${shape.asdMaxValue})`,
      });
    }
    // An allowed value that will not cast can never be chosen, so it is a typo
    // in the catalog rather than a rule.
    for (const allowed of shape.asdAllowedValues ?? []) {
      if (!isCastableToDataType(allowed, shape.asdDataType)) {
        details.push({
          field: 'asdAllowedValues',
          message: `"${allowed}" is not a valid ${shape.asdDataType}, so it could never be chosen`,
        });
      }
    }
    details.push(
      ...validateSettingValue(
        shape.asdDefaultValue,
        {
          asdKey: shape.asdKey,
          asdDataType: shape.asdDataType,
          asdAllowedValues: shape.asdAllowedValues,
          asdMinValue: shape.asdMinValue,
          asdMaxValue: shape.asdMaxValue,
        },
        'asdDefaultValue',
      ),
    );
    if (details.length > 0) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Invalid setting definition', details);
    }
  }

  // Tightening the rules is only safe if what is already stored still passes
  // them. Checked before the write, and reported in full rather than one row at
  // a time, so the caller can see everything that stands in the way.
  private async ensureStoredOverridesStillPass(
    tx: SettingsWriteClient,
    existing: AppSettingDef,
    rules: AppSettingValueRules,
  ): Promise<void> {
    const unchanged =
      rules.asdDataType === (existing.asdDataType as AppSettingDataType) &&
      JSON.stringify(rules.asdAllowedValues) === JSON.stringify(this.readAllowedValues(existing)) &&
      rules.asdMinValue === toNullableNumber(existing.asdMinValue) &&
      rules.asdMaxValue === toNullableNumber(existing.asdMaxValue);
    if (unchanged) {
      return;
    }
    const stored = await tx.appSettingValue.findMany({
      where: { asvSettingKey: existing.asdKey, asvIsDeleted: false, asvValue: { not: null } },
      select: { asvId: true, asvScope: true, asvValue: true },
    });
    const details: AppSettingsErrorDetail[] = [];
    for (const override of stored) {
      const failures = validateSettingValue(override.asvValue, rules, 'asdDataType');
      for (const failure of failures) {
        details.push({
          field: 'asdDataType',
          message: `${override.asvScope} override ${override.asvId}: ${failure.message}`,
        });
      }
    }
    if (details.length > 0) {
      throwSettingsConflict<AppSettingsErrorDetail>(
        'Stored overrides would stop being readable',
        details,
      );
    }
  }

  // Lowering asd_max_scope cannot orphan an override that is already deeper
  // than the new limit: tr_asv_check_scope would keep refusing every future
  // write to it, and the row would sit there unfixable.
  private async ensureNoOverrideIsDeeperThan(
    tx: SettingsWriteClient,
    existing: AppSettingDef,
    nextMaxScope: AppSettingScope,
  ): Promise<void> {
    if (nextMaxScope === (existing.asdMaxScope as AppSettingScope)) {
      return;
    }
    const stored = await tx.appSettingValue.findMany({
      where: { asvSettingKey: existing.asdKey, asvIsDeleted: false },
      select: { asvId: true, asvScope: true },
    });
    const tooDeep = stored.filter(
      (override) => !isScopeWithinMax(override.asvScope as AppSettingScope, nextMaxScope),
    );
    if (tooDeep.length > 0) {
      throwSettingsConflict<AppSettingsErrorDetail>('Overrides are deeper than the new limit', [
        {
          field: 'asdMaxScope',
          message:
            `${tooDeep.length} override(s) sit below ${nextMaxScope} scope ` +
            `(${tooDeep.map((override) => `${override.asvScope} ${override.asvId}`).join(', ')}). ` +
            'Reset them before narrowing asdMaxScope',
        },
      ]);
    }
  }

  private buildListWhere(queryDto: ListAppSettingDefQueryDto): Prisma.AppSettingDefWhereInput {
    const where: Prisma.AppSettingDefWhereInput = { asdIsDeleted: false };
    if (queryDto.asdModule) where.asdModule = queryDto.asdModule;
    if (queryDto.asdGroup) where.asdGroup = queryDto.asdGroup;
    if (queryDto.asdKey) where.asdKey = queryDto.asdKey;
    if (queryDto.asdDataType) where.asdDataType = queryDto.asdDataType;
    if (queryDto.asdMaxScope) where.asdMaxScope = queryDto.asdMaxScope;
    if (queryDto.asdIsActive !== undefined) where.asdIsActive = queryDto.asdIsActive;
    if (queryDto.asdNeedsRelogin !== undefined) where.asdNeedsRelogin = queryDto.asdNeedsRelogin;
    const search = queryDto.search?.trim();
    if (search) {
      where.OR = [
        { asdKey: { contains: search, mode: 'insensitive' } },
        { asdLabel: { contains: search, mode: 'insensitive' } },
        { asdDescription: { contains: search, mode: 'insensitive' } },
        { asdModule: { contains: search, mode: 'insensitive' } },
        { asdGroup: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private hasStructuredFilters(queryDto: ListAppSettingDefQueryDto): boolean {
    return (
      queryDto.asdModule !== undefined ||
      queryDto.asdGroup !== undefined ||
      queryDto.asdKey !== undefined ||
      queryDto.asdDataType !== undefined ||
      queryDto.asdMaxScope !== undefined ||
      queryDto.asdIsActive !== undefined ||
      queryDto.asdNeedsRelogin !== undefined
    );
  }

  private requireKey(asdKey: string | undefined): string {
    const key = asdKey?.trim();
    if (!key) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field: 'asdKey', message: 'asdKey must be provided when creating a setting' },
      ]);
    }
    if (!APP_SETTING_KEY_PATTERN.test(key)) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        {
          field: 'asdKey',
          message:
            'asdKey must be dotted, lowercase and module-prefixed, e.g. ' +
            '"sales.max_discount_percent"',
        },
      ]);
    }
    return key;
  }

  private requireDataType(asdDataType: AppSettingDataType | undefined): AppSettingDataType {
    if (!asdDataType) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field: 'asdDataType', message: 'asdDataType must be provided when creating a setting' },
      ]);
    }
    return asdDataType;
  }

  private requireField(value: string | undefined, field: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throwSettingsBadRequest<AppSettingsErrorDetail>('Validation failed', [
        { field, message: `${field} must be provided when creating a setting` },
      ]);
    }
    return trimmed;
  }

  // An empty array would mean "no value is legal", which is never what a caller
  // means — it is how they spell "drop the restriction".
  private normalizeAllowedValues(values: string[] | null | undefined): string[] | null {
    if (values === undefined || values === null) {
      return null;
    }
    const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  }

  private readAllowedValues(record: AppSettingDef): string[] | null {
    return toAllowedValues(record.asdAllowedValues);
  }

  private throwNotFound(field: string, value: string): never {
    throwSettingsNotFound<AppSettingsErrorDetail>(
      'Setting not found',
      field,
      `No setting found with ${field} ${value}`,
    );
  }

  private toPayload(record: AppSettingDef): AppSettingDefPayload {
    return {
      asdId: record.asdId,
      asdKey: record.asdKey,
      asdModule: record.asdModule,
      asdGroup: record.asdGroup,
      asdDataType: record.asdDataType as AppSettingDataType,
      asdDefaultValue: record.asdDefaultValue,
      asdAllowedValues: this.readAllowedValues(record),
      asdMinValue: toNullableNumber(record.asdMinValue),
      asdMaxValue: toNullableNumber(record.asdMaxValue),
      asdMaxScope: record.asdMaxScope as AppSettingScope,
      asdLabel: record.asdLabel,
      asdDescription: record.asdDescription,
      asdSortOrder: record.asdSortOrder,
      asdIsActive: record.asdIsActive,
      asdNeedsRelogin: record.asdNeedsRelogin,
      asdIsDeleted: record.asdIsDeleted,
      asdSyncDate: record.asdSyncDate ? record.asdSyncDate.toISOString() : null,
      asdCreatedOn: record.asdCreatedOn.toISOString(),
      asdCreatedBy: record.asdCreatedBy,
      asdModifiedOn: record.asdModifiedOn ? record.asdModifiedOn.toISOString() : null,
      asdModifiedBy: record.asdModifiedBy,
    };
  }
}
