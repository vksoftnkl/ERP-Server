/**
 * Notes 119 / 127 §5 — every refusal Company Group Master raises carries one of
 * these as `errors[].code`; the Qt client words its box by the code alone, so
 * each string is an API contract: rename one and the box loses its wording.
 */
export enum CompanyGroupErrorCode {
  /** No live (not deleted) company group has the id given (404). */
  NOT_FOUND = 'COMPANY_GROUP_NOT_FOUND',
  /** Another live company group already has this name, in any letter case (409). */
  NAME_TAKEN = 'COMPANY_GROUP_NAME_TAKEN',
  /** A unique index refused the save: the company group already exists (409). */
  DUPLICATE = 'COMPANY_GROUP_DUPLICATE',
}
