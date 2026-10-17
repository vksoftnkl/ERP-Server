/**
 * Notes 119 / 127 §5 — every refusal Tender Type Master raises carries one of
 * these as `errors[].code`; the Qt client words its box by the code alone, so
 * each string is an API contract: rename one and the box loses its wording.
 */
export enum TenderTypeErrorCode {
  /** No live (not deleted) tender type has the ttmTypeId given (404). */
  NOT_FOUND = 'TENDER_TYPE_NOT_FOUND',
  /** ttmTypeId is missing or not a whole number that fits the 32-bit id. */
  ID_INVALID = 'TENDER_TYPE_ID_INVALID',
  /** Delete refused: live tenders in Tender Master still use this type. */
  IN_USE = 'TENDER_TYPE_IN_USE',
  /** Another tender type (a deleted one included) already has this name (409). */
  NAME_TAKEN = 'TENDER_TYPE_NAME_TAKEN',
  /** A unique index (the name, or the id two concurrent creates raced for) refused the save (409). */
  DUPLICATE = 'TENDER_TYPE_DUPLICATE',
}
