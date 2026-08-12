import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';

export type AppSettingsErrorDetail = ModuleApiErrorDetail;
export type AppSettingsErrorResponse = ModuleApiErrorResponse<AppSettingsErrorDetail>;
export type AppSettingsSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

// The enum-shaped columns, member for member with the CHECK constraints in
// migration 20260812120000_add_app_settings. Both columns are plain varchars —
// nothing here is a native PG enum — so the constraint is the authority and
// these sets are what the application checks FIRST, to answer a 400 naming the
// field instead of a raw Postgres 23514. Keep them in step with the DDL.

// ck_asd_data_type — how asd_default_value / asv_value are read back out.
// Everything is STORED as text; the resolver casts on the way out, which is
// why a value that will not cast has to be refused at write time.
export enum AppSettingDataType {
  BOOL = 'BOOL',
  INT = 'INT',
  DECIMAL = 'DECIMAL',
  TEXT = 'TEXT',
  UUID = 'UUID',
  DATE = 'DATE',
  JSON = 'JSON',
}

// ck_asd_max_scope / ck_asv_scope — the five layers, shallowest first.
export enum AppSettingScope {
  GLOBAL = 'GLOBAL',
  COMPANY = 'COMPANY',
  BRANCH = 'BRANCH',
  DEVICE = 'DEVICE',
  USER = 'USER',
}

// Precedence. A setting may be overridden at this depth or SHALLOWER, never
// deeper: asd_max_scope = COMPANY means GLOBAL and COMPANY rows are legal and a
// per-user one is not. tr_asv_check_scope enforces it in the DB — it needs the
// catalog row, so no CHECK can — and the service restates it to name the field.
export const APP_SETTING_SCOPE_RANK: Record<AppSettingScope, number> = {
  [AppSettingScope.GLOBAL]: 1,
  [AppSettingScope.COMPANY]: 2,
  [AppSettingScope.BRANCH]: 3,
  [AppSettingScope.DEVICE]: 4,
  [AppSettingScope.USER]: 5,
};

// ck_asv_scope_ids — an override row carries the id its scope names and NOTHING
// else, which is what makes ux_asv_scope_target "one row per (setting, target)"
// and every layer of the resolver's lookup unambiguous.
export const APP_SETTING_SCOPE_ID_FIELDS = [
  'asvCompanyId',
  'asvBranchId',
  'asvDeviceId',
  'asvUserId',
] as const;
export type AppSettingScopeIdField = (typeof APP_SETTING_SCOPE_ID_FIELDS)[number];
export const APP_SETTING_SCOPE_ID_FIELD: Record<AppSettingScope, AppSettingScopeIdField | null> = {
  [AppSettingScope.GLOBAL]: null,
  [AppSettingScope.COMPANY]: 'asvCompanyId',
  [AppSettingScope.BRANCH]: 'asvBranchId',
  [AppSettingScope.DEVICE]: 'asvDeviceId',
  [AppSettingScope.USER]: 'asvUserId',
};

// The four id columns of one override row. Exactly one is set — or none, for a
// GLOBAL row.
export type AppSettingScopeTarget = Record<AppSettingScopeIdField, string | null>;

// One override. asvValue is null-able on purpose: null is "explicitly nothing"
// (the resolver omits the key), which is NOT the same as having no row at all
// ("inherit the layer above").
export interface AppSettingValuePayload {
  asvId: string;
  asvSettingKey: string;
  asvScope: AppSettingScope;
  asvCompanyId: string | null;
  asvBranchId: string | null;
  asvDeviceId: string | null;
  asvUserId: string | null;
  asvValue: string | null;
  asvRemarks: string | null;
  asvIsDeleted: boolean;
  asvSyncDate: string | null;
  asvCreatedOn: string;
  asvCreatedBy: string;
  asvModifiedOn: string | null;
  asvModifiedBy: string | null;
}

// A reset, not a removal: the override goes away and the layer above takes over
// again. asv_is_deleted is what ux_asv_scope_target is partial on, so the slot
// is free for a new override immediately.
export interface AppSettingValueDeleteResult {
  asvId: string;
  asvSettingKey: string;
  deleted: true;
}

// Who is asking. Every id is optional — a layer with no id simply never
// matches, so a caller that knows only its company resolves GLOBAL + COMPANY.
export interface AppSettingResolveScope {
  companyId?: string | null;
  branchId?: string | null;
  deviceId?: string | null;
  userId?: string | null;
}

// Where the effective value came from. Read from the ROW's existence, never
// from the value: an override that deliberately blanks a setting is still an
// override, and a screen has to offer Reset on it.
export enum AppSettingSource {
  OVERRIDE = 'OVERRIDE',
  DEFAULT = 'DEFAULT',
}

/**
 * One live setting as it stands for one caller: the catalog row, the override
 * row that won (null when the default stands), and the value the two come to.
 *
 * This is the read view, and it is editable: the label and bounds to render a
 * control, the `asvId` to edit or reset, and the scope the value was set at. A
 * setting resolving to nothing still appears here, with `value: null`.
 */
export interface AppSettingEffectiveItem {
  asdId: string;
  asdKey: string;
  asdModule: string;
  asdGroup: string;
  asdLabel: string;
  asdDescription: string | null;
  asdDataType: AppSettingDataType;
  asdDefaultValue: string | null;
  asdAllowedValues: string[] | null;
  asdMinValue: number | null;
  asdMaxValue: number | null;
  asdMaxScope: AppSettingScope;
  asdSortOrder: number;
  asdNeedsRelogin: boolean;
  source: AppSettingSource;
  // Raw text, as stored — the client casts by asdDataType, which comes back
  // beside it.
  value: string | null;
  // The winning override row, in the same shape /create answers with, so the
  // client can hand it straight back to /create or /delete. Its audit columns
  // say who set the value and when.
  override: AppSettingEffectiveOverride | null;
}

// The winning override. Everything but asvIsDeleted, which is false by
// definition — a reset row never wins anything.
export interface AppSettingEffectiveOverride {
  asvId: string;
  asvScope: AppSettingScope;
  asvCompanyId: string | null;
  asvBranchId: string | null;
  asvDeviceId: string | null;
  asvUserId: string | null;
  asvValue: string | null;
  asvRemarks: string | null;
  asvSyncDate: string | null;
  asvCreatedOn: string;
  asvCreatedBy: string;
  asvModifiedOn: string | null;
  asvModifiedBy: string | null;
}
