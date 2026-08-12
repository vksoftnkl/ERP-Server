import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';

export type AppSettingsErrorDetail = ModuleApiErrorDetail;
export type AppSettingsErrorResponse = ModuleApiErrorResponse<AppSettingsErrorDetail>;
export type AppSettingsSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type AppSettingsListMeta = ModuleListMeta;

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

export const APP_SETTING_DATA_TYPES = Object.values(AppSettingDataType);
export const APP_SETTING_SCOPES = Object.values(AppSettingScope);

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

// ck_asd_key — dotted, lowercase, module-prefixed ('sales.max_discount_percent').
export const APP_SETTING_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

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

// One catalog row: a setting that exists, whatever anybody has set it to.
export interface AppSettingDefPayload {
  asdId: string;
  asdKey: string;
  asdModule: string;
  asdGroup: string;
  asdDataType: AppSettingDataType;
  asdDefaultValue: string | null;
  // A jsonb array of the legal values for an enum-ish TEXT setting; null = free
  // text. Members are compared against asv_value as strings.
  asdAllowedValues: string[] | null;
  asdMinValue: number | null;
  asdMaxValue: number | null;
  asdMaxScope: AppSettingScope;
  asdLabel: string;
  asdDescription: string | null;
  asdSortOrder: number;
  asdIsActive: boolean;
  asdNeedsRelogin: boolean;
  asdIsDeleted: boolean;
  asdSyncDate: string | null;
  asdCreatedOn: string;
  asdCreatedBy: string;
  asdModifiedOn: string | null;
  asdModifiedBy: string | null;
}

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

// A configured grid answers with its own column set, so a list row is either the
// module's payload or whatever the grid SQL selected.
export type AppSettingDefListItem = AppSettingDefPayload | Record<string, unknown>;
export type AppSettingValueListItem = AppSettingValuePayload | Record<string, unknown>;

export interface AppSettingDefDeleteResult {
  asdId: string;
  deleted: true;
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

// The whole resolved object, keyed by asdKey, cast per asd_data_type: BOOL to a
// boolean, INT / DECIMAL to a number, JSON to the object itself, everything else
// to a string. Keys resolving to nothing are absent rather than null.
export type AppSettingsResolved = Record<string, unknown>;

// One resolved setting, as raw text. The caller casts — it is the rule that
// knows whether it wanted a boolean or a numeric. null = resolves to nothing,
// or no such key, which for a caller checking a rule is the same answer.
export interface AppSettingResolvedValue {
  key: string;
  value: string | null;
}
