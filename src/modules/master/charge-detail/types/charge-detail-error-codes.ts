/**
 * Notes 119 / 127 §5 — every refusal the Charge Detail module (txn_charge_detail,
 * the charge lines on a document) raises carries one of these in `errors[].code`.
 * The Qt client words its box by the code alone, so each string is an API
 * contract: rename one and the box loses its wording.
 */
export const CHARGE_DETAIL_ERROR = {
  /** The lookup sent cdId together with cdDocType / cdDocId. */
  LOOKUP_AMBIGUOUS: 'CHARGE_DETAIL_LOOKUP_AMBIGUOUS',
  /** The lookup sent neither cdId nor the full cdDocType + cdDocId pair. */
  LOOKUP_MISSING: 'CHARGE_DETAIL_LOOKUP_MISSING',
  /** Two charge lines on one document share a cdSlno (in the payload or against a stored line) — 409. */
  SLNO_DUPLICATE: 'CHARGE_DETAIL_SLNO_DUPLICATE',
  /** The line's cdDocType / cdDocId differs from the document it belongs to (a line cannot move documents). */
  DOCUMENT_LOCKED: 'CHARGE_DETAIL_DOCUMENT_LOCKED',
  /** cdLedgerCode names no active (non-deleted) ledger. */
  LEDGER_NOT_FOUND: 'CHARGE_DETAIL_LEDGER_NOT_FOUND',
  /** cdChgId names no active (non-deleted) charge in the Charge master. */
  CHARGE_NOT_FOUND: 'CHARGE_DETAIL_CHARGE_NOT_FOUND',
  /** A guarded value (cdDocType / cdMethod / cdApplyOn …) that may not be null was null. */
  VALUE_REQUIRED: 'CHARGE_DETAIL_VALUE_REQUIRED',
  /** A guarded value (cdDocType / cdRole / cdMethod / cdType / cdApplyOn / cdCostAlloc) is not in its allowed list. */
  VALUE_NOT_ALLOWED: 'CHARGE_DETAIL_VALUE_NOT_ALLOWED',
  /** cdTaxApl and cdBeforeTax are both set (ck_cd_tax_apl). */
  TAX_APL_BEFORE_TAX: 'CHARGE_DETAIL_TAX_APL_BEFORE_TAX',
  /** cdTaxCode is set on a line that is not taxable or is applied before tax. */
  TAX_NOT_APPLICABLE: 'CHARGE_DETAIL_TAX_NOT_APPLICABLE',
  /** A field a new charge line needs (cdDocType / cdDocId …) was not sent on create. */
  FIELD_REQUIRED: 'CHARGE_DETAIL_FIELD_REQUIRED',
  /** The database refused the write on a foreign key: a charge / ledger / company / branch does not exist. */
  REFERENCE_INVALID: 'CHARGE_DETAIL_REFERENCE_INVALID',
  /** No live charge line has the requested cdId — 404. */
  NOT_FOUND: 'CHARGE_DETAIL_NOT_FOUND',
} as const;

export type ChargeDetailErrorCode = (typeof CHARGE_DETAIL_ERROR)[keyof typeof CHARGE_DETAIL_ERROR];
