import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export type AppThemeErrorDetail = ModuleApiErrorDetail;
export type AppThemeErrorResponse = ModuleApiErrorResponse<AppThemeErrorDetail>;
export type AppThemeSuccessResponse<T> = ModuleApiSuccessResponse<T>;
export declare const APP_THEME_TOKENS: {
    readonly primary: "brand colour: buttons, tab underline, title band";
    readonly 'primary.hover': "pressed / hover of primary";
    readonly 'on.primary': "text on primary";
    readonly surface: "dialog / card background";
    readonly 'surface.alt': "page / pane background";
    readonly text: "body text";
    readonly 'text.muted': "hints, captions";
    readonly border: "frames, inputs";
    readonly focus: "focused input border";
    readonly 'title.bg': "entry-form title band";
    readonly 'title.fg': "entry-form title text";
    readonly 'menu.bg': "shell module buttons / menu bar";
    readonly 'menu.fg': "shell module button text";
    readonly 'table.header.bg': "grid header background";
    readonly 'table.header.fg': "grid header text";
    readonly 'table.row': "grid row";
    readonly 'table.row.alt': "alternate grid row";
    readonly 'table.row.hover': "hovered grid row";
    readonly 'table.selected': "selected row in a list";
    readonly 'table.selected.fg': "text of the selected row in a list";
    readonly 'table.txn.selected': "selected line in an entry grid";
    readonly 'table.checked': "ticked row (pick dialogs)";
    readonly 'table.free': "promotion free line";
    readonly danger: "errors, refusals";
    readonly 'danger.bg': "error strip background";
    readonly warning: "warning text";
    readonly 'warning.bg': "warning strip background";
    readonly success: "posted, cleared";
    readonly 'success.bg': "success strip background";
    readonly info: "badges, hints";
    readonly 'info.bg': "info strip background";
    readonly 'rate.below': "rate moved below the price list";
    readonly 'rate.above': "rate moved above the price list";
    readonly 'primary.soft': "hover background of buttons and list items";
    readonly 'primary.softer': "hover background of the master-list action buttons";
    readonly 'primary.soft.border': "border of a hovered button or list item";
    readonly 'primary.pressed.bg': "pressed background of the master-list action buttons";
    readonly 'primary.pressed.border': "border of a pressed button";
};
export type AppThemeTokenKey = keyof typeof APP_THEME_TOKENS;
export declare const APP_THEME_TOKEN_KEYS: AppThemeTokenKey[];
export declare const APP_THEME_SIZE_KEYS: readonly ["size.font", "size.icon", "size.header"];
export declare const APP_THEME_TEMPLATE_MAX_BYTES: number;
export declare const APP_THEME_COLOUR_PATTERN: RegExp;
export declare const APP_THEME_BASES: readonly ["LIGHT", "DARK"];
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
    usedByCount: number;
    thmModifiedOn: string | null;
}
export interface AppThemeEffectivePayload extends AppThemePayload {
    resolvedFrom: 'COMPANY' | 'DEFAULT';
}
export interface AppThemeDeleteResult {
    thmId: number;
    deleted: boolean;
}
export interface AppThemeTemplatePayload {
    tplId: number;
    tplName: string;
    tplQss: string;
    tplRemarks: string | null;
    tplModifiedOn: string;
    placeholders: string[];
}
export interface AppThemeTemplateRef {
    tplId: number;
    tplQss: string;
    tplModifiedOn: string;
}
export interface AppThemeEffectiveWithTemplate extends AppThemeEffectivePayload {
    template: AppThemeTemplateRef | null;
}
export interface AppThemeBootstrapPayload {
    tokens: Record<string, string>;
    thmModifiedOn: string | null;
    template: AppThemeTemplateRef | null;
}
