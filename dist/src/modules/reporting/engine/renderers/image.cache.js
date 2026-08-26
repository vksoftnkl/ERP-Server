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
var ImageCache_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCache = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const MAX_SINGLE_IMAGE_BYTES = 8 * 1024 * 1024;
let ImageCache = ImageCache_1 = class ImageCache {
    logger = new common_1.Logger(ImageCache_1.name);
    entries = new Map();
    totalBytes = 0;
    warnings = new Set();
    allowedRoots;
    allowRemote;
    maxBytes;
    constructor() {
        this.allowedRoots = resolveAllowedRoots();
        this.allowRemote = ['1', 'true', 'yes', 'on'].includes((process.env.REPORT_ALLOW_REMOTE_IMAGES ?? '').toLowerCase());
        this.maxBytes = Number(process.env.REPORT_IMAGE_CACHE_BYTES) || DEFAULT_MAX_BYTES;
    }
    drainWarnings() {
        const drained = [...this.warnings];
        this.warnings.clear();
        return drained;
    }
    async resolveImage(source) {
        const trimmed = source.trim();
        if (!trimmed) {
            return null;
        }
        const cached = this.entries.get(trimmed);
        if (cached) {
            cached.lastUsedAt = Date.now();
            return cached.bytes;
        }
        const bytes = await this.load(trimmed);
        if (!bytes) {
            return null;
        }
        if (bytes.length > MAX_SINGLE_IMAGE_BYTES) {
            this.warn(`Image '${truncateForLog(trimmed)}' is ${(bytes.length / 1024 / 1024).toFixed(1)}MB, over the ${MAX_SINGLE_IMAGE_BYTES / 1024 / 1024}MB per-image cap`);
            return null;
        }
        this.store(trimmed, bytes);
        return bytes;
    }
    async load(source) {
        if (source.startsWith('data:')) {
            return this.decodeDataUri(source);
        }
        if (/^https?:\/\//i.test(source)) {
            if (!this.allowRemote) {
                this.warn(`Remote image '${truncateForLog(source)}' refused. Set REPORT_ALLOW_REMOTE_IMAGES=true ` +
                    'to enable remote fetching, understanding that a render then makes ' +
                    'outbound requests from the server.');
                return null;
            }
            return this.fetchRemote(source);
        }
        return this.readLocal(source);
    }
    decodeDataUri(source) {
        const comma = source.indexOf(',');
        if (comma < 0) {
            this.warn('Malformed data: URI in an image element');
            return null;
        }
        const header = source.slice(5, comma);
        const payload = source.slice(comma + 1);
        try {
            return header.includes(';base64')
                ? Buffer.from(payload, 'base64')
                : Buffer.from(decodeURIComponent(payload), 'binary');
        }
        catch (error) {
            this.warn(`Could not decode data: URI: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async readLocal(source) {
        const candidate = (0, node_path_1.isAbsolute)(source) ? (0, node_path_1.normalize)(source) : (0, node_path_1.resolve)(process.cwd(), source);
        const contained = this.allowedRoots.some((root) => candidate === root || candidate.startsWith(root + node_path_1.sep));
        if (!contained) {
            this.warn(`Image path '${truncateForLog(source)}' is outside the allowed roots ` +
                `(${this.allowedRoots.join(', ')}) and was refused`);
            return null;
        }
        try {
            return await (0, promises_1.readFile)(candidate);
        }
        catch (error) {
            this.warn(`Image '${truncateForLog(source)}' could not be read: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async fetchRemote(source) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const response = await fetch(source, { signal: controller.signal, redirect: 'follow' });
            clearTimeout(timeout);
            if (!response.ok) {
                this.warn(`Image '${truncateForLog(source)}' returned HTTP ${response.status}`);
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch (error) {
            this.warn(`Image '${truncateForLog(source)}' could not be fetched: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    store(key, bytes) {
        while (this.totalBytes + bytes.length > this.maxBytes && this.entries.size > 0) {
            let oldestKey = null;
            let oldestAt = Number.POSITIVE_INFINITY;
            for (const [candidateKey, entry] of this.entries) {
                if (entry.lastUsedAt < oldestAt) {
                    oldestAt = entry.lastUsedAt;
                    oldestKey = candidateKey;
                }
            }
            if (oldestKey === null) {
                break;
            }
            const evicted = this.entries.get(oldestKey);
            this.entries.delete(oldestKey);
            this.totalBytes -= evicted?.bytes.length ?? 0;
        }
        if (bytes.length <= this.maxBytes) {
            this.entries.set(key, { bytes, lastUsedAt: Date.now() });
            this.totalBytes += bytes.length;
        }
    }
    warn(message) {
        this.warnings.add(message);
        this.logger.warn(message);
    }
    stats() {
        return {
            entries: this.entries.size,
            bytes: this.totalBytes,
            allowedRoots: this.allowedRoots,
            allowRemote: this.allowRemote,
        };
    }
};
exports.ImageCache = ImageCache;
exports.ImageCache = ImageCache = ImageCache_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ImageCache);
const resolveAllowedRoots = () => {
    const configured = process.env.REPORT_IMAGE_ROOTS?.trim();
    const raw = configured ? configured.split(/[:;]/).filter(Boolean) : ['assets', 'uploads'];
    return raw.map((entry) => ((0, node_path_1.isAbsolute)(entry) ? (0, node_path_1.normalize)(entry) : (0, node_path_1.resolve)(process.cwd(), entry)));
};
const truncateForLog = (value) => value.length > 120 ? `${value.slice(0, 117)}...` : value;
//# sourceMappingURL=image.cache.js.map