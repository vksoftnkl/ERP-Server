"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsComplexScript = exports.splitScriptRuns = exports.isTamilCodePoint = void 0;
const isTamilCodePoint = (codePoint) => (codePoint >= 0x0b80 && codePoint <= 0x0bff) || (codePoint >= 0x11fc0 && codePoint <= 0x11fff);
exports.isTamilCodePoint = isTamilCodePoint;
const isNeutralCodePoint = (codePoint) => codePoint === 0x20 ||
    codePoint === 0x09 ||
    (codePoint >= 0x30 && codePoint <= 0x39) ||
    codePoint === 0x2c ||
    codePoint === 0x2e ||
    codePoint === 0x2d ||
    codePoint === 0x2f ||
    codePoint === 0x3a ||
    codePoint === 0x3b ||
    codePoint === 0x28 ||
    codePoint === 0x29 ||
    codePoint === 0x25 ||
    codePoint === 0x2b ||
    codePoint === 0x23;
const splitScriptRuns = (text) => {
    if (!text) {
        return [];
    }
    const runs = [];
    for (const character of text) {
        const codePoint = character.codePointAt(0) ?? 0;
        const script = (0, exports.isTamilCodePoint)(codePoint) ? 'tamil' : 'latin';
        const last = runs[runs.length - 1];
        if (last && (isNeutralCodePoint(codePoint) || last.script === script)) {
            last.text += character;
            continue;
        }
        runs.push({ script, text: character });
    }
    return runs;
};
exports.splitScriptRuns = splitScriptRuns;
const containsComplexScript = (text) => {
    for (const character of text) {
        if ((0, exports.isTamilCodePoint)(character.codePointAt(0) ?? 0)) {
            return true;
        }
    }
    return false;
};
exports.containsComplexScript = containsComplexScript;
//# sourceMappingURL=script-runs.js.map