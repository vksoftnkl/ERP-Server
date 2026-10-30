/**
 * Notes 119 / 127 §5 — every refusal the App Theme module raises
 * (`/app-themes/*`: the colour themes and the one stylesheet template).
 *
 * The prefix is THM_ because the module already answered with THM_RIGHT_* (the
 * menu-rights check, `assertMenuRight` with codePrefix 'THM'), and one module
 * keeps one prefix.
 *
 * `code` is what the Qt client words the box by, and the wording rows in
 * prisma/seed/Error_Messages.json are keyed on it, so every string below is an
 * API contract: rename one and the box loses its wording. Never reuse one for
 * a different meaning — add a new member instead.
 */
export enum AppThemeErrorCode {
  // ─── Rights (raised by assertMenuRight with codePrefix 'THM') ────────────
  /** The user may not create app themes on this menu. */
  RIGHT_CREATE = 'THM_RIGHT_CREATE',
  /** The user may not edit (or restore) app themes, or edit the template. */
  RIGHT_EDIT = 'THM_RIGHT_EDIT',
  /** The user may not delete app themes. */
  RIGHT_DELETE = 'THM_RIGHT_DELETE',

  // ─── Themes ──────────────────────────────────────────────────────────────
  /** No app theme has that thmId. */
  NOT_FOUND = 'THM_NOT_FOUND',
  /** The company asked about does not exist (or is deleted). */
  COMPANY_NOT_FOUND = 'THM_COMPANY_NOT_FOUND',
  /** No live theme is marked default (a seed defect). */
  NO_DEFAULT = 'THM_NO_DEFAULT',
  /** Another live theme already has this name. */
  NAME_TAKEN = 'THM_NAME_TAKEN',
  /** Editing a deleted theme — restore it first. */
  DELETED = 'THM_DELETED',
  /** thmIsDefault = false on the default theme — make another theme the default instead. */
  DEFAULT_STAYS_DEFAULT = 'THM_DEFAULT_STAYS_DEFAULT',
  /** The default theme saved as inactive. */
  DEFAULT_MUST_BE_ACTIVE = 'THM_DEFAULT_MUST_BE_ACTIVE',
  /** Another request made a different theme the default at the same moment — save again. */
  DEFAULT_MOVED = 'THM_DEFAULT_MOVED',
  /** Delete of a theme that is already deleted. */
  ALREADY_DELETED = 'THM_ALREADY_DELETED',
  /** Delete of the default theme. */
  DEFAULT_UNDELETABLE = 'THM_DEFAULT_UNDELETABLE',
  /** Delete of a theme a live company still uses. */
  IN_USE = 'THM_IN_USE',
  /** Restore of a theme that is not deleted. */
  NOT_DELETED = 'THM_NOT_DELETED',
  /** A key in `tokens` is not one of the colour tokens. */
  TOKEN_UNKNOWN = 'THM_TOKEN_UNKNOWN',
  /** A token's value is not #rrggbb or #rrggbbaa. */
  TOKEN_NOT_COLOUR = 'THM_TOKEN_NOT_COLOUR',
  /** thmBase is not LIGHT or DARK. */
  BASE_INVALID = 'THM_BASE_INVALID',

  // ─── The stylesheet template ─────────────────────────────────────────────
  /** No live, active template exists (a seed defect). */
  TEMPLATE_MISSING = 'THM_TEMPLATE_MISSING',
  /** No template has that tplId. */
  TEMPLATE_NOT_FOUND = 'THM_TEMPLATE_NOT_FOUND',
  /** The template saved is not the active one clients apply. */
  TEMPLATE_NOT_ACTIVE = 'THM_TEMPLATE_NOT_ACTIVE',
  /** Someone saved the template after this copy was loaded — reload and apply the edit again. */
  TEMPLATE_CHANGED = 'THM_TEMPLATE_CHANGED',
  /** tplQss is larger than the size limit. */
  TEMPLATE_TOO_LARGE = 'THM_TEMPLATE_TOO_LARGE',
  /** tplQss uses a {{placeholder}} that is not a token key or size. */
  TEMPLATE_PLACEHOLDER_UNKNOWN = 'THM_TEMPLATE_PLACEHOLDER_UNKNOWN',
  /** tplQss opens a comment that is never closed. */
  TEMPLATE_OPEN_COMMENT = 'THM_TEMPLATE_OPEN_COMMENT',
  /** tplQss has a { that is never closed or a } that closes nothing. */
  TEMPLATE_BRACES_UNBALANCED = 'THM_TEMPLATE_BRACES_UNBALANCED',
  /** tplQss has a url(...) that is not a :/ resource. */
  TEMPLATE_URL_NOT_RESOURCE = 'THM_TEMPLATE_URL_NOT_RESOURCE',
}
