/**
 * Notes 119 / 127 §5 — every refusal the Ledger Shipping Address routes raise.
 * The Qt client words its box by `errors[].code` alone, so each string is an
 * API contract: rename one and the box loses its wording.
 */
export const LedgerShippingAddressErrorCode = {
  /** The saaId names no live shipping address (404). */
  NOT_FOUND: 'SHIPPING_NOT_FOUND',
  /** GET with neither saaId nor ledgerId. */
  ID_REQUIRED: 'SHIPPING_ID_REQUIRED',
  /** The save trips a unique index on acc_ship_addrs (409). */
  DUPLICATE: 'SHIPPING_DUPLICATE',
  /** The ledger named on the address is not a live ledger. */
  LEDGER_NOT_FOUND: 'SHIPPING_LEDGER_NOT_FOUND',
  /** The company named on the address is not a live company. */
  COMPANY_NOT_FOUND: 'SHIPPING_COMPANY_NOT_FOUND',
  /** The branch named on the address is not a live branch. */
  BRANCH_NOT_FOUND: 'SHIPPING_BRANCH_NOT_FOUND',
  /** saaAddrType is not SHIP_TO / BILL_TO / BOTH. */
  ADDR_TYPE_INVALID: 'SHIPPING_ADDR_TYPE_INVALID',
  /** saaStateCode is not a 2-digit GST state code. */
  STATE_CODE_INVALID: 'SHIPPING_STATE_CODE_INVALID',
  /** saaPin is not a 6-digit PIN (checked for India only). */
  PIN_INVALID: 'SHIPPING_PIN_INVALID',
  /** saaGstin is blank — the column is NOT NULL. */
  GSTIN_REQUIRED: 'SHIPPING_GSTIN_REQUIRED',
  /** saaGstin is not a valid 15-character GSTIN. */
  GSTIN_INVALID: 'SHIPPING_GSTIN_INVALID',
} as const;

export type LedgerShippingAddressErrorCode =
  (typeof LedgerShippingAddressErrorCode)[keyof typeof LedgerShippingAddressErrorCode];
