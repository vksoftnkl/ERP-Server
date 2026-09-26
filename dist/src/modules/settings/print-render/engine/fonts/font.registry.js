"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FontRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FontRegistry = exports.MONOSPACE_FONT_FAMILY = exports.DEFAULT_FONT_FAMILY = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const fontkit = require("fontkit");
const FACES = [
    { family: 'NotoSans', bold: false, italic: false, fileName: 'NotoSans-Regular.ttf' },
    { family: 'NotoSans', bold: true, italic: false, fileName: 'NotoSans-Bold.ttf' },
    { family: 'NotoSans', bold: false, italic: true, fileName: 'NotoSans-Italic.ttf' },
    { family: 'NotoSans', bold: true, italic: true, fileName: 'NotoSans-BoldItalic.ttf' },
    { family: 'NotoSansTamil', bold: false, italic: false, fileName: 'NotoSansTamil-Regular.ttf' },
    { family: 'NotoSansTamil', bold: true, italic: false, fileName: 'NotoSansTamil-Bold.ttf' },
    { family: 'NotoSansMono', bold: false, italic: false, fileName: 'NotoSansMono-Regular.ttf' },
    { family: 'NotoSansMono', bold: true, italic: false, fileName: 'NotoSansMono-Bold.ttf' },
];
const FAMILY_FOR_SCRIPT = {
    tamil: {
        NotoSans: 'NotoSansTamil',
        NotoSansMono: 'NotoSansTamil',
        NotoSansTamil: 'NotoSansTamil',
    },
    latin: { NotoSans: 'NotoSans', NotoSansMono: 'NotoSansMono', NotoSansTamil: 'NotoSans' },
};
exports.DEFAULT_FONT_FAMILY = 'NotoSans';
exports.MONOSPACE_FONT_FAMILY = 'NotoSansMono';
const faceId = (family, bold, italic) => `${family}${bold ? '-Bold' : ''}${italic ? '-Italic' : ''}` || family;
let FontRegistry = FontRegistry_1 = class FontRegistry {
    logger = new common_1.Logger(FontRegistry_1.name);
    faces = new Map();
    fontDirectory = '';
    onModuleInit() {
        this.load();
    }
    load() {
        if (this.faces.size > 0) {
            return;
        }
        this.fontDirectory = resolveFontDirectory();
        for (const face of FACES) {
            const filePath = (0, node_path_1.join)(this.fontDirectory, face.fileName);
            if (!(0, node_fs_1.existsSync)(filePath)) {
                this.logger.warn(`Report font missing: ${filePath}`);
                continue;
            }
            try {
                const parsed = fontkit.create((0, node_fs_1.readFileSync)(filePath));
                if (!('unitsPerEm' in parsed)) {
                    this.logger.error(`Report font ${face.fileName} is a collection, not a single face`);
                    continue;
                }
                const font = parsed;
                const id = faceId(face.family, face.bold, face.italic);
                this.faces.set(id, {
                    id,
                    family: face.family,
                    bold: face.bold,
                    italic: face.italic,
                    filePath,
                    font,
                    unitsPerEm: font.unitsPerEm,
                    ascent: font.ascent,
                    descent: font.descent,
                    lineGap: font.lineGap,
                });
            }
            catch (error) {
                this.logger.error(`Failed to load report font ${face.fileName}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        if (this.faces.size === 0) {
            throw new Error(`No report fonts could be loaded from ${this.fontDirectory}. ` +
                'Reports cannot render. Check that assets/fonts ships with the build ' +
                '(or set PRINT_FONT_DIR).');
        }
        this.logger.log(`Loaded ${this.faces.size} report font face(s) from ${this.fontDirectory}`);
    }
    get directory() {
        return this.fontDirectory;
    }
    all() {
        return [...this.faces.values()];
    }
    resolve(key) {
        const family = this.faces.has(faceId(key.family, false, false))
            ? key.family
            : exports.DEFAULT_FONT_FAMILY;
        const candidates = [
            faceId(family, key.bold, key.italic),
            faceId(family, key.bold, false),
            faceId(family, false, key.italic),
            faceId(family, false, false),
            faceId(exports.DEFAULT_FONT_FAMILY, key.bold, key.italic),
            faceId(exports.DEFAULT_FONT_FAMILY, false, false),
        ];
        for (const candidate of candidates) {
            const found = this.faces.get(candidate);
            if (found) {
                return found;
            }
        }
        const [fallback] = this.faces.values();
        return fallback;
    }
    resolveForScript(key, script) {
        const requestedFamily = this.faces.has(faceId(key.family, false, false))
            ? key.family
            : exports.DEFAULT_FONT_FAMILY;
        const mapped = FAMILY_FOR_SCRIPT[script][requestedFamily] ?? requestedFamily;
        return this.resolve({ ...key, family: mapped });
    }
    families() {
        return [...new Set([...this.faces.values()].map((face) => face.family))].sort();
    }
};
exports.FontRegistry = FontRegistry;
exports.FontRegistry = FontRegistry = FontRegistry_1 = __decorate([
    (0, common_1.Injectable)()
], FontRegistry);
const resolveFontDirectory = () => {
    const configured = process.env.PRINT_FONT_DIR?.trim();
    if (configured) {
        return (0, node_path_1.isAbsolute)(configured) ? configured : (0, node_path_1.resolve)(process.cwd(), configured);
    }
    const candidates = [
        (0, node_path_1.resolve)(process.cwd(), 'assets/fonts'),
        (0, node_path_1.resolve)(__dirname, '../../../../../../assets/fonts'),
        (0, node_path_1.resolve)(__dirname, '../../../../../assets/fonts'),
    ];
    const executableDirectory = process.pkg
        ? (0, node_path_1.resolve)(process.execPath, '..', 'assets/fonts')
        : null;
    if (executableDirectory) {
        candidates.unshift(executableDirectory);
    }
    return candidates.find((candidate) => (0, node_fs_1.existsSync)(candidate)) ?? candidates[0];
};
//# sourceMappingURL=font.registry.js.map