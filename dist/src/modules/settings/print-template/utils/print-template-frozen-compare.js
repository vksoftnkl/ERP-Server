"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATASET_COMPARE = exports.VERSION_DESIGN_COMPARE = void 0;
exports.jsonDeepEqual = jsonDeepEqual;
exports.sentValueDiffers = sentValueDiffers;
exports.changedVersionKeys = changedVersionKeys;
exports.datasetsDifference = datasetsDifference;
const client_1 = require("@prisma/client");
const isBlank = (v) => v === null || (typeof v === 'string' && v.trim() === '');
function jsonDeepEqual(a, b) {
    if (a === b)
        return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        if (typeof a === 'number' && typeof b === 'number')
            return a === b;
        return false;
    }
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    if (Array.isArray(a) && Array.isArray(b))
        return a.length === b.length && a.every((x, i) => jsonDeepEqual(x, b[i]));
    const ka = Object.keys(a).filter((k) => a[k] !== undefined).sort();
    const kb = Object.keys(b).filter((k) => b[k] !== undefined).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && jsonDeepEqual(a[k], b[k]));
}
const parseJson = (v) => {
    if (typeof v !== 'string')
        return { ok: true, value: v };
    try {
        return { ok: true, value: JSON.parse(v) };
    }
    catch {
        return { ok: false, value: undefined };
    }
};
function decimalOf(v) {
    if (v === null || v === undefined || v === '')
        return null;
    try {
        return new client_1.Prisma.Decimal(v);
    }
    catch {
        return null;
    }
}
function sentValueDiffers(kind, sent, stored) {
    if (sent === undefined)
        return false;
    if (isBlank(sent) && isBlank(stored ?? null))
        return false;
    switch (kind) {
        case 'number': {
            const a = decimalOf(sent), b = decimalOf(stored);
            if (a === null || b === null)
                return !(a === null && b === null);
            return !a.equals(b);
        }
        case 'json': {
            const a = parseJson(sent), b = parseJson(stored);
            if (!a.ok || !b.ok)
                return sent !== stored;
            return !jsonDeepEqual(a.value ?? null, b.value ?? null);
        }
        case 'body': {
            if (sent === stored)
                return false;
            const a = parseJson(sent), b = parseJson(stored);
            if (a.ok && b.ok && typeof sent === 'string' && typeof stored === 'string')
                return !jsonDeepEqual(a.value, b.value);
            return true;
        }
        default: {
            const a = typeof sent === 'string' ? sent.trim() : sent;
            const b = typeof stored === 'string' ? stored.trim() : stored ?? null;
            return a !== b;
        }
    }
}
exports.VERSION_DESIGN_COMPARE = {
    ptvRevNo: 'number', ptvEngine: 'text', ptvBody: 'body', ptvSchemaVer: 'number', ptvPaperCode: 'text', ptvOrientation: 'text',
    ptvWidthMm: 'number', ptvHeightMm: 'number', ptvMarginTopMm: 'number', ptvMarginBottomMm: 'number', ptvMarginLeftMm: 'number',
    ptvMarginRightMm: 'number', ptvColumns: 'number', ptvLang: 'text', ptvFontFamily: 'text', ptvParams: 'json', ptvNote: 'text',
};
function changedVersionKeys(row, stored, sentKeys) {
    return sentKeys.filter((k) => sentValueDiffers(exports.VERSION_DESIGN_COMPARE[k] ?? 'text', row[k], stored[k]));
}
exports.DATASET_COMPARE = {
    ptdRole: 'text', ptdDatasetNo: 'number', ptdSortOrder: 'number', ptdName: 'text', ptdLabel: 'text', ptdSourceKind: 'text',
    ptdProviderCode: 'text', ptdSql: 'text', ptdParentNo: 'number', ptdLinkFields: 'text', ptdRowLimit: 'number', ptdTimeoutMs: 'number',
    ptdRemarks: 'text',
};
function datasetsDifference(sent, stored) {
    if (sent.length !== stored.length)
        return `${sent.length} datasets sent, ${stored.length} stored`;
    const byId = new Map(stored.map((d) => [d.ptdId, d]));
    const seen = new Set();
    for (let i = 0; i < sent.length; i++) {
        const r = sent[i];
        const id = r.ptdId;
        if (!id || !byId.has(id) || seen.has(id))
            return `datasets[${i}] is not one of the stored datasets`;
        seen.add(id);
        if (r.ptdIsDeleted === true)
            return `datasets[${i}] would be deleted`;
        const s = byId.get(id);
        const k = Object.keys(exports.DATASET_COMPARE).find((key) => sentValueDiffers(exports.DATASET_COMPARE[key], r[key], s[key]));
        if (k)
            return `datasets[${i}].${k}`;
    }
    return null;
}
//# sourceMappingURL=print-template-frozen-compare.js.map