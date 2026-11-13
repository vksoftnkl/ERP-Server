"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadReleaseList = loadReleaseList;
exports.parseReleaseList = parseReleaseList;
const client_info_1 = require("../../../common/client-info/client-info");
const package_files_1 = require("../../../common/package-files/package-files");
const app_version_constants_1 = require("../app-version.constants");
const compat_manifest_1 = require("./compat-manifest");
const MAX_RELEASES = 5_000;
const ENTRY_KEYS = new Set([
    'platform',
    'build',
    'version',
    'commit',
    'severity',
    'notes',
    'downloadUrl',
    'releasedAt',
    'isDeleted',
]);
const TOP_KEYS = new Set(['releases', 'generatedAt', 'comment', 'source']);
function loadReleaseList(env = process.env, startDir = __dirname) {
    const read = (0, package_files_1.readPackageFile)(package_files_1.PACKAGE_FILES.releases, env, startDir);
    if (!read.found) {
        return { ok: false, path: read.path, reason: read.reason };
    }
    return parseReleaseList(read.json, read.path);
}
function parseReleaseList(raw, path) {
    const fail = (reason) => ({ ok: false, path, reason });
    if (!(0, package_files_1.isPlainObject)(raw)) {
        return fail('it is not a JSON object');
    }
    const unknownTop = Object.keys(raw).filter((key) => !TOP_KEYS.has(key));
    if (unknownTop.length > 0) {
        return fail(`unknown key(s) ${unknownTop.join(', ')}`);
    }
    if (!Array.isArray(raw.releases)) {
        return fail('releases is missing or not an array');
    }
    if (raw.releases.length > MAX_RELEASES) {
        return fail(`more than ${MAX_RELEASES} releases`);
    }
    const seen = new Set();
    const releases = [];
    for (const [index, entry] of raw.releases.entries()) {
        const parsed = parseEntry(entry);
        if (typeof parsed === 'string') {
            return fail(`releases[${index}]: ${parsed}`);
        }
        const key = `${parsed.platform}:${parsed.build}`;
        if (seen.has(key)) {
            return fail(`releases[${index}]: ${parsed.platform} build ${parsed.build} is listed twice`);
        }
        seen.add(key);
        releases.push(parsed);
    }
    return { ok: true, list: { path, releases } };
}
function parseEntry(entry) {
    if (!(0, package_files_1.isPlainObject)(entry)) {
        return 'not an object';
    }
    const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key));
    if (unknown.length > 0) {
        return `unknown key(s) ${unknown.join(', ')}`;
    }
    const { platform, build, version, commit, severity, notes, downloadUrl, releasedAt, isDeleted } = entry;
    if (typeof platform !== 'string' || !client_info_1.CLIENT_PLATFORMS.includes(platform)) {
        return `platform must be ${client_info_1.CLIENT_PLATFORMS.join(' | ')}`;
    }
    if (!(0, compat_manifest_1.isBuildNumber)(build)) {
        return 'build must be a positive integer';
    }
    if (typeof version !== 'string' || !version.trim() || version.length > 32) {
        return 'version must be a non-empty string of at most 32 characters';
    }
    const severityValue = severity ?? 'normal';
    if (typeof severityValue !== 'string' ||
        !app_version_constants_1.RELEASE_SEVERITIES.includes(severityValue)) {
        return `severity must be ${app_version_constants_1.RELEASE_SEVERITIES.join(' | ')}`;
    }
    if (typeof releasedAt !== 'string' || Number.isNaN(Date.parse(releasedAt))) {
        return 'releasedAt must be an ISO date-time';
    }
    if (isDeleted !== undefined && typeof isDeleted !== 'boolean') {
        return 'isDeleted must be true or false';
    }
    const texts = [
        ['commit', commit, 40],
        ['notes', notes, 10_000],
        ['downloadUrl', downloadUrl, 500],
    ];
    for (const [name, value, max] of texts) {
        if (value !== undefined &&
            value !== null &&
            (typeof value !== 'string' || value.length > max)) {
            return `${name} must be a string of at most ${max} characters or null`;
        }
    }
    const blankToNull = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
    return {
        platform: platform,
        build,
        version: version.trim(),
        commit: blankToNull(commit),
        severity: severityValue,
        notes: blankToNull(notes),
        downloadUrl: blankToNull(downloadUrl),
        releasedAt: new Date(releasedAt).toISOString(),
        isDeleted: isDeleted === true,
    };
}
//# sourceMappingURL=release-list.js.map