"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickLanguage = pickLanguage;
const wa_constants_1 = require("./wa.constants");
const LANG_NAME = { en: 'English', ta: 'Tamil' };
function pickLanguage(p) {
    const approved = (lang) => p.templates.find((t) => t.name === p.templateName && t.lang === lang && t.status === 'APPROVED');
    if (p.kind === 'TEST') {
        const t = approved(wa_constants_1.WA_TEST_LANG);
        return t
            ? { ok: true, lang: wa_constants_1.WA_TEST_LANG, template: t, note: null, wanted: wa_constants_1.WA_TEST_LANG }
            : {
                ok: false,
                code: wa_constants_1.WA_CODES.TEMPLATE_NOT_APPROVED,
                wanted: wa_constants_1.WA_TEST_LANG,
                note: `${p.templateName} (${wa_constants_1.WA_TEST_LANG}) is not approved`,
            };
    }
    const wanted = clean(p.requested) ?? clean(p.partyLang) ?? clean(p.companyDefault) ?? 'en';
    const own = approved(wanted);
    if (own) {
        return { ok: true, lang: wanted, template: own, note: null, wanted };
    }
    if (wanted !== 'en') {
        const en = approved('en');
        if (en) {
            return {
                ok: true,
                lang: 'en',
                template: en,
                wanted,
                note: `${wanted} not approved yet: sent in English`.slice(0, 120),
            };
        }
    }
    return {
        ok: false,
        code: wa_constants_1.WA_CODES.TEMPLATE_NOT_APPROVED,
        wanted,
        note: `${p.templateName} is not approved in ${LANG_NAME[wanted] ?? wanted}${wanted !== 'en' ? ' or English' : ''}`,
    };
}
function clean(v) {
    const t = (v ?? '').trim().toLowerCase();
    return t === 'en' || t === 'ta' ? t : null;
}
//# sourceMappingURL=wa-language.js.map