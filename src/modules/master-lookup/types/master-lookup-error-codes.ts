/**
 * Notes 119 / 127 §5 — every Master Lookup refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum MasterLookupErrorCode {
  /** cus_id names no live customer. */
  CUSTOMER_NOT_FOUND = 'LOOKUP_CUSTOMER_NOT_FOUND',
  /** item_id names no live item. */
  ITEM_NOT_FOUND = 'LOOKUP_ITEM_NOT_FOUND',
  /** lot_id names no lot of that item. */
  LOT_NOT_FOUND = 'LOOKUP_LOT_NOT_FOUND',
  /** The item (or the unit asked for) has no live price row at all. */
  PRICE_NOT_FOUND = 'LOOKUP_PRICE_NOT_FOUND',
  /** The unit is priced, but not at this MRP / sale price, and has no headline row to fall back on. */
  BUCKET_PRICE_NOT_FOUND = 'LOOKUP_BUCKET_PRICE_NOT_FOUND',
  /** loading_type 'auto' was asked without both company_id and branch_id. */
  LOADING_SCOPE_REQUIRED = 'LOOKUP_LOADING_SCOPE_REQUIRED',
  /** loading_type 'auto': the item's unit conversion has no UOM weight to match a slab on. */
  LOADING_WEIGHT_MISSING = 'LOOKUP_LOADING_WEIGHT_MISSING',
  /** No live barcode (EAN) row has this code. */
  BARCODE_NOT_FOUND = 'LOOKUP_BARCODE_NOT_FOUND',
  /** The barcode exists, but its item is not a live item of the company / branch asked for. */
  BARCODE_ITEM_NOT_FOUND = 'LOOKUP_BARCODE_ITEM_NOT_FOUND',
  /** No document of that module has this number in the company / branch. */
  DOCUMENT_NOT_FOUND = 'LOOKUP_DOCUMENT_NOT_FOUND',
  /** company_id names no live company. */
  COMPANY_NOT_FOUND = 'LOOKUP_COMPANY_NOT_FOUND',
}
