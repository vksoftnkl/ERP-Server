/**
 * Notes 119 / 127 §5 — the quotation's own refusal codes (`errors[].code`); the
 * client words its box by the code alone. A refusal whose meaning is shared by
 * every sales document (not found, line number twice, a line field required …)
 * answers the shared SALES_ERROR_CODES member instead (posting/types/
 * posting.types.ts). One meaning per code: a site with a new meaning gets a new
 * member, never an old one.
 */
export enum QuotationErrorCode {
  /** A date field on the quotation was not a valid ISO date. */
  INVALID_DATE = 'QUOTATION_INVALID_DATE',
  /** A quotation lookup named neither sqId nor sqQuoteNo. */
  LOOKUP_KEY_REQUIRED = 'QUOTATION_LOOKUP_KEY_REQUIRED',
  /** The quotation reference number is already used in this company / branch / year. */
  QUOTE_NO_TAKEN = 'QUOTATION_QUOTE_NO_TAKEN',
  /** The quotation serial number (sqQuoteSlno) is already used. */
  SLNO_TAKEN = 'QUOTATION_SLNO_TAKEN',

  // ─── applied charges (txn_charge_detail rows of the quotation) ────────────
  /** The same charge line number (cdSlno) appears twice on one save. */
  CHARGE_LINE_NO_DUPLICATE = 'QUOTATION_CHARGE_LINE_NO_DUPLICATE',
  /** A cdId on the save is not a live charge of this quotation. */
  CHARGE_NOT_FOUND = 'QUOTATION_CHARGE_NOT_FOUND',
  /** A field a charge line needs (cdChgId, cdLedgerCode, a non-nullable guarded value) was not given. */
  CHARGE_FIELD_REQUIRED = 'QUOTATION_CHARGE_FIELD_REQUIRED',
  /** A charge vocabulary field (cdRole, cdMethod, cdType, cdApplyOn, cdCostAlloc) held a value outside its list. */
  CHARGE_VALUE_NOT_ALLOWED = 'QUOTATION_CHARGE_VALUE_NOT_ALLOWED',
  /** cdTaxApl and cdBeforeTax were both set on one charge (they are mutually exclusive). */
  CHARGE_TAX_EXCLUSIVE = 'QUOTATION_CHARGE_TAX_EXCLUSIVE',
  /** cdTaxCode was given on a charge that does not carry its own GST. */
  CHARGE_TAX_CODE_UNUSED = 'QUOTATION_CHARGE_TAX_CODE_UNUSED',
}
