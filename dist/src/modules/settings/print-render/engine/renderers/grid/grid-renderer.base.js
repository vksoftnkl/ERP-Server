"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridRendererBase = void 0;
const common_1 = require("@nestjs/common");
const codepage_1 = require("./codepage");
const grid_canvas_1 = require("./grid-canvas");
class GridRendererBase {
    logger = new common_1.Logger(this.constructor.name);
    toCanvas(page, columns, codepage) {
        const canvas = new grid_canvas_1.GridCanvas(columns);
        const warnings = new Set();
        const unmappedCharacters = new Set();
        const unprintableScripts = new Set();
        for (const primitive of page.primitives) {
            switch (primitive.k) {
                case 'text':
                    this.writeText(canvas, primitive, codepage, unmappedCharacters, unprintableScripts);
                    break;
                case 'line': {
                    const isHorizontal = Math.round(primitive.y1) === Math.round(primitive.y2);
                    if (isHorizontal) {
                        canvas.fillRow(primitive.y1, primitive.x1, primitive.x2, primitive.gridChar);
                    }
                    else {
                        canvas.fillColumn(primitive.x1, primitive.y1, primitive.y2, '|');
                    }
                    break;
                }
                case 'rect':
                    this.writeRect(canvas, primitive);
                    break;
                case 'image':
                case 'barcode':
                case 'qrcode':
                    this.onGraphicPrimitive(primitive, warnings);
                    break;
                default:
                    break;
            }
        }
        if (unmappedCharacters.size > 0) {
            warnings.add(`${unmappedCharacters.size} character(s) have no representation in code page ` +
                `${codepage.name} and printed as '?': ${[...unmappedCharacters].slice(0, 20).join(' ')}`);
        }
        if (unprintableScripts.size > 0) {
            warnings.add(`${[...unprintableScripts].join(', ')} text cannot be printed in text mode on this ` +
                'printer — a character ROM has no glyphs for it. Use a PDF template for ' +
                'this document, or keep the template in English/transliterated text.');
        }
        const clipped = canvas.clipped;
        if (clipped.columns > 0) {
            warnings.add(`${clipped.columns} field(s) ran past the ${columns}-column budget and were clipped`);
        }
        if (clipped.rows > 0) {
            warnings.add(`${clipped.rows} field(s) fell outside the printable rows and were dropped`);
        }
        return { canvas, warnings: [...warnings] };
    }
    writeText(canvas, primitive, codepage, unmappedCharacters, unprintableScripts) {
        const style = this.styleFor(primitive);
        const lines = primitive.lines.length > 0 ? primitive.lines : [primitive.text];
        const width = primitive.w > 0 ? Math.round(primitive.w) : undefined;
        lines.forEach((line, index) => {
            if (!line) {
                return;
            }
            const prepared = codepage_1.Codepage.prepare(line);
            for (const script of (0, codepage_1.findUnprintableScripts)(prepared)) {
                unprintableScripts.add(script);
            }
            for (const character of codepage.encode(prepared).unmapped) {
                unmappedCharacters.add(character);
            }
            const row = Math.round(primitive.y) + index;
            const column = Math.round(primitive.x);
            if (primitive.align === 'right' && width !== undefined) {
                canvas.writeRight(row, column + width, prepared, style);
            }
            else if (primitive.align === 'center' && width !== undefined) {
                canvas.writeCentered(row, column, width, prepared, style);
            }
            else {
                canvas.write(row, column, prepared, style, width);
            }
        });
    }
    writeRect(canvas, primitive) {
        const top = Math.round(primitive.y);
        const left = Math.round(primitive.x);
        const bottom = top + Math.max(1, Math.round(primitive.h));
        const right = left + Math.max(1, Math.round(primitive.w));
        canvas.fillRow(top, left, right, '-');
        canvas.fillRow(bottom, left, right, '-');
        canvas.fillColumn(left, top, bottom, '|');
        canvas.fillColumn(right, top, bottom, '|');
        canvas.write(top, left, '+');
        canvas.write(top, right, '+');
        canvas.write(bottom, left, '+');
        canvas.write(bottom, right, '+');
    }
    styleFor(primitive) {
        return {
            ...grid_canvas_1.DEFAULT_STYLE,
            bold: primitive.font.bold,
            underline: primitive.font.underline,
            doubleWidth: primitive.font.sizePt >= 14,
            doubleHeight: primitive.font.sizePt >= 14,
            centered: primitive.align === 'center',
        };
    }
    resolveColumns(tree, profile) {
        const fromProfile = profile?.columns;
        const fromPaper = tree.paper.columns;
        return fromProfile ?? fromPaper ?? this.defaultColumns();
    }
    resolveCodepage(profile) {
        return (0, codepage_1.getCodepage)(profile?.codepage);
    }
}
exports.GridRendererBase = GridRendererBase;
//# sourceMappingURL=grid-renderer.base.js.map