"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MM_PER_POINT = exports.TextMeasurer = void 0;
const common_1 = require("@nestjs/common");
const font_registry_1 = require("../fonts/font.registry");
const script_runs_1 = require("../fonts/script-runs");
const units_1 = require("../units/units");
const LINE_HEIGHT_FACTOR = 1.0;
let TextMeasurer = class TextMeasurer {
    fonts;
    widthCache = new Map();
    constructor(fonts) {
        this.fonts = fonts;
    }
    measureWidthMm(text, font) {
        if (!text) {
            return 0;
        }
        const cacheKey = `${font.family}|${font.bold ? 1 : 0}${font.italic ? 1 : 0}|${font.sizePt}|${text}`;
        const cached = this.widthCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        let totalPoints = 0;
        for (const run of (0, script_runs_1.splitScriptRuns)(text)) {
            totalPoints += this.measureRunPoints(run, font);
        }
        const millimetres = (0, units_1.pointsToMm)(totalPoints);
        if (this.widthCache.size < 50_000) {
            this.widthCache.set(cacheKey, millimetres);
        }
        return millimetres;
    }
    lineHeightMm(font) {
        const face = this.fonts.resolve({
            family: font.family,
            bold: font.bold,
            italic: font.italic,
        });
        return (0, units_1.pointsToMm)(this.lineHeightPoints(face, font.sizePt));
    }
    ascentMm(font) {
        const face = this.fonts.resolve({
            family: font.family,
            bold: font.bold,
            italic: font.italic,
        });
        return (0, units_1.pointsToMm)((face.ascent / face.unitsPerEm) * font.sizePt);
    }
    wrap(text, maxWidthMm, font) {
        const lineHeightMm = this.lineHeightMm(font);
        if (!text) {
            return { lines: [], widthMm: 0, heightMm: 0, lineHeightMm };
        }
        if (maxWidthMm <= 0) {
            return {
                lines: [text],
                widthMm: this.measureWidthMm(text, font),
                heightMm: lineHeightMm,
                lineHeightMm,
            };
        }
        const lines = [];
        for (const paragraph of text.split(/\r?\n/)) {
            if (!paragraph.trim()) {
                lines.push('');
                continue;
            }
            lines.push(...this.wrapParagraph(paragraph, maxWidthMm, font));
        }
        const widthMm = lines.reduce((widest, line) => Math.max(widest, this.measureWidthMm(line, font)), 0);
        return {
            lines,
            widthMm,
            heightMm: lines.length * lineHeightMm,
            lineHeightMm,
        };
    }
    truncateToWidth(text, maxWidthMm, font, ellipsis = '…') {
        if (!text || maxWidthMm <= 0) {
            return '';
        }
        if (this.measureWidthMm(text, font) <= maxWidthMm) {
            return text;
        }
        const characters = [...text];
        const ellipsisWidth = this.measureWidthMm(ellipsis, font);
        const budget = maxWidthMm - ellipsisWidth;
        if (budget <= 0) {
            return '';
        }
        let low = 0;
        let high = characters.length;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            const candidate = characters.slice(0, middle).join('');
            if (this.measureWidthMm(candidate, font) <= budget) {
                low = middle;
            }
            else {
                high = middle - 1;
            }
        }
        return characters.slice(0, low).join('') + ellipsis;
    }
    clearCache() {
        this.widthCache.clear();
    }
    wrapParagraph(paragraph, maxWidthMm, font) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (this.measureWidthMm(candidate, font) <= maxWidthMm) {
                current = candidate;
                continue;
            }
            if (current) {
                lines.push(current);
                current = '';
            }
            if (this.measureWidthMm(word, font) > maxWidthMm) {
                lines.push(...this.breakLongWord(word, maxWidthMm, font));
                current = lines.pop() ?? '';
            }
            else {
                current = word;
            }
        }
        if (current) {
            lines.push(current);
        }
        return lines.length > 0 ? lines : [''];
    }
    breakLongWord(word, maxWidthMm, font) {
        const pieces = [];
        let current = '';
        for (const character of word) {
            const candidate = current + character;
            if (current && this.measureWidthMm(candidate, font) > maxWidthMm) {
                pieces.push(current);
                current = character;
            }
            else {
                current = candidate;
            }
        }
        if (current) {
            pieces.push(current);
        }
        return pieces;
    }
    measureRunPoints(run, font) {
        const face = this.fonts.resolveForScript({ family: font.family, bold: font.bold, italic: font.italic }, run.script);
        try {
            const laidOut = face.font.layout(run.text);
            return (laidOut.advanceWidth / face.unitsPerEm) * font.sizePt;
        }
        catch {
            return [...run.text].length * font.sizePt * 0.5;
        }
    }
    lineHeightPoints(face, sizePt) {
        const emHeight = (face.ascent - face.descent + face.lineGap) / face.unitsPerEm;
        return emHeight * sizePt * LINE_HEIGHT_FACTOR;
    }
};
exports.TextMeasurer = TextMeasurer;
exports.TextMeasurer = TextMeasurer = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [font_registry_1.FontRegistry])
], TextMeasurer);
exports.MM_PER_POINT = 1 / units_1.POINTS_PER_MM;
//# sourceMappingURL=text-measure.js.map