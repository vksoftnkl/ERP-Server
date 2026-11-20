"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESIGNATION_CODE_MAX_LENGTH = exports.EMPLOYEE_CODE_RULE = exports.MASTER_SHORT_NAME_RULE = exports.DEPARTMENT_CODE_RULE = exports.COMPANY_CODE_RULE = void 0;
exports.initialsCode = initialsCode;
exports.wholeNameCode = wholeNameCode;
exports.firstFreeCode = firstFreeCode;
exports.nextFreeCode = nextFreeCode;
exports.COMPANY_CODE_RULE = {
    skipWords: new Set(['PRIVATE', 'PVT', 'LIMITED', 'LTD', 'THE', 'AND', '&']),
    minLength: 3,
    maxLength: 6,
};
exports.DEPARTMENT_CODE_RULE = exports.COMPANY_CODE_RULE;
exports.MASTER_SHORT_NAME_RULE = exports.COMPANY_CODE_RULE;
exports.EMPLOYEE_CODE_RULE = {
    skipWords: new Set(),
    minLength: 3,
    maxLength: 6,
};
exports.DESIGNATION_CODE_MAX_LENGTH = 20;
function wordsOf(name) {
    return name
        .toUpperCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^A-Z0-9]/g, ''))
        .filter(Boolean);
}
function initialsCode(name, rule) {
    const words = wordsOf(name);
    const kept = words.filter((word) => !rule.skipWords.has(word));
    const source = kept.length ? kept : words;
    if (!source.length) {
        return null;
    }
    let code = source
        .map((word) => word[0])
        .join('')
        .slice(0, rule.maxLength);
    for (const word of source) {
        for (let i = 1; i < word.length && code.length < rule.minLength; i++) {
            code += word[i];
        }
        if (code.length >= rule.minLength) {
            break;
        }
    }
    return code;
}
function wholeNameCode(name, maxLength) {
    const code = wordsOf(name).join('').slice(0, maxLength);
    return code || null;
}
function firstFreeCode(base, taken) {
    const used = new Set();
    for (const code of taken) {
        if (code) {
            used.add(code.trim().toUpperCase());
        }
    }
    let code = base;
    for (let n = 2; used.has(code.toUpperCase()); n++) {
        code = `${base}${n}`;
    }
    return code;
}
async function nextFreeCode(base, takenStartingWith) {
    if (!base) {
        return null;
    }
    return firstFreeCode(base, await takenStartingWith(base));
}
//# sourceMappingURL=code-from-name.js.map