"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACTED = void 0;
exports.parsePath = parsePath;
exports.getPath = getPath;
exports.redactPaths = redactPaths;
exports.REDACTED = '***';
function parsePath(path) {
    if (!path.startsWith('$')) {
        throw new Error(`JSONPath must start with $: ${path}`);
    }
    const segments = [];
    const pattern = /\.([A-Za-z_$][\w$-]*)|\[(\d+)\]|\['([^']*)'\]|\["([^"]*)"\]/y;
    let index = 1;
    while (index < path.length) {
        pattern.lastIndex = index;
        const match = pattern.exec(path);
        if (!match) {
            throw new Error(`Unsupported JSONPath at "${path.slice(index)}": ${path}`);
        }
        segments.push(match[1] ?? (match[2] !== undefined ? Number(match[2]) : (match[3] ?? match[4])));
        index = pattern.lastIndex;
    }
    return segments;
}
function getPath(root, path) {
    let current = root;
    for (const segment of parsePath(path)) {
        if (current === null || typeof current !== 'object') {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
function redactPaths(root, paths) {
    if (root === null || typeof root !== 'object') {
        return root;
    }
    const copy = structuredClone(root);
    for (const path of paths) {
        let segments;
        try {
            segments = parsePath(path);
        }
        catch {
            return exports.REDACTED;
        }
        if (!segments.length) {
            return exports.REDACTED;
        }
        let parent = copy;
        for (const segment of segments.slice(0, -1)) {
            parent =
                parent !== null && typeof parent === 'object'
                    ? parent[segment]
                    : undefined;
        }
        const last = segments[segments.length - 1];
        if (parent !== null && typeof parent === 'object' && last in parent) {
            parent[last] = exports.REDACTED;
        }
    }
    return copy;
}
//# sourceMappingURL=gst-json-path.js.map