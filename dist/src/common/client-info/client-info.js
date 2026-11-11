"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_CLIENT_INFO = exports.MAX_CLIENT_BUILD = exports.CLIENT_INFO_HEADERS = exports.CLIENT_PLATFORMS = void 0;
exports.parseClientInfo = parseClientInfo;
exports.clientInfoOf = clientInfoOf;
exports.hasClientBuild = hasClientBuild;
exports.parsePlatform = parsePlatform;
exports.parseClientBuild = parseClientBuild;
exports.CLIENT_PLATFORMS = ['web', 'desktop', 'mobile'];
exports.CLIENT_INFO_HEADERS = {
    platform: 'x-app-platform',
    build: 'x-app-build',
    version: 'x-app-version',
    commit: 'x-app-commit',
    deviceId: 'x-device-id',
    deviceOs: 'x-device-os',
};
exports.MAX_CLIENT_BUILD = 2_147_483_647;
const MAX_LENGTH = {
    version: 32,
    commit: 40,
    deviceId: 100,
    deviceOs: 100,
};
exports.EMPTY_CLIENT_INFO = Object.freeze({
    platform: null,
    build: null,
    version: null,
    commit: null,
    deviceId: null,
    deviceOs: null,
});
function parseClientInfo(headers) {
    if (!headers || typeof headers !== 'object') {
        return { ...exports.EMPTY_CLIENT_INFO };
    }
    return {
        platform: parsePlatform(headerText(headers[exports.CLIENT_INFO_HEADERS.platform])),
        build: parseClientBuild(headerText(headers[exports.CLIENT_INFO_HEADERS.build])),
        version: fit(headerText(headers[exports.CLIENT_INFO_HEADERS.version]), MAX_LENGTH.version),
        commit: fit(headerText(headers[exports.CLIENT_INFO_HEADERS.commit]), MAX_LENGTH.commit),
        deviceId: fit(headerText(headers[exports.CLIENT_INFO_HEADERS.deviceId]), MAX_LENGTH.deviceId),
        deviceOs: fit(headerText(headers[exports.CLIENT_INFO_HEADERS.deviceOs]), MAX_LENGTH.deviceOs),
    };
}
function clientInfoOf(request) {
    if (!request || typeof request !== 'object') {
        return { ...exports.EMPTY_CLIENT_INFO };
    }
    const candidate = request;
    return candidate.clientInfo ?? parseClientInfo(candidate.headers);
}
function hasClientBuild(info) {
    return Boolean(info && info.platform !== null && info.build !== null);
}
function parsePlatform(value) {
    if (!value) {
        return null;
    }
    const normalized = value.toLowerCase();
    return exports.CLIENT_PLATFORMS.includes(normalized)
        ? normalized
        : null;
}
function parseClientBuild(value) {
    if (!value || !/^\d{1,10}$/.test(value)) {
        return null;
    }
    const build = Number(value);
    return Number.isSafeInteger(build) && build >= 1 && build <= exports.MAX_CLIENT_BUILD ? build : null;
}
function headerText(value) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
        if (typeof entry !== 'string') {
            continue;
        }
        const cleaned = entry.replace(/[\u0000-\u001f\u007f]/g, '').trim();
        if (cleaned.length > 0) {
            return cleaned;
        }
    }
    return null;
}
function fit(value, maxLength) {
    if (value === null) {
        return null;
    }
    return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}
//# sourceMappingURL=client-info.js.map