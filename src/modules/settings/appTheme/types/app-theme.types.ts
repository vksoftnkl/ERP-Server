import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';

export type AppThemeErrorDetail = ModuleApiErrorDetail;
export type AppThemeErrorResponse = ModuleApiErrorResponse<AppThemeErrorDetail>;
export type AppThemeSuccessResponse<T> = ModuleApiSuccessResponse<T>;

/**
 * The v1 colour tokens (theme/plan-app-theme.md §2.3) — the ONE list both
 * clients and the API agree on. A theme row may omit any of them (the client's
 * compiled default applies); it may not carry a key outside this list, and
 * every value is `#rrggbb` or `#rrggbbaa`.
 *
 * Exported as a plain constant so the React client can import it for its
 * editor; the value of each entry is what the key MEANS, for the Theme master
 * screen's token grid.
 */
export const APP_THEME_TOKENS = {
  primary: 'brand colour: buttons, tab underline, title band',
  'primary.hover': 'pressed / hover of primary',
  'on.primary': 'text on primary',
  surface: 'dialog / card background',
  'surface.alt': 'page / pane background',
  text: 'body text',
  'text.muted': 'hints, captions',
  border: 'frames, inputs',
  focus: 'focused input border',
  'title.bg': 'entry-form title band',
  'title.fg': 'entry-form title text',
  'menu.bg': 'shell module buttons / menu bar',
  'menu.fg': 'shell module button text',
  'table.header.bg': 'grid header background',
  'table.header.fg': 'grid header text',
  'table.row': 'grid row',
  'table.row.alt': 'alternate grid row',
  'table.row.hover': 'hovered grid row',
  'table.selected': 'selected row in a list',
  'table.selected.fg': 'text of the selected row in a list',
  'table.txn.selected': 'selected line in an entry grid',
  'table.checked': 'ticked row (pick dialogs)',
  'table.free': 'promotion free line',
  danger: 'errors, refusals',
  'danger.bg': 'error strip background',
  warning: 'warning text',
  'warning.bg': 'warning strip background',
  success: 'posted, cleared',
  'success.bg': 'success strip background',
  info: 'badges, hints',
  'info.bg': 'info strip background',
  'rate.below': 'rate moved below the price list',
  'rate.above': 'rate moved above the price list',
} as const;

export type AppThemeTokenKey = keyof typeof APP_THEME_TOKENS;
export const APP_THEME_TOKEN_KEYS = Object.keys(APP_THEME_TOKENS) as AppThemeTokenKey[];

/** `#rrggbb` or `#rrggbbaa` — the same rule as ck_thm_tokens. */
export const APP_THEME_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

export const APP_THEME_BASES = ['LIGHT', 'DARK'] as const;
export type AppThemeBase = (typeof APP_THEME_BASES)[number];

export interface AppThemePayload {
  thmId: number;
  thmName: string;
  thmBase: string;
  thmIsDefault: boolean;
  thmIsActive: boolean;
  thmIsDeleted: boolean;
  thmRemarks: string | null;
  tokens: Record<string, string>;
  /** Live companies whose comp_stylesheet_id is this theme. */
  usedByCount: number;
  thmModifiedOn: string | null;
}

/** /app-themes/effective: the theme a company is painted in, and why. */
export interface AppThemeEffectivePayload extends AppThemePayload {
  /** COMPANY = the company's own choice; DEFAULT = it has none, or a dead one. */
  resolvedFrom: 'COMPANY' | 'DEFAULT';
}

export interface AppThemeDeleteResult {
  thmId: number;
  deleted: boolean;
}
