"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscPosRenderer = void 0;
const common_1 = require("@nestjs/common");
const grid_renderer_base_1 = require("./grid-renderer.base");
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const DEFAULT_COMMANDS = {
    init: Buffer.from([ESC, 0x40]),
    alignLeft: Buffer.from([ESC, 0x61, 0x00]),
    alignCenter: Buffer.from([ESC, 0x61, 0x01]),
    alignRight: Buffer.from([ESC, 0x61, 0x02]),
    boldOn: Buffer.from([ESC, 0x45, 0x01]),
    boldOff: Buffer.from([ESC, 0x45, 0x00]),
    underlineOn: Buffer.from([ESC, 0x2d, 0x01]),
    underlineOff: Buffer.from([ESC, 0x2d, 0x00]),
    sizeNormal: Buffer.from([GS, 0x21, 0x00]),
    sizeDoubleWidth: Buffer.from([GS, 0x21, 0x10]),
    sizeDoubleHeight: Buffer.from([GS, 0x21, 0x01]),
    sizeDouble: Buffer.from([GS, 0x21, 0x11]),
    lineFeed: Buffer.from([LF]),
    feedBeforeCut: Buffer.from([ESC, 0x64, 0x03]),
    cut: Buffer.from([GS, 0x56, 0x42, 0x00]),
    codepageCp437: Buffer.from([ESC, 0x74, 0x00]),
    codepageCp850: Buffer.from([ESC, 0x74, 0x02]),
    codepageCp1252: Buffer.from([ESC, 0x74, 0x10]),
};
const DEFAULT_COLUMNS = 48;
const MAX_RASTER_WIDTH_DOTS = 576;
let EscPosRenderer = class EscPosRenderer extends grid_renderer_base_1.GridRendererBase {
    outputMode = 'ESCPOS';
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
        chunks.push(this.codepageCommand(commands, codepage.name));
        chunks.push(commands.alignLeft);
        tree.pages.forEach((page, pageIndex) => {
            const { canvas, warnings: pageWarnings } = this.toCanvas(page, columns, codepage);
            for (const warning of pageWarnings) {
                warnings.add(warning);
            }
            for (const runs of canvas.allRuns()) {
                chunks.push(this.encodeLine(runs, columns, commands, codepage, profile));
                chunks.push(commands.lineFeed);
            }
            if (profile?.supportsCut ?? true) {
                chunks.push(commands.feedBeforeCut);
                chunks.push(commands.cut);
            }
            else if (pageIndex < tree.pages.length - 1) {
                chunks.push(Buffer.from([ESC, 0x64, 0x05]));
            }
        });
        chunks.push(commands.init);
        const bytes = Buffer.concat(chunks);
        const durationMs = Date.now() - startedAt;
        this.logger.log(`ESC/POS rendered: ${tree.pageCount} receipt(s), ${columns} columns, ${bytes.length} bytes, ${durationMs}ms`);
        return {
            bytes,
            contentType: 'application/octet-stream',
            extension: 'bin',
            pageCount: tree.pageCount,
            durationMs,
            warnings: [...warnings],
        };
    }
    defaultColumns() {
        return DEFAULT_COLUMNS;
    }
    onGraphicPrimitive(primitive, warnings) {
        if (primitive.k === 'image') {
            warnings.add('A logo was skipped: thermal raster output (GS v 0) is not implemented yet. ' +
                `The printer supports it — a bitmap up to ${MAX_RASTER_WIDTH_DOTS} dots wide — ` +
                'so this is a gap to fill, not a hardware limit.');
            return;
        }
        warnings.add(`A ${primitive.k} element was skipped: thermal output currently prints text only. ` +
            'Print the value as text, or use the PDF path.');
    }
    codepageCommand(commands, codepageName) {
        switch (codepageName) {
            case 'CP850':
                return commands.codepageCp850;
            case 'CP1252':
                return commands.codepageCp1252;
            case 'CP437':
            case 'ASCII':
            default:
                return commands.codepageCp437;
        }
    }
    encodeLine(runs, columns, commands, codepage, profile) {
        if (runs.length === 0) {
            return Buffer.alloc(0);
        }
        const enlarged = runs.find((run) => run.style.doubleWidth || run.style.doubleHeight);
        if (enlarged) {
            return this.encodeEnlargedLine(runs, columns, commands, codepage);
        }
        const parts = [];
        let cursorColumn = 0;
        let boldOn = false;
        let underlineOn = false;
        for (const run of runs) {
            if (run.col > cursorColumn) {
                parts.push(Buffer.alloc(run.col - cursorColumn, 0x20));
                cursorColumn = run.col;
            }
            const wantBold = run.style.bold && (profile?.supportsBold ?? true);
            const wantUnderline = run.style.underline && (profile?.supportsUnderline ?? true);
            if (wantBold !== boldOn) {
                parts.push(wantBold ? commands.boldOn : commands.boldOff);
                boldOn = wantBold;
            }
            if (wantUnderline !== underlineOn) {
                parts.push(wantUnderline ? commands.underlineOn : commands.underlineOff);
                underlineOn = wantUnderline;
            }
            const characters = [...run.text];
            const room = Math.max(0, columns - cursorColumn);
            const clipped = characters.slice(0, room).join('');
            parts.push(codepage.encode(clipped).bytes);
            cursorColumn += [...clipped].length;
        }
        if (boldOn) {
            parts.push(commands.boldOff);
        }
        if (underlineOn) {
            parts.push(commands.underlineOff);
        }
        return Buffer.concat(parts);
    }
    encodeEnlargedLine(runs, columns, commands, codepage) {
        const text = runs
            .map((run) => run.text)
            .join(' ')
            .trim();
        const style = runs[0].style;
        const sizeCommand = style.doubleWidth && style.doubleHeight
            ? commands.sizeDouble
            : style.doubleWidth
                ? commands.sizeDoubleWidth
                : commands.sizeDoubleHeight;
        const budget = style.doubleWidth ? Math.floor(columns / 2) : columns;
        const clipped = [...text].slice(0, budget).join('');
        return Buffer.concat([
            style.centered ? commands.alignCenter : commands.alignLeft,
            sizeCommand,
            style.bold ? commands.boldOn : Buffer.alloc(0),
            codepage.encode(clipped).bytes,
            style.bold ? commands.boldOff : Buffer.alloc(0),
            commands.sizeNormal,
            commands.alignLeft,
        ]);
    }
};
exports.EscPosRenderer = EscPosRenderer;
exports.EscPosRenderer = EscPosRenderer = __decorate([
    (0, common_1.Injectable)()
], EscPosRenderer);
const mergeCommands = (profile) => {
    if (!profile?.commands) {
        return DEFAULT_COMMANDS;
    }
    return { ...DEFAULT_COMMANDS, ...profile.commands };
};
//# sourceMappingURL=escpos.renderer.js.map