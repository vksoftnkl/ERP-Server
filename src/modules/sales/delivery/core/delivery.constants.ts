/**
 * Delivery tracking, phase 1 (plan `sales/plan-delivery-tracking-p1-2026-11-15.md`
 * + addendum 1): the shared vocabulary.
 *
 * The codes are an API contract (the Qt client words its boxes by `code`
 * alone); every one has a wording row in fixed.error_message (seeded by
 * migration 20261117100000_delivery_tracking / Error_Messages.json).
 */

/** fixed.menu_master ids (plan §8, Q1). */
export const DELIVERY_MENU_ID = {
  PENDING_DELIVERIES: 304,
  DELIVERY_NOTE: 305,
  GODOWN_POSITION: 306,
  /** The bill's delivery-mode change is judged on Sales Bill EDIT (decision 44). */
  SALE_BILL: 12,
} as const;

/** sale_bill.sb_delivery_mode (ck_sb_delivery_mode) and acc_voucher_types.vchr_delivery_mode. */
export const DELIVERY_MODES = ['INSTANT', 'PICKUP', 'DISPATCH'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

/** The modes whose eligible lines wait in the godown. */
export const WAITING_MODES: readonly DeliveryMode[] = ['PICKUP', 'DISPATCH'];

/** sale_bill.sb_delivery_status (ck_sb_delivery_status). OUT is phase 2 (POD). */
export const DELIVERY_STATUSES = ['NA', 'PENDING', 'PART', 'OUT', 'DELIVERED', 'RETURNED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** sales.sale_delivery_event.sde_kind (ck_sde_kind). */
export const DELIVERY_EVENT_KINDS = [
  'GIVEN',
  'CANCEL',
  'GOODS_BACK',
  'RETURN',
  'RETURN_CANCEL',
  'CLEANUP',
] as const;
export type DeliveryEventKind = (typeof DELIVERY_EVENT_KINDS)[number];

/** sale_delivery_note.sdn_mode (ck_sdn_mode). */
export const DELIVERY_NOTE_MODES = ['SELF', 'VEHICLE', 'TRANSPORTER'] as const;
export type DeliveryNoteMode = (typeof DELIVERY_NOTE_MODES)[number];

/** sale_delivery_note.sdn_status (ck_sdn_status). */
export const DN_STATUS = { DRAFT: 'DRAFT', POSTED: 'POSTED', CANCELLED: 'CANCELLED' } as const;

/** The ledger / status / transport doc type of the note. */
export const DELIVERY_NOTE_DOC_TYPE = 'DELIVERY_NOTE';

/** The audit screen (audit.audit_screen 164) and its table. */
export const DELIVERY_NOTE_SCREEN = 'Delivery Note';

/** The note number's prefix: DN/2026-2027/D3/00042 (Q19, per device). */
export const DELIVERY_NOTE_NUMBER_PREFIX = 'DN';

/** The system stock reason a godown correction posts under (stock_reason_master, company NULL). */
export const DELIVERY_GODOWN_REASON_CODE = 'DELIVERY_GODOWN';

/** Company settings (decision 52) and the device godown (decision 53). */
export const DELIVERY_SETTING_KEYS = {
  DEVICE_GODOWN: 'sales.delivery_godown',
  AMBER_DAYS: 'sales.delivery_amber_days',
  OLD_DAYS: 'sales.delivery_old_days',
} as const;
export const DEFAULT_AMBER_DAYS = 7;
export const DEFAULT_OLD_DAYS = 30;

/**
 * Every code the delivery routes raise (plan §7.10 + addendum §4.3). Kept as
 * one object so a rename is a compile error everywhere.
 */
export const DELIVERY_ERROR_CODES = {
  // Rights (menu 305 / 304 / 306)
  DN_RIGHT_VIEW: 'DN_RIGHT_VIEW',
  DN_RIGHT_CREATE: 'DN_RIGHT_CREATE',
  DN_RIGHT_EDIT: 'DN_RIGHT_EDIT',
  DN_RIGHT_DELETE: 'DN_RIGHT_DELETE',
  DN_RIGHT_POST: 'DN_RIGHT_POST',
  DN_RIGHT_CANCEL: 'DN_RIGHT_CANCEL',
  DN_RIGHT_PRINT: 'DN_RIGHT_PRINT',
  DN_RIGHT_EXPORT: 'DN_RIGHT_EXPORT',
  DELIVERY_RIGHT_VIEW: 'DELIVERY_RIGHT_VIEW',
  DELIVERY_RIGHT_MODE: 'DELIVERY_RIGHT_MODE',
  GODOWN_POSITION_RIGHT_VIEW: 'GODOWN_POSITION_RIGHT_VIEW',
  GODOWN_POSITION_RIGHT_PRINT: 'GODOWN_POSITION_RIGHT_PRINT',
  GODOWN_POSITION_RIGHT_EXPORT: 'GODOWN_POSITION_RIGHT_EXPORT',

  // The note
  DN_NOT_FOUND: 'DN_NOT_FOUND',
  DN_NOT_DRAFT: 'DN_NOT_DRAFT',
  DN_ALREADY_CANCELLED: 'DN_ALREADY_CANCELLED',
  DN_REVISION_STALE: 'DN_REVISION_STALE',
  DN_GODOWN_REQUIRED: 'DN_GODOWN_REQUIRED',
  DN_GODOWN_NOT_IN_BRANCH: 'DN_GODOWN_NOT_IN_BRANCH',
  DN_GODOWN_LOCKED: 'DN_GODOWN_LOCKED',
  DN_VEHICLE_REQUIRED: 'DN_VEHICLE_REQUIRED',
  DN_TRANSPORTER_REQUIRED: 'DN_TRANSPORTER_REQUIRED',
  DN_COLLECTED_BY_REQUIRED: 'DN_COLLECTED_BY_REQUIRED',
  DN_NO_LINES: 'DN_NO_LINES',
  DN_QTY_NEGATIVE: 'DN_QTY_NEGATIVE',
  DN_QTY_OVER_PENDING: 'DN_QTY_OVER_PENDING',
  DN_BILL_NOT_POSTED: 'DN_BILL_NOT_POSTED',
  DN_BILL_INSTANT: 'DN_BILL_INSTANT',
  DN_BILL_OTHER_BRANCH: 'DN_BILL_OTHER_BRANCH',
  DN_LINE_NOT_GOODS: 'DN_LINE_NOT_GOODS',
  DN_GODOWN_RIGHT: 'DN_GODOWN_RIGHT',
  DN_OTHER_GODOWN: 'DN_OTHER_GODOWN',
  DN_LOT_SWAP: 'DN_LOT_SWAP',
  DN_LOT_INVALID: 'DN_LOT_INVALID',
  DN_SHELF_SHORT: 'DN_SHELF_SHORT',
  DN_OVER_SHELF: 'DN_OVER_SHELF',
  DN_VEHICLE_OVERLOAD: 'DN_VEHICLE_OVERLOAD',
  DN_WARN_NOT_CONFIRMED: 'DN_WARN_NOT_CONFIRMED',
  DN_GODOWN_FROZEN: 'DN_GODOWN_FROZEN',
  DN_STOCK_NEGATIVE: 'DN_STOCK_NEGATIVE',
  DN_CANCEL_REASON_REQUIRED: 'DN_CANCEL_REASON_REQUIRED',
  DN_GOODS_BACK_OVER: 'DN_GOODS_BACK_OVER',
  DN_GOODS_BACK_REASON_REQUIRED: 'DN_GOODS_BACK_REASON_REQUIRED',
  DN_GOODS_BACK_NOT_POSTED: 'DN_GOODS_BACK_NOT_POSTED',
  DN_SCAN_UNKNOWN: 'DN_SCAN_UNKNOWN',
  DN_SCAN_NO_OPEN_HERE: 'DN_SCAN_NO_OPEN_HERE',
  // P6 review round (2026-11-16)
  /** S3 / R-1: a cancel or goods back would leave a line given below what sale returns took back. 409. */
  DN_UNDO_BELOW_RETURNED: 'DN_UNDO_BELOW_RETURNED',
  /** N3: the note's year is not the year of today (the post date). 409. */
  DN_DRAFT_YEAR_CHANGED: 'DN_DRAFT_YEAR_CHANGED',
  /** S2: one line id sent twice in a body, or a line id of another note. 422. */
  DN_LINE_DUPLICATE: 'DN_LINE_DUPLICATE',

  // Pending Deliveries / the bill
  DELIVERY_NOTHING_OPEN: 'DELIVERY_NOTHING_OPEN',
  DELIVERY_CHALLAN_ROW: 'DELIVERY_CHALLAN_ROW',
  DELIVERY_MODE_GIVEN: 'DELIVERY_MODE_GIVEN',
  DELIVERY_MODE_INSTANT: 'DELIVERY_MODE_INSTANT',
  DELIVERY_MODE_INVALID: 'DELIVERY_MODE_INVALID',
  DELIVERY_MODE_REASON_REQUIRED: 'DELIVERY_MODE_REASON_REQUIRED',

  // Sale return of goods never taken (addendum §5.2)
  DELIVERY_RETURN_OVER: 'DELIVERY_RETURN_OVER',
  DELIVERY_RETURN_NOT_GIVEN: 'DELIVERY_RETURN_NOT_GIVEN',
  DELIVERY_RETURN_GODOWN: 'DELIVERY_RETURN_GODOWN',
  DELIVERY_RETURN_OVER_QTY: 'DELIVERY_RETURN_OVER_QTY',
  DELIVERY_RETURN_CLAIM: 'DELIVERY_RETURN_CLAIM',

  // The bill (§8.4)
  BILL_OLD_PENDING_DELIVERY: 'BILL_OLD_PENDING_DELIVERY',
  BILL_DELIVERED_CANCEL: 'BILL_DELIVERED_CANCEL',
  BILL_DELIVERED_AMEND: 'BILL_DELIVERED_AMEND',
  BILL_DELIVERY_MODE_LOCKED: 'BILL_DELIVERY_MODE_LOCKED',
  BILL_DELIVERY_MODE_POS: 'BILL_DELIVERY_MODE_POS',
  SALES_DELIVERY_RETIRED: 'SALES_DELIVERY_RETIRED',

  // Godown Stock Position (menu 306)
  GODOWN_POSITION_GODOWN_NOT_IN_BRANCH: 'GODOWN_POSITION_GODOWN_NOT_IN_BRANCH',

  // Physical stock (addendum §5.3)
  PHY_UNDELIVERED_CHANGED: 'PHY_UNDELIVERED_CHANGED',
  PHY_SHELF_AND_COUNTED: 'PHY_SHELF_AND_COUNTED',

  // Voucher types (§8.4 item 11)
  VT_DELIVERY_MODE_REQUIRED: 'VT_DELIVERY_MODE_REQUIRED',
  VT_DELIVERY_MODE_NOT_ALLOWED: 'VT_DELIVERY_MODE_NOT_ALLOWED',
} as const;

export type DeliveryErrorCode = (typeof DELIVERY_ERROR_CODES)[keyof typeof DELIVERY_ERROR_CODES];

/** A bill line's key. */
export interface BillLineKey {
  billItemId: string;
  billAccYear: string;
}

/** A bill's key. */
export interface BillKey {
  billId: string;
  billAccYear: string;
}
