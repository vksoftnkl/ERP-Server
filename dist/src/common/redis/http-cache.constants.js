"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RELATED_RESOURCE_INVALIDATIONS = exports.buildHttpCacheStoragePattern = exports.HTTP_CACHE_NAMESPACE = void 0;
exports.HTTP_CACHE_NAMESPACE = 'http-cache';
const buildHttpCacheStoragePattern = (pattern) => {
    if (!pattern || pattern === '*') {
        return `${exports.HTTP_CACHE_NAMESPACE}:*`;
    }
    const normalizedPattern = pattern.endsWith('*') ? pattern : `${pattern}*`;
    return `${exports.HTTP_CACHE_NAMESPACE}:${normalizedPattern}`;
};
exports.buildHttpCacheStoragePattern = buildHttpCacheStoragePattern;
exports.RELATED_RESOURCE_INVALIDATIONS = {
    'ui-table-masters': ['ui-table-columns'],
    'ui-table-columns': ['grid-columns', 'grid-details'],
};
//# sourceMappingURL=http-cache.constants.js.map