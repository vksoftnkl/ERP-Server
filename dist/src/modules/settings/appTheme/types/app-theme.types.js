"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_THEME_BASES = exports.APP_THEME_COLOUR_PATTERN = exports.APP_THEME_TOKEN_KEYS = exports.APP_THEME_TOKENS = void 0;
exports.APP_THEME_TOKENS = {
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
};
exports.APP_THEME_TOKEN_KEYS = Object.keys(exports.APP_THEME_TOKENS);
exports.APP_THEME_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
exports.APP_THEME_BASES = ['LIGHT', 'DARK'];
//# sourceMappingURL=app-theme.types.js.map