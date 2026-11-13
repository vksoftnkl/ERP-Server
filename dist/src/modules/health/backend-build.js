"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendBuild = backendBuild;
exports.resolveBackendBuild = resolveBackendBuild;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const package_files_1 = require("../../common/package-files/package-files");
let cached = null;
function backendBuild() {
    cached ??= resolveBackendBuild(process.env);
    return cached;
}
function resolveBackendBuild(env, startDir = __dirname) {
    const info = buildInfo(env, startDir);
    const envBuild = buildNumber(env.APP_BUILD);
    const fileBuild = buildNumber(info.build);
    return {
        version: text(env.APP_VERSION, 32) ?? text(info.version, 32) ?? packageVersion(startDir) ?? 'unknown',
        build: envBuild ?? fileBuild,
        commit: text(env.APP_COMMIT, 40) ?? text(info.commit, 40),
        builtAt: text(info.builtAt, 40),
        buildSource: envBuild !== null ? 'env' : fileBuild !== null ? 'build-info' : 'none',
    };
}
function buildInfo(env, startDir) {
    const read = (0, package_files_1.readPackageFile)(package_files_1.PACKAGE_FILES.buildInfo, env, startDir);
    return read.found && (0, package_files_1.isPlainObject)(read.json) ? read.json : {};
}
function text(value, maxLength) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed ? trimmed.slice(0, maxLength) : null;
}
function buildNumber(value) {
    const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (!raw || !/^\d{1,15}$/.test(raw)) {
        return null;
    }
    const build = Number(raw);
    return Number.isSafeInteger(build) ? build : null;
}
function packageVersion(startDir) {
    const root = (0, package_files_1.packageRoot)(startDir);
    const candidate = root ? (0, node_path_1.join)(root, 'package.json') : null;
    if (!candidate || !(0, node_fs_1.existsSync)(candidate)) {
        return null;
    }
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(candidate, 'utf8'));
        return typeof parsed.version === 'string' && parsed.version.trim()
            ? parsed.version.trim()
            : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=backend-build.js.map