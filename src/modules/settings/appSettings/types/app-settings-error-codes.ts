/**
 * Notes 119 / 127 §5 — every refusal the App Settings module raises
 * (`/app-settings/*`: the per-company / branch / counter / user overrides of a
 * setting).
 *
 * `code` is what the Qt client words the box by, and the wording rows in
 * prisma/seed/Error_Messages.json are keyed on it, so every string below is an
 * API contract: rename one and the box loses its wording. Never reuse one for
 * a different meaning — add a new member instead. `field` (`data[i].asvValue`)
 * says which box of a batch save it is about.
 */
export enum AppSettingsErrorCode {
  /** No live override has that asvId (update, reset). */
  OVERRIDE_NOT_FOUND = 'APP_SETTING_OVERRIDE_NOT_FOUND',
  /** An override for this setting already exists on this target (two saves at once) — reload and save again. */
  OVERRIDE_EXISTS = 'APP_SETTING_OVERRIDE_EXISTS',
  /** A field an override needs was not sent: asvScope, asvSettingKey. */
  FIELD_REQUIRED = 'APP_SETTING_FIELD_REQUIRED',
  /** No setting exists with that key. */
  UNKNOWN_KEY = 'APP_SETTING_UNKNOWN_KEY',
  /** The setting has been retired and takes no new overrides. */
  RETIRED = 'APP_SETTING_RETIRED',
  /** The setting may not be overridden at a scope this deep (company / branch / counter / user). */
  SCOPE_TOO_DEEP = 'APP_SETTING_SCOPE_TOO_DEEP',
  /** The id the scope names (company, branch, counter or user) was not sent. */
  TARGET_ID_REQUIRED = 'APP_SETTING_TARGET_ID_REQUIRED',
  /** An id the scope does not name was sent — an override carries its own scope's id and nothing else. */
  TARGET_ID_NOT_ALLOWED = 'APP_SETTING_TARGET_ID_NOT_ALLOWED',
  /** The company, branch, counter or user named does not exist (or is deleted). */
  TARGET_NOT_FOUND = 'APP_SETTING_TARGET_NOT_FOUND',
  /** An edit tried to change an override's setting, scope or target — reset it and set a new one. */
  TARGET_IMMUTABLE = 'APP_SETTING_TARGET_IMMUTABLE',
  /** The value is not of the setting's data type (a number, a date, true/false …). */
  VALUE_WRONG_TYPE = 'APP_SETTING_VALUE_WRONG_TYPE',
  /** The value is not one of the setting's allowed values. */
  VALUE_NOT_ALLOWED = 'APP_SETTING_VALUE_NOT_ALLOWED',
  /** The value is below the setting's minimum. */
  VALUE_BELOW_MIN = 'APP_SETTING_VALUE_BELOW_MIN',
  /** The value is above the setting's maximum. */
  VALUE_ABOVE_MAX = 'APP_SETTING_VALUE_ABOVE_MAX',
}
