"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFLINE_SITE_CONFIG_KEY = void 0;
exports.isOfflineSite = isOfflineSite;
exports.OFFLINE_SITE_CONFIG_KEY = 'cloudSync.enabled';
function isOfflineSite(config) {
    return Boolean(config?.get(exports.OFFLINE_SITE_CONFIG_KEY));
}
//# sourceMappingURL=offline-site.js.map