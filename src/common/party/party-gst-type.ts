import { LedGstPartyRegType } from 'src/modules/accountsModule/accountLedgerMasters/types/account-ledger-master-enum';
import { gstinKindOf } from './party-gstin';

/**
 * Party master rules D2 (Shared/Prathap/party/plan-party-master-rules.md §3.2) — the
 * GST type of a customer or supplier is one of five upper-case codes. One file for
 * both masters, so the customer and the supplier of one party can never disagree on
 * what a type means.
 *
 * | Party type   | GSTIN          | State                 | led_gst_party_reg_type | led_is_sez |
 * |--------------|----------------|-----------------------|------------------------|------------|
 * | REGULAR      | required       | must match the GSTIN  | REGULAR                | false      |
 * | COMPOSITION  | required       | must match the GSTIN  | COMPOSITION            | false      |
 * | SEZ          | required       | must match the GSTIN  | REGULAR                | true       |
 * | OVERSEAS     | must be blank  | 96 Other Country      | UNREGISTERED           | false      |
 * | UNREGISTERED | must be blank  | any                   | UNREGISTERED           | false      |
 */
export const PARTY_GST_TYPES = [
  'REGULAR',
  'COMPOSITION',
  'SEZ',
  'OVERSEAS',
  'UNREGISTERED',
] as const;
export type PartyGstType = (typeof PARTY_GST_TYPES)[number];

/** fixed.state_codes '96' Other Country — the GST portal's code for a foreign party (Q6). */
export const OVERSEAS_STATE_CODE = '96';

const GSTIN_TYPES: ReadonlySet<PartyGstType> = new Set(['REGULAR', 'COMPOSITION', 'SEZ']);

/**
 * Old spellings an old Qt / React build may still send ("Regular", "Unregistered",
 * "SEZ Unit" …), keyed by the upper-cased value with spaces, '_' and '-' removed —
 * the same key the clean-up migration 20261029120000 used.
 */
const LEGACY_KEYS: Readonly<Record<string, PartyGstType>> = {
  REGULAR: 'REGULAR',
  COMPOSITION: 'COMPOSITION',
  SEZ: 'SEZ',
  SEZUNIT: 'SEZ',
  OVERSEAS: 'OVERSEAS',
  UNREGISTERED: 'UNREGISTERED',
};

/**
 * The code for a sent type. `null` = blank (null, '' or only spaces); `'INVALID'` =
 * not one of the five, in any known spelling.
 */
export function normalizePartyGstType(raw: string | null | undefined): PartyGstType | null | 'INVALID' {
  if (raw === null || raw === undefined) {
    return null;
  }
  const key = raw.trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (key === '') {
    return null;
  }
  return LEGACY_KEYS[key] ?? 'INVALID';
}

/** The ledger's two columns for a party type (the ledger CHECK stays three words). */
export function ledgerGstFieldsOf(type: PartyGstType): {
  ledGstPartyRegType: LedGstPartyRegType;
  ledIsSez: boolean;
} {
  switch (type) {
    case 'REGULAR':
      return { ledGstPartyRegType: LedGstPartyRegType.REGULAR, ledIsSez: false };
    case 'COMPOSITION':
      return { ledGstPartyRegType: LedGstPartyRegType.COMPOSITION, ledIsSez: false };
    case 'SEZ':
      return { ledGstPartyRegType: LedGstPartyRegType.REGULAR, ledIsSez: true };
    case 'OVERSEAS':
    case 'UNREGISTERED':
      return { ledGstPartyRegType: LedGstPartyRegType.UNREGISTERED, ledIsSez: false };
  }
}

/** Why a type / GSTIN / state combination is refused; each master says it in its own code. */
export type PartyGstRefusal =
  | { kind: 'TYPE_INVALID'; sent: string }
  | { kind: 'TYPE_REQUIRED' }
  | { kind: 'GSTIN_REQUIRED'; type: PartyGstType }
  | { kind: 'GSTIN_NOT_ALLOWED'; type: PartyGstType }
  | { kind: 'OVERSEAS_STATE'; stateCode: string }
  | { kind: 'GSTIN_STATE_MISMATCH'; gstin: string; gstinState: string; stateCode: string };

/**
 * The type a save stores, or the refusal. `rawType` is what the client sent (or the
 * stored value when the key was left out); `gstin` and `stateCode` are the values the
 * row will hold after the save.
 *
 * - blank type, no GSTIN → UNREGISTERED; blank type with a GSTIN → TYPE_REQUIRED;
 * - REGULAR / COMPOSITION / SEZ need a GSTIN; UNREGISTERED / OVERSEAS refuse one (Q5);
 * - OVERSEAS needs state 96 (Q6);
 * - a NORMAL-shaped GSTIN's first two digits are the state (TDS-deductor, UIN, OIDAR and
 *   NRTP numbers are not checked, as the customer's F10 rule).
 */
export function resolvePartyGstType(input: {
  rawType: string | null | undefined;
  gstin: string | null | undefined;
  stateCode: string;
  /** false skips the GSTIN-state check (the customer runs it on its own, F10). */
  checkGstinState?: boolean;
}): { type: PartyGstType } | { refusal: PartyGstRefusal } {
  const gstin = typeof input.gstin === 'string' && input.gstin.trim() !== '' ? input.gstin.trim() : null;
  const normalized = normalizePartyGstType(input.rawType);
  if (normalized === 'INVALID') {
    return { refusal: { kind: 'TYPE_INVALID', sent: String(input.rawType) } };
  }
  if (normalized === null && gstin !== null) {
    return { refusal: { kind: 'TYPE_REQUIRED' } };
  }
  const type: PartyGstType = normalized ?? 'UNREGISTERED';
  if (GSTIN_TYPES.has(type) && gstin === null) {
    return { refusal: { kind: 'GSTIN_REQUIRED', type } };
  }
  if (!GSTIN_TYPES.has(type) && gstin !== null) {
    return { refusal: { kind: 'GSTIN_NOT_ALLOWED', type } };
  }
  if (type === 'OVERSEAS' && input.stateCode !== OVERSEAS_STATE_CODE) {
    return { refusal: { kind: 'OVERSEAS_STATE', stateCode: input.stateCode } };
  }
  if (input.checkGstinState !== false && gstin !== null && gstinKindOf(gstin) === 'NORMAL') {
    const gstinState = gstin.slice(0, 2);
    if (gstinState !== input.stateCode) {
      return {
        refusal: { kind: 'GSTIN_STATE_MISMATCH', gstin, gstinState, stateCode: input.stateCode },
      };
    }
  }
  return { type };
}

/** The word a person reads for a code ("an Unregistered customer"). */
export function partyGstTypeWord(type: PartyGstType): string {
  switch (type) {
    case 'REGULAR':
      return 'Regular';
    case 'COMPOSITION':
      return 'Composition';
    case 'SEZ':
      return 'SEZ';
    case 'OVERSEAS':
      return 'Overseas';
    case 'UNREGISTERED':
      return 'Unregistered';
  }
}
