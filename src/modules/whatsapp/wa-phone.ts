import { WA_CODES, type WaPhoneSource } from './wa.constants';

/**
 * Plan §5.2 step 3 / decision 21 — the phone normaliser.
 *
 * A port of NexERP `NexWhatsApp::normalisePhone` (src/shared/utils/nex_whatsapp.cpp):
 * digits only; a leading 00 dropped; 11 digits starting 0 → the 0 dropped; 10 digits
 * → the country code in front; 11–15 digits kept. PLUS the India mobile check the Qt
 * helper does not make (Q4: landlines are skipped): a 91 number must be 91 + [6-9]
 * + 9 digits. The relay's fake numbers 916000NNNNNN pass.
 */
export const DEFAULT_COUNTRY_CODE = '91';

export type PhoneVerdict =
  | { ok: true; phone: string }
  | { ok: false; reason: 'EMPTY' | 'BAD' };

export function normalisePhone(raw: string | null | undefined, countryCode = DEFAULT_COUNTRY_CODE): PhoneVerdict {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) {
    return { ok: false, reason: 'EMPTY' };
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    digits = countryCode + digits;
  }
  if (digits.length < 11 || digits.length > 15) {
    return { ok: false, reason: 'BAD' };
  }
  if (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) {
    return { ok: false, reason: 'BAD' };
  }
  return { ok: true, phone: digits };
}

/** The digits a phone column holds, normalised, or null. For matching a STOP to ledgers. */
export function normalisedOrNull(raw: string | null | undefined): string | null {
  const v = normalisePhone(raw);
  return v.ok ? v.phone : null;
}

export interface PhoneCandidate {
  source: WaPhoneSource;
  raw: string | null | undefined;
}

export type PhoneChoice =
  | { ok: true; phone: string; source: WaPhoneSource }
  | { ok: false; code: typeof WA_CODES.NO_NUMBER | typeof WA_CODES.BAD_NUMBER; tried: WaPhoneSource[] };

/**
 * Q4 — the first candidate, in the order given, that is a usable mobile number.
 * None given at all → WA_NO_NUMBER; some given but none usable (a landline, a
 * short number) → WA_BAD_NUMBER.
 */
export function choosePhone(candidates: readonly PhoneCandidate[]): PhoneChoice {
  const tried: WaPhoneSource[] = [];
  for (const c of candidates) {
    const v = normalisePhone(c.raw);
    if (v.ok) {
      return { ok: true, phone: v.phone, source: c.source };
    }
    if (v.reason === 'BAD') {
      tried.push(c.source);
    }
  }
  return tried.length > 0
    ? { ok: false, code: WA_CODES.BAD_NUMBER, tried }
    : { ok: false, code: WA_CODES.NO_NUMBER, tried };
}

/**
 * The number order of one send (§5.2 step 3, F12):
 *   - a number typed in the send popup goes first (MANUAL, and a RETRY of a
 *     popup-typed number: review S5);
 *   - a walk-in (the sales default customer) gets the typed numbers only;
 *   - otherwise ledger WhatsApp no → phone 1 → phone 2 → the number typed on the document.
 */
export function phoneCandidates(p: {
  ledger: { whatsapp: string | null; phone1: string | null; phone2: string | null } | null;
  docPhone?: string | null;
  bodyPhone?: string | null;
  walkIn: boolean;
}): PhoneCandidate[] {
  const out: PhoneCandidate[] = [];
  if (p.bodyPhone) {
    out.push({ source: 'TYPED', raw: p.bodyPhone });
  }
  if (!p.walkIn && p.ledger) {
    out.push({ source: 'WHATSAPP', raw: p.ledger.whatsapp });
    out.push({ source: 'PHONE1', raw: p.ledger.phone1 });
    out.push({ source: 'PHONE2', raw: p.ledger.phone2 });
  }
  if (p.docPhone) {
    out.push({ source: 'TYPED', raw: p.docPhone });
  }
  return out;
}
