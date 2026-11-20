import { pickLanguage, type TemplateMirror } from './wa-language';

const t = (lang: string, status = 'APPROVED', name = 'nex_order_confirm_v1'): TemplateMirror => ({
  name,
  lang,
  status,
  params: ['customer_name'],
  headerKind: 'DOCUMENT',
});

describe('pickLanguage (§5.2 step 5, Q7)', () => {
  const base = { kind: 'ORDER' as const, templateName: 'nex_order_confirm_v1' };
  it('the party language, else the company default', () => {
    expect(pickLanguage({ ...base, partyLang: 'ta', templates: [t('en'), t('ta')] })).toMatchObject({ ok: true, lang: 'ta', note: null });
    expect(pickLanguage({ ...base, companyDefault: 'ta', templates: [t('en'), t('ta')] })).toMatchObject({ ok: true, lang: 'ta' });
    expect(pickLanguage({ ...base, templates: [t('en'), t('ta')] })).toMatchObject({ ok: true, lang: 'en' });
  });
  it('Tamil not approved → English, with the note', () => {
    expect(pickLanguage({ ...base, partyLang: 'ta', templates: [t('en'), t('ta', 'PENDING')] })).toMatchObject({
      ok: true,
      lang: 'en',
      wanted: 'ta',
      note: 'ta not approved yet: sent in English',
    });
  });
  it('none approved → WA_TEMPLATE_NOT_APPROVED', () => {
    expect(pickLanguage({ ...base, partyLang: 'ta', templates: [t('en', 'PENDING'), t('ta', 'REJECTED')] })).toMatchObject({
      ok: false,
      code: 'WA_TEMPLATE_NOT_APPROVED',
      wanted: 'ta',
    });
  });
  it('the test template is en_US whatever is wanted', () => {
    expect(
      pickLanguage({ kind: 'TEST', templateName: 'hello_world', partyLang: 'ta', templates: [t('en_US', 'APPROVED', 'hello_world')] }),
    ).toMatchObject({ ok: true, lang: 'en_US' });
  });
});
