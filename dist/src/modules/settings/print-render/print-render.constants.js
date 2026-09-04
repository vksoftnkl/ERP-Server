"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACC_YEAR_PATTERN = exports.MAX_COPIES = exports.RENDER_COPY_TIMEOUT_MS = exports.RENDER_TIMEOUT_MS = exports.PLG_STATUSES = exports.PLG_OUTPUT_MODES = exports.IMPLEMENTED_RENDERERS = exports.LAYOUT_MODE_FOR_RENDERER = exports.RENDERER_FOR_LAYOUT_MODE = exports.RENDERER_FOR_OUTPUT_MODE = exports.LAYOUT_MODE_FOR_ENGINE = exports.RENDERABLE_ENGINES = exports.PRINT_RENDER_SCREEN_NAME = void 0;
exports.PRINT_RENDER_SCREEN_NAME = 'Print Render';
exports.RENDERABLE_ENGINES = ['JSON_BANDS', 'ESCPOS_TEXT'];
exports.LAYOUT_MODE_FOR_ENGINE = {
    JSON_BANDS: 'GRAPHIC',
    ESCPOS_TEXT: 'GRID',
};
exports.RENDERER_FOR_OUTPUT_MODE = {
    PRINT: 'BY_LAYOUT',
    PREVIEW: 'PDF',
    PDF: 'PDF',
    EMAIL: 'PDF',
    WHATSAPP: 'PDF',
    ESCPOS: 'ESCPOS',
};
exports.RENDERER_FOR_LAYOUT_MODE = {
    GRAPHIC: 'PDF',
    GRID: 'ESCPOS',
};
exports.LAYOUT_MODE_FOR_RENDERER = {
    PDF: 'GRAPHIC',
    HTML: 'GRAPHIC',
    ESCPOS: 'GRID',
    ESCP_DOTMATRIX: 'GRID',
};
exports.IMPLEMENTED_RENDERERS = ['PDF', 'ESCPOS', 'ESCP_DOTMATRIX'];
exports.PLG_OUTPUT_MODES = ['PRINT', 'PREVIEW', 'EMAIL', 'FILE', 'REPRINT'];
exports.PLG_STATUSES = ['SUCCESS', 'FAILED', 'QUEUED', 'CANCELLED'];
exports.RENDER_TIMEOUT_MS = 30_000;
exports.RENDER_COPY_TIMEOUT_MS = 15_000;
exports.MAX_COPIES = 10;
exports.ACC_YEAR_PATTERN = /^[0-9]{4}-[0-9]{4}$/;
//# sourceMappingURL=print-render.constants.js.map