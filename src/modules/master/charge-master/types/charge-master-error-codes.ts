/**
 * Notes 119 / 127 §5 — every refusal the Charge master raises carries one of
 * these in `errors[].code`. The Qt client words its box by the code alone, so
 * each string is an API contract: rename one and the box loses its wording.
 * (Charge Detail — the per-document charge lines — has its own CHARGE_DETAIL_ set.)
 */
export const CHARGE_ERROR = {
  /** The lookup sent both chgId and chgModule. */
  LOOKUP_AMBIGUOUS: 'CHARGE_LOOKUP_AMBIGUOUS',
  /** The lookup sent neither chgId nor chgModule. */
  LOOKUP_MISSING: 'CHARGE_LOOKUP_MISSING',
  /** chgLedgerCode names no active (non-deleted) ledger. */
  LEDGER_NOT_FOUND: 'CHARGE_LEDGER_NOT_FOUND',
  /** chgTaxId is set on a charge that is not taxable or is applied before tax (ck_chg_tax_id). */
  TAX_NOT_APPLICABLE: 'CHARGE_TAX_NOT_APPLICABLE',
  /** Another live charge already has this chgCode (case-insensitive) — 409. */
  CODE_DUPLICATE: 'CHARGE_CODE_DUPLICATE',
  /** A guarded value (chgModule / chgMethod / chgApplyOn …) that may not be null was null. */
  VALUE_REQUIRED: 'CHARGE_VALUE_REQUIRED',
  /** A guarded value (chgModule / chgRole / chgMethod / chgType / chgApplyOn / chgCostAlloc) is not in its allowed list. */
  VALUE_NOT_ALLOWED: 'CHARGE_VALUE_NOT_ALLOWED',
  /** The module already has a live charge of this one-per-module role (uq_charge_role) — 409. */
  ROLE_DUPLICATE: 'CHARGE_ROLE_DUPLICATE',
  /** The database refused the write on a unique index (a race past the code / role checks) — 409. */
  DUPLICATE: 'CHARGE_DUPLICATE',
  /** The database refused the write on a foreign key: the ledger or tax rate does not exist. */
  REFERENCE_INVALID: 'CHARGE_REFERENCE_INVALID',
  /** No live charge has the requested chgId — 404. */
  NOT_FOUND: 'CHARGE_NOT_FOUND',
} as const;

export type ChargeErrorCode = (typeof CHARGE_ERROR)[keyof typeof CHARGE_ERROR];
