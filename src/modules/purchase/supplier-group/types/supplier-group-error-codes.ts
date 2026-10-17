/**
 * Notes 119 / 127 §5 — every refusal of the Supplier Group master
 * (/supplier-groups) carries one of these as `errors[].code`; the client words
 * its box by the code alone. One meaning per code: a site with a new meaning
 * gets a new member, never an old one.
 */
export enum SupplierGroupErrorCode {
  /** spgName was blank. */
  NAME_REQUIRED = 'PURCHASE_SUPPLIER_GROUP_NAME_REQUIRED',
  /** Another live supplier group already has this name (checked first, or the unique index refused it). */
  NAME_EXISTS = 'PURCHASE_SUPPLIER_GROUP_NAME_EXISTS',
  /** No live supplier group with this spgId. */
  NOT_FOUND = 'PURCHASE_SUPPLIER_GROUP_NOT_FOUND',
  /** A delete of a supplier group that live suppliers still point at. */
  HAS_SUPPLIERS = 'PURCHASE_SUPPLIER_GROUP_HAS_SUPPLIERS',
}
