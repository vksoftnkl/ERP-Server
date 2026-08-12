import { UUID_PATTERN } from 'src/common/dto/DtoTransforms';
import {
  AppSettingDataType,
  AppSettingScope,
  APP_SETTING_DATA_TYPES,
  APP_SETTING_SCOPES,
  APP_SETTING_SCOPE_RANK,
  AppSettingsErrorDetail,
} from './types/app-settings-api.types';

/**
 * The rules one catalog row imposes on a value — the columns
 * `fn_asv_check_scope()` reads before it lets an override through.
 *
 * Both services judge against this shape rather than a Prisma record, because
 * the catalog row being judged against is sometimes the one in the request (a
 * def whose data type is changing) rather than the one in the table.
 */
export interface AppSettingValueRules {
  asdKey: string;
  asdDataType: AppSettingDataType;
  asdAllowedValues: string[] | null;
  asdMinValue: number | null;
  asdMaxValue: number | null;
}

// Postgres' boolean input vocabulary, lower-cased. Written out rather than
// accepting only true/false so a value the DB would take is not refused here.
const BOOL_LITERALS = new Set([
  'true',
  'false',
  't',
  'f',
  'yes',
  'no',
  'y',
  'n',
  'on',
  'off',
  '1',
  '0',
]);
const INT_PATTERN = /^[+-]?\d+$/;
const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
// The canonical date form. Postgres' ::date takes far more than this ('4 Jul
// 2026', 'today'), but a settings value is read back by a client that has to
// parse it too, so the API stores one shape.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Does `value` survive the cast `fn_app_settings` will perform on it?
 *
 * This is the check that matters most in the whole module: the resolver casts
 * blindly (`val::boolean`, `val::bigint`, …) for EVERY caller, so one
 * uncastable value — a default or an override — breaks the settings object for
 * everybody, not just for the row that holds it.
 */
export function isCastableToDataType(value: string, dataType: AppSettingDataType): boolean {
  switch (dataType) {
    case AppSettingDataType.BOOL:
      return BOOL_LITERALS.has(value.trim().toLowerCase());
    case AppSettingDataType.INT:
      return INT_PATTERN.test(value.trim());
    case AppSettingDataType.DECIMAL:
      return DECIMAL_PATTERN.test(value.trim()) && Number.isFinite(Number(value.trim()));
    case AppSettingDataType.UUID:
      return UUID_PATTERN.test(value.trim());
    case AppSettingDataType.DATE:
      return DATE_PATTERN.test(value.trim()) && !Number.isNaN(Date.parse(value.trim()));
    case AppSettingDataType.JSON:
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case AppSettingDataType.TEXT:
    default:
      return true;
  }
}

/**
 * Everything `fn_asv_check_scope()` says about a value, restated so the caller
 * is told which field is wrong instead of being handed a raw 23514 naming a
 * constraint it has never heard of.
 *
 * `null` is always legal — it is the deliberate blank, not a missing value.
 * Returns the details to report; an empty array means the DB will accept it.
 */
export function validateSettingValue(
  value: string | null | undefined,
  rules: AppSettingValueRules,
  field: string,
): AppSettingsErrorDetail[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!isCastableToDataType(value, rules.asdDataType)) {
    return [
      {
        field,
        message: `"${value}" is not a valid ${rules.asdDataType} for setting "${rules.asdKey}"`,
      },
    ];
  }
  const details: AppSettingsErrorDetail[] = [];
  if (rules.asdAllowedValues && !rules.asdAllowedValues.includes(value)) {
    details.push({
      field,
      message:
        `"${value}" is not one of the allowed values for setting "${rules.asdKey}" ` +
        `(${rules.asdAllowedValues.join(', ')})`,
    });
  }
  // Range applies to the numeric types only — the same restriction the trigger
  // makes, so a min/max left on a TEXT row never silently rejects anything.
  if (
    rules.asdDataType === AppSettingDataType.INT ||
    rules.asdDataType === AppSettingDataType.DECIMAL
  ) {
    const numeric = Number(value.trim());
    if (rules.asdMinValue !== null && numeric < rules.asdMinValue) {
      details.push({
        field,
        message: `${numeric} is below the minimum ${rules.asdMinValue} for setting "${rules.asdKey}"`,
      });
    }
    if (rules.asdMaxValue !== null && numeric > rules.asdMaxValue) {
      details.push({
        field,
        message: `${numeric} is above the maximum ${rules.asdMaxValue} for setting "${rules.asdKey}"`,
      });
    }
  }
  return details;
}

/**
 * `asd_allowed_values` as the list it is used as.
 *
 * The column is jsonb and ck_asd_allowed_values only says "an array", but
 * `fn_asv_check_scope` tests membership with `@> to_jsonb(asv_value)` — a JSON
 * STRING — so a non-string member could never match any value and is dropped
 * here rather than being reported as an option nobody can pick.
 */
export function toAllowedValues(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const values = raw.filter((value): value is string => typeof value === 'string');
  return values.length > 0 ? values : null;
}

export function isAppSettingDataType(value: unknown): value is AppSettingDataType {
  return typeof value === 'string' && (APP_SETTING_DATA_TYPES as string[]).includes(value);
}

export function isAppSettingScope(value: unknown): value is AppSettingScope {
  return typeof value === 'string' && (APP_SETTING_SCOPES as string[]).includes(value);
}

// GLOBAL(1) … USER(5). An override may sit at the catalog's asd_max_scope or
// shallower, never deeper.
export function isScopeWithinMax(scope: AppSettingScope, maxScope: AppSettingScope): boolean {
  return APP_SETTING_SCOPE_RANK[scope] <= APP_SETTING_SCOPE_RANK[maxScope];
}
