"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setErrorWording = setErrorWording;
exports.errorWordingVersion = errorWordingVersion;
exports.wordingFor = wordingFor;
exports.withUserWording = withUserWording;
exports.withUserWordingOnNotes = withUserWordingOnNotes;
exports.wordingLangOf = wordingLangOf;
exports.wordedResponse = wordedResponse;
exports.fillPlaceholders = fillPlaceholders;
const DEFAULT_LANG = 'en';
let exact = new Map();
let prefixes = new Map();
let catalogueVersion = null;
function setErrorWording(rows, version) {
    const nextExact = new Map();
    const nextPrefixes = new Map();
    for (const row of rows) {
        const isPrefix = row.code.endsWith('*');
        const key = isPrefix ? row.code.slice(0, -1) : row.code;
        const byLang = isPrefix ? nextPrefixes : nextExact;
        const codes = byLang.get(row.lang) ?? new Map();
        byLang.set(row.lang, codes);
        const entry = codes.get(key) ?? { plain: null, variants: [] };
        codes.set(key, entry);
        const variant = parseVariant(row.variant);
        if (variant) {
            entry.variants.push({ ...variant, row });
        }
        else {
            entry.plain = row;
        }
    }
    exact = nextExact;
    prefixes = new Map([...nextPrefixes].map(([lang, codes]) => [
        lang,
        [...codes]
            .map(([prefix, entry]) => ({ prefix, entry }))
            .sort((a, b) => b.prefix.length - a.prefix.length),
    ]));
    catalogueVersion = version;
}
function errorWordingVersion() {
    return catalogueVersion;
}
function wordingFor(detail, lang = DEFAULT_LANG) {
    const code = typeof detail.code === 'string' ? detail.code : null;
    if (!code) {
        return null;
    }
    const langs = lang === DEFAULT_LANG ? [lang] : [lang, DEFAULT_LANG];
    for (const l of langs) {
        const entry = exact.get(l)?.get(code);
        const row = entry ? pick(entry, detail) : null;
        if (row) {
            return toUser(row, detail);
        }
        for (const p of prefixes.get(l) ?? []) {
            if (code.startsWith(p.prefix)) {
                const prefixed = pick(p.entry, detail);
                if (prefixed) {
                    return toUser(prefixed, detail);
                }
            }
        }
    }
    return null;
}
function withUserWording(body, lang = DEFAULT_LANG) {
    if (!isRecord(body) || !Array.isArray(body.errors)) {
        return body;
    }
    return { ...body, errors: wordList(body.errors, lang) };
}
function withUserWordingOnNotes(body, lang = DEFAULT_LANG) {
    if (!isRecord(body) || !isRecord(body.data)) {
        return body;
    }
    const data = body.data;
    const lists = ['warnings', 'refusals'].filter((k) => Array.isArray(data[k]));
    if (lists.length === 0) {
        return body;
    }
    const worded = { ...data };
    for (const k of lists) {
        worded[k] = wordList(data[k], lang);
    }
    return { ...body, data: worded };
}
function wordingLangOf(request) {
    const query = isRecord(request.query) ? request.query.lang : undefined;
    const header = request.headers?.['accept-language'];
    const raw = (typeof query === 'string' && query) ||
        (typeof header === 'string' && header.split(',')[0]) ||
        DEFAULT_LANG;
    const lang = raw.trim().toLowerCase().split(/[-_;]/)[0];
    return /^[a-z]{2}$/.test(lang) ? lang : DEFAULT_LANG;
}
function wordedResponse(response, request) {
    const lang = wordingLangOf(isRecord(request) ? request : {});
    return {
        status: (code) => ({
            json: (body) => response.status(code).json(withUserWording(body, lang)),
        }),
    };
}
function wordList(items, lang) {
    return items.map((item) => {
        if (!isRecord(item) || isRecord(item.user)) {
            return item;
        }
        const user = wordingFor(item, lang);
        return user ? { ...item, user } : item;
    });
}
function pick(entry, detail) {
    const valueOf = (key) => {
        const v = detail[key];
        return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : null;
    };
    const byField = entry.variants.find((v) => v.key === 'field' && v.value !== null && valueOf('field') === v.value);
    if (byField) {
        return byField.row;
    }
    const byValue = entry.variants.find((v) => v.key !== 'field' && v.value !== null && valueOf(v.key) === v.value);
    if (byValue) {
        return byValue.row;
    }
    const byAny = entry.variants.find((v) => v.value === null && valueOf(v.key) !== null);
    if (byAny) {
        return byAny.row;
    }
    return entry.plain;
}
function parseVariant(variant) {
    const at = variant.indexOf('=');
    if (!variant || at <= 0) {
        return null;
    }
    const value = variant.slice(at + 1);
    return { key: variant.slice(0, at), value: value === '*' ? null : value };
}
function toUser(row, detail = {}) {
    const values = placeholderValues(detail);
    return {
        title: fillPlaceholders(row.title, values),
        line: fillPlaceholders(row.line, values),
        todo: fillPlaceholders(row.todo, values),
    };
}
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
function placeholderValues(detail) {
    const out = new Map();
    const put = (k, v) => {
        if (out.has(k)) {
            return;
        }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
            const text = String(v).trim();
            if (text) {
                out.set(k, text);
            }
        }
        else if (Array.isArray(v)) {
            const text = v
                .filter((x) => typeof x === 'string' || typeof x === 'number')
                .map(String)
                .join(', ');
            if (text) {
                out.set(k, text);
            }
        }
    };
    if (isRecord(detail.params)) {
        for (const [k, v] of Object.entries(detail.params)) {
            put(k, v);
        }
    }
    for (const [k, v] of Object.entries(detail)) {
        if (k !== 'params' && k !== 'user' && k !== 'message') {
            put(k, v);
        }
    }
    return out;
}
function fillPlaceholders(text, values) {
    if (!text || !text.includes('{')) {
        return text;
    }
    let out = text.replace(PLACEHOLDER, (whole, name) => values.get(name) ?? whole);
    if (!/\{[A-Za-z][A-Za-z0-9_]*\}/.test(out)) {
        return out;
    }
    out = out
        .replace(/\s*\(\s*\{[A-Za-z][A-Za-z0-9_]*\}\s*\)/g, '')
        .replace(/ ?\{[A-Za-z][A-Za-z0-9_]*\}/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1')
        .trim();
    return out;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=error-wording.js.map