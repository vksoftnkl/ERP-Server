import { WA_CODES, type WaPhoneSource } from './wa.constants';
export declare const DEFAULT_COUNTRY_CODE = "91";
export type PhoneVerdict = {
    ok: true;
    phone: string;
} | {
    ok: false;
    reason: 'EMPTY' | 'BAD';
};
export declare function normalisePhone(raw: string | null | undefined, countryCode?: string): PhoneVerdict;
export declare function normalisedOrNull(raw: string | null | undefined): string | null;
export interface PhoneCandidate {
    source: WaPhoneSource;
    raw: string | null | undefined;
}
export type PhoneChoice = {
    ok: true;
    phone: string;
    source: WaPhoneSource;
} | {
    ok: false;
    code: typeof WA_CODES.NO_NUMBER | typeof WA_CODES.BAD_NUMBER;
    tried: WaPhoneSource[];
};
export declare function choosePhone(candidates: readonly PhoneCandidate[]): PhoneChoice;
export declare function phoneCandidates(p: {
    ledger: {
        whatsapp: string | null;
        phone1: string | null;
        phone2: string | null;
    } | null;
    docPhone?: string | null;
    bodyPhone?: string | null;
    walkIn: boolean;
}): PhoneCandidate[];
