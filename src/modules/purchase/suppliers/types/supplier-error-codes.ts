/**
 * Notes 119 / 127 §5 — every refusal of the Supplier master (/suppliers)
 * carries one of these as `errors[].code`; the client words its box by the code
 * alone. One meaning per code: a site with a new meaning gets a new member,
 * never an old one.
 */
export enum SupplierErrorCode {
  /** supName was blank. */
  NAME_REQUIRED = 'PURCHASE_SUPPLIER_NAME_REQUIRED',
  /** supPurchaseType was blank. */
  PURCHASE_TYPE_REQUIRED = 'PURCHASE_SUPPLIER_PURCHASE_TYPE_REQUIRED',
  /** supStateName was blank. */
  STATE_NAME_REQUIRED = 'PURCHASE_SUPPLIER_STATE_NAME_REQUIRED',
  /** supGstType was blank. */
  GST_TYPE_REQUIRED = 'PURCHASE_SUPPLIER_GST_TYPE_REQUIRED',
  /** supStateCode was not exactly 2 characters. */
  STATE_CODE_INVALID = 'PURCHASE_SUPPLIER_STATE_CODE_INVALID',
  /** No live supplier with this supId. */
  NOT_FOUND = 'PURCHASE_SUPPLIER_NOT_FOUND',
  /** Another live supplier of the company already has this name (checked first, or the unique index refused it). */
  NAME_EXISTS = 'PURCHASE_SUPPLIER_NAME_EXISTS',
  /**
   * supGroupId names no live supplier group. (Not PURCHASE_SUPPLIER_GROUP_NOT_FOUND:
   * that is the Supplier Group master's own 404.)
   */
  UNKNOWN_GROUP = 'PURCHASE_SUPPLIER_UNKNOWN_GROUP',
  /** An update sent a supLinkLedId other than the supplier's own id (linking is create-only). */
  LINK_LEDGER_ON_UPDATE = 'PURCHASE_SUPPLIER_LINK_LEDGER_ON_UPDATE',
  /** supLinkLedId names no live account ledger. */
  LINK_LEDGER_NOT_FOUND = 'PURCHASE_SUPPLIER_LINK_LEDGER_NOT_FOUND',
  /** supLinkLedId names a ledger that is not a PARTY ledger. */
  LINK_LEDGER_NOT_PARTY = 'PURCHASE_SUPPLIER_LINK_LEDGER_NOT_PARTY',
  /** supLinkLedId names a ledger that is already a supplier. */
  LINK_LEDGER_ALREADY_SUPPLIER = 'PURCHASE_SUPPLIER_LINK_LEDGER_ALREADY_SUPPLIER',
  /** ledgerBankAccount rows came with supLinkLedId (save them on a later save). */
  BANK_WITH_LINK_LEDGER = 'PURCHASE_SUPPLIER_BANK_WITH_LINK_LEDGER',
}
