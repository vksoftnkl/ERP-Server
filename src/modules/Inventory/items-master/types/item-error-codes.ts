/**
 * Notes 119 / 127 §5 — every refusal of the item master (including the
 * composite save, delete and restore) carries one of these as `errors[].code`;
 * the client words its message box by the code alone. Never reuse a code for a
 * different meaning. No code here may start with another Inventory module's
 * prefix (ITEM_GROUP_, ITEM_PRICE_, ITEM_EAN_ …) — a missing group is
 * ITEM_UNKNOWN_GROUP, not ITEM_GROUP_NOT_FOUND.
 */
export enum ItemErrorCode {
  /** No item (live, where the route needs one) has the id given. */
  NOT_FOUND = 'ITEM_NOT_FOUND',
  /** item_name_en is missing or blank. */
  NAME_REQUIRED = 'ITEM_NAME_REQUIRED',
  /** Another live item of the same company (or a shared one) has this item_name_en, any case (notes 137 B6). */
  NAME_TAKEN = 'ITEM_NAME_TAKEN',
  /** item_photo is not valid base64. */
  PHOTO_INVALID = 'ITEM_PHOTO_INVALID',
  /** item_branch_id is set but item_company_id is not — a branch item must name the branch's company. */
  BRANCH_NEEDS_COMPANY = 'ITEM_BRANCH_NEEDS_COMPANY',
  /** item_branch_id names no branch. */
  UNKNOWN_BRANCH = 'ITEM_UNKNOWN_BRANCH',
  /** item_branch_id names a branch of another company than item_company_id. */
  BRANCH_OTHER_COMPANY = 'ITEM_BRANCH_OTHER_COMPANY',
  /** item_group_id names no item group (foreign key refused the write). */
  UNKNOWN_GROUP = 'ITEM_UNKNOWN_GROUP',
  /** item_default_tax_id names no tax rate in tax_rate_master. */
  UNKNOWN_TAX_RATE = 'ITEM_UNKNOWN_TAX_RATE',
  /** item_base_unit_id names no unit. */
  UNKNOWN_UNIT = 'ITEM_UNKNOWN_UNIT',
  /** item_category_id names no item category. */
  UNKNOWN_CATEGORY = 'ITEM_UNKNOWN_CATEGORY',
  /** item_company_id names no company. */
  UNKNOWN_COMPANY = 'ITEM_UNKNOWN_COMPANY',
  /** item_track_preset_id names no stock track preset. */
  UNKNOWN_TRACK_PRESET = 'ITEM_UNKNOWN_TRACK_PRESET',
  /** Some other id on the item names a row that does not exist (an unmapped foreign key). */
  UNKNOWN_REFERENCE = 'ITEM_UNKNOWN_REFERENCE',
  /** A price, EAN or reorder row names a unit the item has no unit-conversion row for. */
  UNIT_NOT_CONVERTED = 'ITEM_UNIT_NOT_CONVERTED',
  /** Two child rows of one composite save share a natural key (same unit, same EAN, same scope …). */
  DUPLICATE_CHILD_ROWS = 'ITEM_DUPLICATE_CHILD_ROWS',
  /** Delete refused: the item is already deleted. */
  ALREADY_DELETED = 'ITEM_ALREADY_DELETED',
  /** Restore refused: the item is not deleted. */
  NOT_DELETED = 'ITEM_NOT_DELETED',
  /** Delete refused: the item is still in use — stock on hand or in transit, an open order or
   *  quotation, a live promotion or loyalty scheme, or another item's packing list (notes 137 D3). */
  IN_USE = 'ITEM_IN_USE',
  /** Delete/restore refused: someone else deleted or restored the item between the read and the write. */
  CHANGED_CONCURRENTLY = 'ITEM_CHANGED_CONCURRENTLY',
  /** Restore refused: another live item has taken this item's name since it was deleted. */
  RESTORE_NAME_TAKEN = 'ITEM_RESTORE_NAME_TAKEN',
  /** Restore refused: one of the item's EAN codes now belongs to another live item. */
  RESTORE_EAN_TAKEN = 'ITEM_RESTORE_EAN_TAKEN',
  /** Restore refused: some other row of the item now clashes with a live row elsewhere. */
  RESTORE_CLASH = 'ITEM_RESTORE_CLASH',
  /** A composite child row names an id that is not one of THIS item's live rows (notes 137 A1). */
  CHILD_NOT_OF_ITEM = 'ITEM_CHILD_NOT_OF_ITEM',
  /** Another live item of the same company (or a shared one) has this item_code, any case (notes 137 B5). */
  CODE_TAKEN = 'ITEM_CODE_TAKEN',
  /** Another live item of the same company (or a shared one) has this item_sku, any case (notes 137 B5). */
  SKU_TAKEN = 'ITEM_SKU_TAKEN',
  /** item_default_barcode is another live item's EAN code or header barcode (notes 137 B5). */
  BARCODE_TAKEN = 'ITEM_BARCODE_TAKEN',
  /** Some other unique rule refused the write. */
  DUPLICATE = 'ITEM_DUPLICATE',
  /** item_base_unit_id is not the unit of the item's base unit conversion row (notes 137 B7). */
  BASE_UNIT_MISMATCH = 'ITEM_BASE_UNIT_MISMATCH',
  /** 409: the save would change the base unit of an item that already has a base unit row —
   *  item_base_unit_id, another row marked base, the base row's unit, or the base row left out
   *  of unit_conversions (notes 138 A1). */
  BASE_UNIT_LOCKED = 'ITEM_BASE_UNIT_LOCKED',
  /** The item cannot move to this company while another company holds its stock or prices (notes 137 C3). */
  COMPANY_MOVE_BLOCKED = 'ITEM_COMPANY_MOVE_BLOCKED',
  /** item_brand_id names no item brand (the column has no foreign key, notes 137 B9). */
  UNKNOWN_BRAND = 'ITEM_UNKNOWN_BRAND',
  /** item_section_id names no item section. */
  UNKNOWN_SECTION = 'ITEM_UNKNOWN_SECTION',
  /** item_supplier_id names no supplier. */
  UNKNOWN_SUPPLIER = 'ITEM_UNKNOWN_SUPPLIER',
  /** item_cust_group names no customer group. */
  UNKNOWN_CUST_GROUP = 'ITEM_UNKNOWN_CUST_GROUP',
  /** A master newly chosen on the item (group, category, unit, tax, preset, brand …) is deleted or inactive. */
  REFERENCE_RETIRED = 'ITEM_REFERENCE_RETIRED',
  /** The save's stock track policy overlaps another live policy (ex_stp_overlap, notes 137 D4). */
  TRACK_POLICY_CLASH = 'ITEM_TRACK_POLICY_CLASH',
  /** Restore refused: another live item has taken this item's code since it was deleted. */
  RESTORE_CODE_TAKEN = 'ITEM_RESTORE_CODE_TAKEN',
  /** Restore refused: another live item has taken this item's SKU since it was deleted. */
  RESTORE_SKU_TAKEN = 'ITEM_RESTORE_SKU_TAKEN',
}
