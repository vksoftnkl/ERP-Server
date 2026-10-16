/**
 * Notes 119 / 127 §5 — every refusal of the Customer Group master
 * (/customer-groups) carries one of these as `errors[].code`; the client words
 * its box by the code alone. One meaning per code: a site with a new meaning
 * gets a new member, never an old one.
 */
export enum CustomerGroupErrorCode {
  /** cgrName was blank. */
  NAME_REQUIRED = 'CUSTOMER_GROUP_NAME_REQUIRED',
  /** Another live customer group of the company already has this name (checked first, or the unique index refused it). */
  NAME_EXISTS = 'CUSTOMER_GROUP_NAME_EXISTS',
  /** No live customer group with this cgrId. */
  NOT_FOUND = 'CUSTOMER_GROUP_NOT_FOUND',
  /** cgrCompanyId names no live company. */
  COMPANY_NOT_FOUND = 'CUSTOMER_GROUP_COMPANY_NOT_FOUND',
  /** A delete of a customer group that live customers still point at. */
  HAS_CUSTOMERS = 'CUSTOMER_GROUP_HAS_CUSTOMERS',
}
