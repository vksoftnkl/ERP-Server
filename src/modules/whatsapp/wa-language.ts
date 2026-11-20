import { WA_CODES, WA_TEST_LANG, type WaKind } from './wa.constants';

/** One mirrored template row (public.wa_template), as the language pick reads it. */
export interface TemplateMirror {
  name: string;
  lang: string;
  status: string;
  params: string[];
  headerKind: string;
}

export type LanguagePick =
  | { ok: true; lang: string; template: TemplateMirror; note: string | null; wanted: string }
  | { ok: false; code: typeof WA_CODES.TEMPLATE_NOT_APPROVED; wanted: string; note: string };

const LANG_NAME: Record<string, string> = { en: 'English', ta: 'Tamil' };

/**
 * Plan §5.2 step 5 / Q7 — the language a message goes in.
 *
 * Wanted = the request's `lang` (a hand send), else the party's Message language
 * (led_wa_lang), else the company's whatsapp.default_language, else en. When the
 * wanted language's template is not APPROVED at Meta, English goes if IT is
 * approved, and the log notes why; with neither, the send FAILS
 * WA_TEMPLATE_NOT_APPROVED. The test template is en_US whatever is wanted.
 */
export function pickLanguage(p: {
  kind: WaKind;
  templateName: string;
  requested?: string | null;
  partyLang?: string | null;
  companyDefault?: string | null;
  templates: readonly TemplateMirror[];
}): LanguagePick {
  const approved = (lang: string) =>
    p.templates.find(
      (t) => t.name === p.templateName && t.lang === lang && t.status === 'APPROVED',
    );
  if (p.kind === 'TEST') {
    const t = approved(WA_TEST_LANG);
    return t
      ? { ok: true, lang: WA_TEST_LANG, template: t, note: null, wanted: WA_TEST_LANG }
      : {
          ok: false,
          code: WA_CODES.TEMPLATE_NOT_APPROVED,
          wanted: WA_TEST_LANG,
          note: `${p.templateName} (${WA_TEST_LANG}) is not approved`,
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
    code: WA_CODES.TEMPLATE_NOT_APPROVED,
    wanted,
    note: `${p.templateName} is not approved in ${LANG_NAME[wanted] ?? wanted}${wanted !== 'en' ? ' or English' : ''}`,
  };
}

function clean(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().toLowerCase();
  return t === 'en' || t === 'ta' ? t : null;
}
