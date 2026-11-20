import { WA_CODES, type WaKind } from './wa.constants';
export interface TemplateMirror {
    name: string;
    lang: string;
    status: string;
    params: string[];
    headerKind: string;
}
export type LanguagePick = {
    ok: true;
    lang: string;
    template: TemplateMirror;
    note: string | null;
    wanted: string;
} | {
    ok: false;
    code: typeof WA_CODES.TEMPLATE_NOT_APPROVED;
    wanted: string;
    note: string;
};
export declare function pickLanguage(p: {
    kind: WaKind;
    templateName: string;
    requested?: string | null;
    partyLang?: string | null;
    companyDefault?: string | null;
    templates: readonly TemplateMirror[];
}): LanguagePick;
