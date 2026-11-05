"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHttpCacheStoragePattern = exports.HTTP_CACHE_NAMESPACE = void 0;
exports.HTTP_CACHE_NAMESPACE = 'http-cache';
const buildHttpCacheStoragePattern = (pattern) => {
    if (!pattern || pattern === '*') {
        return `${exports.HTTP_CACHE_NAMESPACE}:*`;
    }
    const normalizedPattern = pattern.endsWith('*') ? pattern : `${pattern}*`;
    return `${exports.HTTP_CACHE_NAMESPACE}:${normalizedPattern}`;
};
exports.buildHttpCacheStoragePattern = buildHttpCacheStoragePattern;
//# sourceMappingURL=http-cache.constants.js.map