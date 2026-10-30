/**
 * Notes 119 / 127 §5 — every refusal of the Customer master (/customers) carries
 * one of these as `errors[].code`; the client words its box by the code alone.
 * One meaning per code: a site with a new meaning gets a new member, never an
 * old one.
 */
export enum CustomerErrorCode {
  /** cusName was blank. */
  NAME_REQUIRED = 'CUSTOMER_NAME_REQUIRED',
  /** cusStateName was blank. */
  STATE_NAME_REQUIRED = 'CUSTOMER_STATE_NAME_REQUIRED',
  /** cusStateCode was not exactly 2 characters. */
  STATE_CODE_INVALID = 'CUSTOMER_STATE_CODE_INVALID',
  /** A date field was not a valid ISO date. */
  INVALID_DATE = 'CUSTOMER_INVALID_DATE',
  /** No live customer with this cusId. */
  NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  /** The database refused the write as a duplicate customer (a unique index). */
  DUPLICATE = 'CUSTOMER_DUPLICATE',
  /** The linked ledger's company-wide name check refused the customer's name. */
  NAME_EXISTS = 'CUSTOMER_NAME_EXISTS',
  /** An update sent a cusLinkLedId other than the customer's own id (linking is create-only). */
  LINK_LEDGER_ON_UPDATE = 'CUSTOMER_LINK_LEDGER_ON_UPDATE',
  /** cusLinkLedId names no live account ledger. */
  LINK_LEDGER_NOT_FOUND = 'CUSTOMER_LINK_LEDGER_NOT_FOUND',
  /** cusLinkLedId names a ledger that is not a PARTY ledger. */
  LINK_LEDGER_NOT_PARTY = 'CUSTOMER_LINK_LEDGER_NOT_PARTY',
  /** cusLinkLedId names a ledger that is already a customer. */
  LINK_LEDGER_ALREADY_CUSTOMER = 'CUSTOMER_LINK_LEDGER_ALREADY_CUSTOMER',
  /** cusAreaId names no live area. */
  AREA_NOT_FOUND = 'CUSTOMER_AREA_NOT_FOUND',
  /** cusCompanyId names no live company. */
  COMPANY_NOT_FOUND = 'CUSTOMER_COMPANY_NOT_FOUND',
  /**
   * cusGroupId names no live customer group. (Not CUSTOMER_GROUP_NOT_FOUND: that is
   * the Customer Group master's own 404.)
   */
  GROUP_NOT_FOUND = 'CUSTOMER_UNKNOWN_GROUP',
  /** cusStateCode names no live state. */
  STATE_NOT_FOUND = 'CUSTOMER_STATE_NOT_FOUND',
  /** cusPriceLevelId names no live price level (0 included: a blank the client sent as 0). */
  PRICE_LEVEL_NOT_FOUND = 'CUSTOMER_PRICE_LEVEL_NOT_FOUND',
  /** cusBranchId was sent and names no live branch. */
  BRANCH_NOT_FOUND = 'CUSTOMER_BRANCH_NOT_FOUND',
  /** cusGstNo's first two digits are not the customer's state code (cusStateCode). */
  GSTIN_STATE_MISMATCH = 'CUSTOMER_GSTIN_STATE_MISMATCH',
  /** Delete: the ledger's lifetime balance is not 0 in a company (party rules D1). */
  HAS_BALANCE = 'CUSTOMER_HAS_BALANCE',
  /** Delete: a cheque of this party is HELD / DEPOSITED and posts only on clearing (Q3). */
  HAS_CHEQUE_IN_HAND = 'CUSTOMER_HAS_CHEQUE_IN_HAND',
  /** cusGstType is not one of REGULAR / COMPOSITION / SEZ / OVERSEAS / UNREGISTERED (D2). */
  GST_TYPE_INVALID = 'CUSTOMER_GST_TYPE_INVALID',
  /** cusGstType blank while a GSTIN is given. */
  GST_TYPE_REQUIRED = 'CUSTOMER_GST_TYPE_REQUIRED',
  /** A REGULAR / COMPOSITION / SEZ customer has no GSTIN. */
  GSTIN_REQUIRED = 'CUSTOMER_GSTIN_REQUIRED',
  /** An UNREGISTERED / OVERSEAS customer has a GSTIN (Q5). */
  GSTIN_NOT_ALLOWED = 'CUSTOMER_GSTIN_NOT_ALLOWED',
  /** An OVERSEAS customer's state is not 96 Other Country (Q6). */
  OVERSEAS_STATE = 'CUSTOMER_OVERSEAS_STATE',
  /** A company change on a party with books in its current company (Q7 = a). */
  COMPANY_HAS_BOOKS = 'CUSTOMER_COMPANY_HAS_BOOKS',
}
