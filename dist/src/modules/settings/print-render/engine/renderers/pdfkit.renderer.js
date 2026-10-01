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
var PdfKitRenderer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfKitRenderer = void 0;
const common_1 = require("@nestjs/common");
const PdfDocument = require("pdfkit");
const font_registry_1 = require("../fonts/font.registry");
const script_runs_1 = require("../fonts/script-runs");
const units_1 = require("../units/units");
const barcode_factory_1 = require("./barcode.factory");
const image_cache_1 = require("./image.cache");
const OVERFLOW_TOLERANCE_MM = 0.5;
let PdfKitRenderer = PdfKitRenderer_1 = class PdfKitRenderer {
    fonts;
    barcodes;
    images;
    outputMode = 'PDF';
    logger = new common_1.Logger(PdfKitRenderer_1.name);
    constructor(fonts, barcodes, images) {
        this.fonts = fonts;
        this.barcodes = barcodes;
        this.images = images;
    }
    async render(tree, options = {}) {
        const startedAt = Date.now();
        const warnings = tree.warnings.map((warning) => `${warning.kind}: ${warning.message}${warning.detail ? ` (${warning.detail})` : ''}`);
        const heightMm = tree.paper.heightMm ?? this.contentHeightMm(tree);
        const document = new PdfDocument({
            size: [(0, units_1.mmToPoints)(tree.paper.widthMm), (0, units_1.mmToPoints)(heightMm)],
            margin: 0,
            autoFirstPage: false,
            compress: true,
            info: {
                Producer: 'VK Nex ERP',
                Creator: 'VK Nex ERP report engine',
                CreationDate: options.creationDate ?? new Date(),
            },
        });
        const chunks = [];
        document.on('data', (chunk) => chunks.push(chunk));
        const finished = new Promise((resolveFinished, rejectFinished) => {
            document.on('end', () => resolveFinished());
            document.on('error', rejectFinished);
        });
        this.registerFonts(document);
        for (const page of tree.pages) {
            const assets = await this.prepareAssets(page, options);
            document.addPage({
                size: [(0, units_1.mmToPoints)(tree.paper.widthMm), (0, units_1.mmToPoints)(heightMm)],
                margin: 0,
            });
            this.drawPage(document, page, assets, tree.paper.widthMm, heightMm, warnings);
        }
        document.end();
        await finished;
        warnings.push(...this.barcodes.drainWarnings(), ...this.images.drainWarnings());
        const bytes = Buffer.concat(chunks);
        const durationMs = Date.now() - startedAt;
        this.logger.log(`PDF rendered: ${tree.pageCount} page(s), ${(bytes.length / 1024).toFixed(0)}KB, ${durationMs}ms`);
        return {
            bytes,
            contentType: 'application/pdf',
            extension: 'pdf',
            pageCount: tree.pageCount,
            durationMs,
            warnings,
        };
    }
    registerFonts(document) {
        for (const face of this.fonts.all()) {
            document.registerFont(face.id, face.filePath);
        }
    }
    contentHeightMm(tree) {
        let lowest = 0;
        for (const page of tree.pages) {
            for (const primitive of page.primitives) {
                switch (primitive.k) {
                    case 'text':
                        lowest = Math.max(lowest, primitive.y + Math.max(primitive.h, primitive.lines.length * primitive.lineHeightMm));
                        break;
                    case 'line':
                        lowest = Math.max(lowest, primitive.y1, primitive.y2);
                        break;
                    case 'qrcode':
                        lowest = Math.max(lowest, primitive.y + primitive.size);
                        break;
                    default:
                        lowest = Math.max(lowest, primitive.y + primitive.h);
                        break;
                }
            }
        }
        return Math.max(20, lowest + 5);
    }
    async prepareAssets(page, options) {
        const assets = new Map();
        const resolveImage = options.resolveImage ?? ((source) => this.images.resolveImage(source));
        await Promise.all(page.primitives.map(async (primitive, index) => {
            switch (primitive.k) {
                case 'image': {
                    const bytes = await resolveImage(primitive.src);
                    if (bytes) {
                        assets.set(index, bytes);
                    }
                    break;
                }
                case 'barcode': {
                    const generated = await this.barcodes.barcode(primitive.symbology, primitive.value, primitive.w, primitive.h, primitive.showText);
                    if (generated) {
                        assets.set(index, generated.png);
                    }
                    break;
                }
                case 'qrcode': {
                    const generated = await this.barcodes.qrcode(primitive.value, primitive.size, primitive.errorCorrection);
                    if (generated) {
                        assets.set(index, generated.png);
                    }
                    break;
                }
                default:
                    break;
            }
        }));
        return assets;
    }
    drawPage(document, page, assets, pageWidthMm, pageHeightMm, warnings) {
        page.primitives.forEach((primitive, index) => {
            this.reportOverflow(primitive, page.index, pageWidthMm, pageHeightMm, warnings);
            switch (primitive.k) {
                case 'rect':
                    this.drawRect(document, primitive);
                    break;
                case 'line':
                    this.drawLine(document, primitive);
                    break;
                case 'text':
                    this.drawText(document, primitive);
                    break;
                case 'image':
                    this.drawImage(document, primitive, assets.get(index));
                    break;
                case 'barcode':
                    this.drawBarcode(document, primitive, assets.get(index));
                    break;
                case 'qrcode':
                    this.drawQrCode(document, primitive, assets.get(index));
                    break;
                default:
                    break;
            }
        });
    }
    drawRect(document, primitive) {
        const x = (0, units_1.mmToPoints)(primitive.x);
        const y = (0, units_1.mmToPoints)(primitive.y);
        const width = (0, units_1.mmToPoints)(primitive.w);
        const height = (0, units_1.mmToPoints)(primitive.h);
        if (width <= 0 || height <= 0) {
            return;
        }
        if (primitive.radiusMm > 0) {
            document.roundedRect(x, y, width, height, (0, units_1.mmToPoints)(primitive.radiusMm));
        }
        else {
            document.rect(x, y, width, height);
        }
        if (primitive.fill && primitive.stroke) {
            document
                .fillColor(primitive.fill)
                .strokeColor(primitive.stroke)
                .lineWidth(primitive.strokeWidthPt)
                .fillAndStroke();
        }
        else if (primitive.fill) {
            document.fillColor(primitive.fill).fill();
        }
        else if (primitive.stroke) {
            document.strokeColor(primitive.stroke).lineWidth(primitive.strokeWidthPt).stroke();
        }
        else {
            document.strokeColor('#000000').lineWidth(0.5).stroke();
        }
    }
    drawLine(document, primitive) {
        document
            .moveTo((0, units_1.mmToPoints)(primitive.x1), (0, units_1.mmToPoints)(primitive.y1))
            .lineTo((0, units_1.mmToPoints)(primitive.x2), (0, units_1.mmToPoints)(primitive.y2))
            .strokeColor(primitive.color)
            .lineWidth(primitive.widthPt)
            .stroke();
    }
    drawText(document, primitive) {
        const lines = primitive.lines.length > 0 ? primitive.lines : [primitive.text];
        const lineHeightPt = (0, units_1.mmToPoints)(primitive.lineHeightMm);
        const boxWidthPt = (0, units_1.mmToPoints)(primitive.w);
        const boxHeightPt = (0, units_1.mmToPoints)(primitive.h);
        const totalTextHeightPt = lines.length * lineHeightPt;
        let cursorYPt = (0, units_1.mmToPoints)(primitive.y);
        if (primitive.vAlign === 'middle') {
            cursorYPt += Math.max(0, (boxHeightPt - totalTextHeightPt) / 2);
        }
        else if (primitive.vAlign === 'bottom') {
            cursorYPt += Math.max(0, boxHeightPt - totalTextHeightPt);
        }
        document.fillColor(primitive.color);
        for (const line of lines) {
            if (line !== '') {
                this.drawTextLine(document, line, primitive, cursorYPt, boxWidthPt, lineHeightPt);
            }
            cursorYPt += lineHeightPt;
        }
    }
    drawTextLine(document, line, primitive, yPt, boxWidthPt, lineHeightPt) {
        const runs = (0, script_runs_1.splitScriptRuns)(line).map((run) => {
            const face = this.fonts.resolveForScript({
                family: primitive.font.family,
                bold: primitive.font.bold,
                italic: primitive.font.italic,
            }, run.script);
            return {
                text: run.text,
                face,
                widthPt: this.runWidthPt(run.text, face, primitive.font.sizePt),
            };
        });
        const totalWidthPt = runs.reduce((total, run) => total + run.widthPt, 0);
        let xPt = (0, units_1.mmToPoints)(primitive.x);
        if (primitive.align === 'right') {
            xPt += boxWidthPt - totalWidthPt;
        }
        else if (primitive.align === 'center') {
            xPt += (boxWidthPt - totalWidthPt) / 2;
        }
        for (const run of runs) {
            document.font(run.face.id).fontSize(primitive.font.sizePt);
            document.text(run.text, xPt, yPt, { lineBreak: false, width: undefined });
            xPt += run.widthPt;
        }
        if (primitive.font.underline && totalWidthPt > 0) {
            const startXPt = xPt - totalWidthPt;
            const underlineYPt = yPt + lineHeightPt * 0.85;
            document
                .moveTo(startXPt, underlineYPt)
                .lineTo(startXPt + totalWidthPt, underlineYPt)
                .strokeColor(primitive.color)
                .lineWidth(Math.max(0.3, primitive.font.sizePt / 18))
                .stroke();
        }
    }
    runWidthPt(text, face, sizePt) {
        try {
            return (face.font.layout(text).advanceWidth / face.unitsPerEm) * sizePt;
        }
        catch {
            return [...text].length * sizePt * 0.5;
        }
    }
    drawImage(document, primitive, bytes) {
        if (!bytes) {
            return;
        }
        const x = (0, units_1.mmToPoints)(primitive.x);
        const y = (0, units_1.mmToPoints)(primitive.y);
        const width = (0, units_1.mmToPoints)(primitive.w);
        const height = (0, units_1.mmToPoints)(primitive.h);
        try {
            switch (primitive.fit) {
                case 'STRETCH':
                    document.image(bytes, x, y, { width, height });
                    break;
                case 'COVER':
                    document.image(bytes, x, y, {
                        cover: [width, height],
                        align: 'center',
                        valign: 'center',
                    });
                    break;
                case 'CONTAIN':
                default:
                    document.image(bytes, x, y, { fit: [width, height], align: 'center', valign: 'center' });
                    break;
            }
        }
        catch (error) {
            this.logger.warn(`Image could not be embedded: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    drawBarcode(document, primitive, bytes) {
        if (!bytes) {
            return;
        }
        try {
            document.image(bytes, (0, units_1.mmToPoints)(primitive.x), (0, units_1.mmToPoints)(primitive.y), {
                fit: [(0, units_1.mmToPoints)(primitive.w), (0, units_1.mmToPoints)(primitive.h)],
            });
        }
        catch (error) {
            this.logger.warn(`Barcode could not be embedded: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    drawQrCode(document, primitive, bytes) {
        if (!bytes) {
            return;
        }
        const size = (0, units_1.mmToPoints)(primitive.size);
        try {
            document.image(bytes, (0, units_1.mmToPoints)(primitive.x), (0, units_1.mmToPoints)(primitive.y), {
                width: size,
                height: size,
            });
        }
        catch (error) {
            this.logger.warn(`QR code could not be embedded: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    reportOverflow(primitive, pageIndex, pageWidthMm, pageHeightMm, warnings) {
        const right = primitive.k === 'line'
            ? Math.max(primitive.x1, primitive.x2)
            : primitive.k === 'qrcode'
                ? primitive.x + primitive.size
                : primitive.x + primitive.w;
        const bottom = primitive.k === 'line'
            ? Math.max(primitive.y1, primitive.y2)
            : primitive.k === 'qrcode'
                ? primitive.y + primitive.size
                : primitive.y + primitive.h;
        if (right > pageWidthMm + OVERFLOW_TOLERANCE_MM ||
            bottom > pageHeightMm + OVERFLOW_TOLERANCE_MM) {
            const message = `A ${primitive.k} primitive on page ${pageIndex + 1} extends to ` +
                `${right.toFixed(1)}x${bottom.toFixed(1)}mm, past the ${pageWidthMm}x${pageHeightMm.toFixed(0)}mm page`;
            if (!warnings.includes(message)) {
                warnings.push(message);
            }
        }
    }
};
exports.PdfKitRenderer = PdfKitRenderer;
exports.PdfKitRenderer = PdfKitRenderer = PdfKitRenderer_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [font_registry_1.FontRegistry,
        barcode_factory_1.BarcodeFactory,
        image_cache_1.ImageCache])
], PdfKitRenderer);
//# sourceMappingURL=pdfkit.renderer.js.map