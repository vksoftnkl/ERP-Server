/**
 * Notes 119 / 127 §5 — every refusal of the item price details lookup (both
 * src/modules/Inventory/item-price-details and the legacy copy in
 * src/modules/item-price-details) carries one of these as `errors[].code`; the
 * client words its message box by the code alone. Never reuse a code for a
 * different meaning.
 */
export enum ItemPriceDetailErrorCode {
  /** No live item has the item_id given. */
  ITEM_NOT_FOUND = 'ITEM_PRICE_DETAIL_ITEM_NOT_FOUND',
  /** No live item has the barcode given as its default barcode. */
  BARCODE_NOT_FOUND = 'ITEM_PRICE_DETAIL_BARCODE_NOT_FOUND',
}
