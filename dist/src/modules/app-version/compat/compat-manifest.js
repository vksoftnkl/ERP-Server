"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCompatManifest = loadCompatManifest;
exports.parseCompatManifest = parseCompatManifest;
exports.isBuildNumber = isBuildNumber;
const client_info_1 = require("../../../common/client-info/client-info");
const package_files_1 = require("../../../common/package-files/package-files");
const MAX_MESSAGE_LENGTH = 500;
const MAX_URL_LENGTH = 500;
const ENTRY_KEYS = new Set(['expectedBuild', 'message', 'downloadUrl']);
const TOP_KEYS = new Set([
    'backendBuild',
    'clients',
    'generatedAt',
    'commit',
    'version',
    'comment',
]);
function loadCompatManifest(appBuild, env = process.env, startDir = __dirname) {
    const read = (0, package_files_1.readPackageFile)(package_files_1.PACKAGE_FILES.compat, env, startDir);
    if (!read.found) {
        return { ok: false, path: read.path, reason: read.reason };
    }
    return parseCompatManifest(read.json, appBuild, read.path);
}
function parseCompatManifest(raw, appBuild, path) {
    const fail = (reason) => ({ ok: false, path, reason });
    if (!(0, package_files_1.isPlainObject)(raw)) {
        return fail('it is not a JSON object');
    }
    const unknownTop = Object.keys(raw).filter((key) => !TOP_KEYS.has(key));
    if (unknownTop.length > 0) {
        return fail(`unknown key(s) ${unknownTop.join(', ')}`);
    }
    let backendBuild = null;
    if (raw.backendBuild !== undefined && raw.backendBuild !== null) {
        if (!isBuildNumber(raw.backendBuild)) {
            return fail('backendBuild is not a positive integer');
        }
        if (raw.backendBuild !== appBuild) {
            return fail(`backendBuild ${raw.backendBuild} is not this backend's build ${appBuild}`);
        }
        backendBuild = raw.backendBuild;
    }
    if (!(0, package_files_1.isPlainObject)(raw.clients)) {
        return fail('clients is missing or not an object');
    }
    const clientsRaw = raw.clients;
    const unknownPlatforms = Object.keys(clientsRaw).filter((key) => !client_info_1.CLIENT_PLATFORMS.includes(key));
    if (unknownPlatforms.length > 0) {
        return fail(`unknown platform(s) ${unknownPlatforms.join(', ')} (expected ${client_info_1.CLIENT_PLATFORMS.join(' | ')})`);
    }
    const clients = {};
    for (const platform of client_info_1.CLIENT_PLATFORMS) {
        const parsed = parseEntry(clientsRaw[platform]);
        if (typeof parsed === 'string') {
            return fail(`clients.${platform}: ${parsed}`);
        }
        clients[platform] = parsed;
    }
    return { ok: true, manifest: { path, backendBuild, clients } };
}
function parseEntry(entry) {
    if (entry === undefined || entry === null) {
        return { expectedBuild: null, message: null, downloadUrl: null };
    }
    if (typeof entry === 'number') {
        return isBuildNumber(entry)
            ? { expectedBuild: entry, message: null, downloadUrl: null }
            : `a build must be an integer 1..${client_info_1.MAX_CLIENT_BUILD}`;
    }
    if (!(0, package_files_1.isPlainObject)(entry)) {
        return 'not a build number or an object';
    }
    if ('enforce' in entry) {
        return 'enforce is not read from compat.json; switch it with PATCH /app-version/policy/:platform';
    }
    const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key));
    if (unknown.length > 0) {
        return `unknown key(s) ${unknown.join(', ')}`;
    }
    const { expectedBuild, message, downloadUrl } = entry;
    if (expectedBuild !== undefined && expectedBuild !== null && !isBuildNumber(expectedBuild)) {
        return `expectedBuild must be an integer 1..${client_info_1.MAX_CLIENT_BUILD} or null`;
    }
    const msg = optionalText(message, MAX_MESSAGE_LENGTH, 'message');
    if (msg instanceof Error) {
        return msg.message;
    }
    const url = optionalText(downloadUrl, MAX_URL_LENGTH, 'downloadUrl');
    if (url instanceof Error) {
        return url.message;
    }
    return {
        expectedBuild: typeof expectedBuild === 'number' ? expectedBuild : null,
        message: msg,
        downloadUrl: url,
    };
}
function optionalText(value, max, name) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string' || value.length > max) {
        return new Error(`${name} must be a string of at most ${max} characters`);
    }
    return value.trim() || null;
}
function isBuildNumber(value) {
    return (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= client_info_1.MAX_CLIENT_BUILD);
}
//# sourceMappingURL=compat-manifest.js.map