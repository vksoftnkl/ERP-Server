"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_FILES = void 0;
exports.locatePackageFile = locatePackageFile;
exports.readPackageFile = readPackageFile;
exports.packageRoot = packageRoot;
exports.isPlainObject = isPlainObject;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
exports.PACKAGE_FILES = {
    buildInfo: 'build-info.json',
    compat: 'compat.json',
    releases: 'releases.json',
};
function locatePackageFile(name, env = process.env, startDir = __dirname, execPath = isPackedExe() ? process.execPath : null) {
    const configured = env.APP_PACKAGE_DIR?.trim();
    if (configured) {
        return (0, node_path_1.join)((0, node_path_1.isAbsolute)(configured) ? configured : (0, node_path_1.resolve)(process.cwd(), configured), name);
    }
    if (execPath) {
        const besideExe = (0, node_path_1.join)((0, node_path_1.dirname)(execPath), name);
        if ((0, node_fs_1.existsSync)(besideExe)) {
            return besideExe;
        }
    }
    const root = packageRoot(startDir);
    if (root) {
        const besidePackage = (0, node_path_1.join)(root, name);
        if ((0, node_fs_1.existsSync)(besidePackage)) {
            return besidePackage;
        }
    }
    return null;
}
function readPackageFile(name, env = process.env, startDir = __dirname) {
    const path = locatePackageFile(name, env, startDir);
    if (!path) {
        return { found: false, path: null, reason: `no ${name} found` };
    }
    if (!(0, node_fs_1.existsSync)(path)) {
        return { found: false, path, reason: `${name} is not at ${path}` };
    }
    let text;
    try {
        text = (0, node_fs_1.readFileSync)(path, 'utf8');
    }
    catch (error) {
        return { found: false, path, reason: `cannot read it: ${describe(error)}` };
    }
    try {
        return { found: true, path, json: JSON.parse(text.replace(/^﻿/, '')) };
    }
    catch {
        return { found: false, path, reason: 'it is not valid JSON' };
    }
}
function packageRoot(startDir) {
    let dir = startDir;
    for (let depth = 0; depth < 8; depth += 1) {
        if ((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, 'package.json'))) {
            return dir;
        }
        const parent = (0, node_path_1.dirname)(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return null;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPackedExe() {
    return Boolean(process.pkg);
}
function describe(error) {
    return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
//# sourceMappingURL=package-files.js.map