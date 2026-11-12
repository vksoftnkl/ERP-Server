"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendBuild = backendBuild;
exports.resolveBackendBuild = resolveBackendBuild;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let cached = null;
function backendBuild() {
    cached ??= resolveBackendBuild(process.env);
    return cached;
}
function resolveBackendBuild(env, startDir = __dirname) {
    return {
        version: text(env.APP_VERSION, 32) ?? packageVersion(startDir) ?? 'unknown',
        build: buildNumber(env.APP_BUILD),
        commit: text(env.APP_COMMIT, 40),
    };
}
function text(value, maxLength) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
}
function buildNumber(value) {
    const trimmed = value?.trim();
    if (!trimmed || !/^\d{1,15}$/.test(trimmed)) {
        return null;
    }
    const build = Number(trimmed);
    return Number.isSafeInteger(build) ? build : null;
}
function packageVersion(startDir) {
    let dir = startDir;
    for (let depth = 0; depth < 8; depth += 1) {
        const candidate = (0, node_path_1.join)(dir, 'package.json');
        if ((0, node_fs_1.existsSync)(candidate)) {
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
        const parent = (0, node_path_1.dirname)(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return null;
}
//# sourceMappingURL=backend-build.js.map