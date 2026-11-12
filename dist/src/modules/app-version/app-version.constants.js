"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ACTOR = exports.OPS_ACTOR_HEADER = exports.OPS_KEY_HEADER = exports.LEGACY_MAX_PENDING_KEYS = exports.LEGACY_FLUSH_INTERVAL_MS = exports.REFRESH_RECORD_INTERVAL_MS = exports.LEGACY_UNKNOWN_BUILD = exports.LEGACY_USAGE_PLATFORMS = exports.SEVERITY_RANK = exports.RELEASE_SEVERITIES = void 0;
exports.RELEASE_SEVERITIES = ['normal', 'recommended', 'critical'];
exports.SEVERITY_RANK = {
    normal: 1,
    recommended: 2,
    critical: 3,
};
exports.LEGACY_USAGE_PLATFORMS = ['web', 'desktop', 'mobile', 'unknown'];
exports.LEGACY_UNKNOWN_BUILD = -1;
exports.REFRESH_RECORD_INTERVAL_MS = 10 * 60 * 1000;
exports.LEGACY_FLUSH_INTERVAL_MS = 60 * 1000;
exports.LEGACY_MAX_PENDING_KEYS = 5_000;
exports.OPS_KEY_HEADER = 'x-ops-key';
exports.OPS_ACTOR_HEADER = 'x-ops-actor';
exports.SYSTEM_ACTOR = 'app-version';
//# sourceMappingURL=app-version.constants.js.map