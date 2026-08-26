"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BarcodeFactory_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarcodeFactory = void 0;
const common_1 = require("@nestjs/common");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const BWIPP_NAMES = {
    code128: 'code128',
    ean13: 'ean13',
    ean8: 'ean8',
    upca: 'upca',
    code39: 'code39',
    itf14: 'itf14',
};
const FIXED_LENGTH = {
    ean13: { digits: 13, label: 'EAN-13' },
    ean8: { digits: 8, label: 'EAN-8' },
    upca: { digits: 12, label: 'UPC-A' },
    itf14: { digits: 14, label: 'ITF-14' },
};
const MAX_CACHE_ENTRIES = 500;
const RASTER_SCALE = 8;
let BarcodeFactory = BarcodeFactory_1 = class BarcodeFactory {
    logger = new common_1.Logger(BarcodeFactory_1.name);
    cache = new Map();
    warnings = new Set();
    drainWarnings() {
        const drained = [...this.warnings];
        this.warnings.clear();
        return drained;
    }
    async barcode(symbology, value, widthMm, heightMm, showText) {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const problem = this.validate(symbology, trimmed);
        if (problem) {
            this.warnings.add(problem);
            return null;
        }
        const cacheKey = `bc|${symbology}|${trimmed}|${widthMm.toFixed(2)}|${heightMm.toFixed(2)}|${showText}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const png = await bwipjs.toBuffer({
                bcid: BWIPP_NAMES[symbology],
                text: trimmed,
                height: Math.max(4, heightMm),
                includetext: showText,
                textxalign: 'center',
                paddingwidth: 0,
                paddingheight: 0,
                scale: 3,
            });
            const generated = {
                png: Buffer.from(png),
                widthPx: 0,
                heightPx: 0,
            };
            this.store(cacheKey, generated);
            return generated;
        }
        catch (error) {
            const message = `Barcode ${symbology} '${trimmed}' could not be generated: ${error instanceof Error ? error.message : String(error)}`;
            this.warnings.add(message);
            this.logger.warn(message);
            return null;
        }
    }
    async qrcode(value, sizeMm, errorCorrection) {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const cacheKey = `qr|${trimmed}|${sizeMm.toFixed(2)}|${errorCorrection}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const pixels = Math.max(64, Math.round(sizeMm * RASTER_SCALE));
            const png = await QRCode.toBuffer(trimmed, {
                type: 'png',
                errorCorrectionLevel: errorCorrection,
                width: pixels,
                margin: 0,
            });
            const generated = { png, widthPx: pixels, heightPx: pixels };
            this.store(cacheKey, generated);
            return generated;
        }
        catch (error) {
            const message = `QR code could not be generated: ${error instanceof Error ? error.message : String(error)}`;
            this.warnings.add(message);
            this.logger.warn(message);
            return null;
        }
    }
    validate(symbology, value) {
        const fixed = FIXED_LENGTH[symbology];
        if (!fixed) {
            return null;
        }
        if (!/^\d+$/.test(value)) {
            return `${fixed.label} requires digits only, got '${value}'`;
        }
        if (value.length !== fixed.digits && value.length !== fixed.digits - 1) {
            return `${fixed.label} requires ${fixed.digits} digits, got ${value.length} ('${value}')`;
        }
        return null;
    }
    store(key, image) {
        if (this.cache.size >= MAX_CACHE_ENTRIES) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) {
                this.cache.delete(oldest);
            }
        }
        this.cache.set(key, image);
    }
};
exports.BarcodeFactory = BarcodeFactory;
exports.BarcodeFactory = BarcodeFactory = BarcodeFactory_1 = __decorate([
    (0, common_1.Injectable)()
], BarcodeFactory);
//# sourceMappingURL=barcode.factory.js.map