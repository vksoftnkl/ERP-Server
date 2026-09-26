"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscPRenderer = void 0;
const common_1 = require("@nestjs/common");
const grid_renderer_base_1 = require("./grid-renderer.base");
const ESC = 0x1b;
const FF = 0x0c;
const CR = 0x0d;
const LF = 0x0a;
const SI = 0x0f;
const DC2 = 0x12;
const DEFAULT_COMMANDS = {
    init: Buffer.from([ESC, 0x40]),
    draft: Buffer.from([ESC, 0x78, 0x00]),
    letterQuality: Buffer.from([ESC, 0x78, 0x01]),
    pitch10: Buffer.from([ESC, 0x50]),
    pitch12: Buffer.from([ESC, 0x4d]),
    pitch15: Buffer.from([ESC, 0x67]),
    condensedOn: Buffer.from([SI]),
    condensedOff: Buffer.from([DC2]),
    boldOn: Buffer.from([ESC, 0x45]),
    boldOff: Buffer.from([ESC, 0x46]),
    underlineOn: Buffer.from([ESC, 0x2d, 0x01]),
    underlineOff: Buffer.from([ESC, 0x2d, 0x00]),
    doubleWidthOn: Buffer.from([ESC, 0x57, 0x01]),
    doubleWidthOff: Buffer.from([ESC, 0x57, 0x00]),
    lineFeed: Buffer.from([CR, LF]),
    formFeed: Buffer.from([FF]),
    reset: Buffer.from([ESC, 0x40]),
};
const DEFAULT_COLUMNS = 80;
const DEFAULT_FORM_LINES = 66;
let EscPRenderer = class EscPRenderer extends grid_renderer_base_1.GridRendererBase {
    outputMode = 'ESCP_DOTMATRIX';
    async render(tree, options = {}) {
        const startedAt = Date.now();
        await Promise.resolve();
        const profile = options.printerProfile ?? null;
        const columns = this.resolveColumns(tree, profile);
        const codepage = this.resolveCodepage(profile);
        const commands = mergeCommands(profile);
        const warnings = new Set(tree.warnings.map((warning) => `${warning.kind}: ${warning.message}${warning.detail ? ` (${warning.detail})` : ''}`));
        const chunks = [];
        chunks.push(commands.init);
        chunks.push(commands.draft);
        chunks.push(this.pitchCommand(commands, profile, columns, warnings));
        const formLines = tree.paper.rows ?? DEFAULT_FORM_LINES;
        chunks.push(Buffer.from([ESC, 0x43, Math.min(127, Math.max(1, Math.round(formLines)))]));
        tree.pages.forEach((page, pageIndex) => {
            const { canvas, warnings: pageWarnings } = this.toCanvas(page, columns, codepage);
            for (const warning of pageWarnings) {
                warnings.add(warning);
            }
            const rows = canvas.allRuns();
            rows.forEach((runs) => {
                chunks.push(this.encodeRow(runs, commands, codepage, profile));
                chunks.push(commands.lineFeed);
            });
            if (pageIndex < tree.pages.length - 1) {
                chunks.push(commands.formFeed);
            }
        });
        chunks.push(commands.reset);
        const bytes = Buffer.concat(chunks);
        const durationMs = Date.now() - startedAt;
        this.logger.log(`ESC/P rendered: ${tree.pageCount} page(s), ${columns} columns, ${bytes.length} bytes, ${durationMs}ms`);
        return {
            bytes,
            contentType: 'application/octet-stream',
            extension: 'prn',
            pageCount: tree.pageCount,
            durationMs,
            warnings: [...warnings],
        };
    }
    defaultColumns() {
        return DEFAULT_COLUMNS;
    }
    onGraphicPrimitive(primitive, warnings) {
        warnings.add(`A ${primitive.k} element was skipped: dot-matrix output is text mode only, and ` +
            'graphics mode would make the print unusably slow. Print the value as text instead.');
    }
    pitchCommand(commands, profile, columns, warnings) {
        const cpi = profile?.cpi ?? inferCpi(columns);
        switch (cpi) {
            case 10:
                if (columns > 80) {
                    warnings.add(`The profile asks for 10 CPI but the layout is ${columns} columns wide; ` +
                        'at 10 CPI only 80 fit on 9.5in stationery and the rest will wrap.');
                }
                return commands.pitch10;
            case 12:
                return commands.pitch12;
            case 15:
                return Buffer.concat([commands.pitch10, commands.condensedOn]);
            default:
                warnings.add(`Unsupported pitch ${cpi} CPI; falling back to 10 CPI.`);
                return commands.pitch10;
        }
    }
    encodeRow(runs, commands, codepage, profile) {
        if (runs.length === 0) {
            return Buffer.alloc(0);
        }
        const parts = [];
        let cursorColumn = 0;
        let boldOn = false;
        let underlineOn = false;
        let doubleWidthOn = false;
        const cpi = profile?.cpi ?? 10;
        const unitsPerColumn = Math.round(60 / cpi);
        for (const run of runs) {
            if (run.col > cursorColumn) {
                const units = run.col * unitsPerColumn;
                parts.push(Buffer.from([ESC, 0x24, units & 0xff, (units >> 8) & 0xff]));
            }
            const wantBold = run.style.bold && (profile?.supportsBold ?? true);
            const wantUnderline = run.style.underline && (profile?.supportsUnderline ?? true);
            const wantDoubleWidth = run.style.doubleWidth;
            if (wantBold !== boldOn) {
                parts.push(wantBold ? commands.boldOn : commands.boldOff);
                boldOn = wantBold;
            }
            if (wantUnderline !== underlineOn) {
                parts.push(wantUnderline ? commands.underlineOn : commands.underlineOff);
                underlineOn = wantUnderline;
            }
            if (wantDoubleWidth !== doubleWidthOn) {
                parts.push(wantDoubleWidth ? commands.doubleWidthOn : commands.doubleWidthOff);
                doubleWidthOn = wantDoubleWidth;
            }
            parts.push(codepage.encode(run.text).bytes);
            cursorColumn = run.col + [...run.text].length;
        }
        if (boldOn) {
            parts.push(commands.boldOff);
        }
        if (underlineOn) {
            parts.push(commands.underlineOff);
        }
        if (doubleWidthOn) {
            parts.push(commands.doubleWidthOff);
        }
        return Buffer.concat(parts);
    }
};
exports.EscPRenderer = EscPRenderer;
exports.EscPRenderer = EscPRenderer = __decorate([
    (0, common_1.Injectable)()
], EscPRenderer);
const mergeCommands = (profile) => {
    if (!profile?.commands) {
        return DEFAULT_COMMANDS;
    }
    return { ...DEFAULT_COMMANDS, ...profile.commands };
};
const inferCpi = (columns) => {
    if (columns <= 80) {
        return 10;
    }
    if (columns <= 96) {
        return 12;
    }
    return 15;
};
//# sourceMappingURL=escp.renderer.js.map