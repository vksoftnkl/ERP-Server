/**
 * Voucher Types master, menu 303 (Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md
 * §6.6 / §7.2) — every refusal of /voucher-types/* and of the Sales Bill's type pick
 * carries one of these as `errors[].code`; the client words its box from
 * fixed.error_message by the code alone. The right codes (VT_RIGHT_VIEW / _CREATE /
 * _EDIT / _DELETE) are built by assertMenuRight from the prefix VT.
 *
 * Also used here, from the allocator's own family: SEQUENCE_FORMAT_TOKEN_UNKNOWN (a
 * token the number format does not know) and SEQUENCE_REFNO_TOO_LONG (a number that
 * overflows its columns).
 */
export enum VoucherTypeErrorCode {
  NAME_REQUIRED = 'VT_NAME_REQUIRED',
  /** Another child of this company, or a base type, has the name (any case). */
  NAME_TAKEN = 'VT_NAME_TAKEN',
  ABBR_REQUIRED = 'VT_ABBR_REQUIRED',
  /**
   * Review N1 (2026-11-15): the server-made system code (Bil-<ABBR>) hit
   * uq_acc_voucher_types_code because another company saved the same one at the
   * same moment. Saving again picks the next free code. No wording row yet.
   */
  CODE_TAKEN = 'VT_CODE_TAKEN',
  /** Not 1–6 letters or digits. */
  ABBR_INVALID = 'VT_ABBR_INVALID',
  /** Another type this company uses (its children, the bases) has the abbreviation (any case). */
  ABBR_TAKEN = 'VT_ABBR_TAKEN',
  NOT_FOUND = 'VT_NOT_FOUND',
  /** The parent is not Sales Bill (Q1), or is itself a child, or a new type names no parent. */
  PARENT_NOT_ALLOWED = 'VT_PARENT_NOT_ALLOWED',
  /** The type has bills, so its parent cannot change. */
  PARENT_LOCKED = 'VT_PARENT_LOCKED',
  /**
   * A base type's name / code / abbreviation / parent / Active / Tally name differ from
   * the stored row (Q17, OP-2); a "numbered by its screen" row's numbering differs
   * (Q26); a base named in /inactivate or /delete.
   */
  BASE_FIELD_LOCKED = 'VT_BASE_FIELD_LOCKED',
  /** companyId is not the login company, or the child belongs to another company. */
  COMPANY_MISMATCH = 'VT_COMPANY_MISMATCH',
  /**
   * Method other than Automatic. GST outward types are Automatic only (Q18), and no
   * screen takes a typed number yet, so today every type is (decision 42). For a
   * non-GST type the detail carries `rule: 'NO_NUMBER_BOX'` for a wording variant.
   */
  METHOD_GST_AUTO_ONLY = 'VT_METHOD_GST_AUTO_ONLY',
  /** A GST outward type's first number passes 16 characters at a branch (params sample, len). */
  NO_TOO_LONG = 'VT_NO_TOO_LONG',
  /** A GST outward type's number holds a character other than A–Z a–z 0–9 / -. */
  NO_BAD_CHAR = 'VT_NO_BAD_CHAR',
  /** A GST outward type has no {BR} while two or more active branches share a GSTIN (Q13). */
  BR_REQUIRED = 'VT_BR_REQUIRED',
  /** Another counter-numbered series of this company prints the same prefix + suffix (params other, prefix). */
  PREFIX_TAKEN = 'VT_PREFIX_TAKEN',
  /** Width not 1–9. */
  WIDTH_INVALID = 'VT_WIDTH_INVALID',
  /** Starting number not 1 – 999,999,999. */
  START_NO_INVALID = 'VT_START_NO_INVALID',
  /**
   * The print design is not a live, active design of this type's document kind, of
   * this company or shared; a base names a company's own design; the clone source
   * is not there.
   */
  PURPOSE_INVALID = 'VT_PURPOSE_INVALID',
  /**
   * /print-design-clone: a live print design of ANY company, or a shared one, has
   * the code (review S1, decision 61: Alt+C codes are unique across companies).
   * Worded in Error_Messages.json 2026-11-15.1 ("A print design with the code
   * {code} already exists.").
   */
  PURPOSE_CODE_TAKEN = 'VT_PURPOSE_CODE_TAKEN',
  /** Delete: a bill, counter or voucher uses the type (params name). */
  IN_USE = 'VT_IN_USE',
  /** A write on an offline site (CLOUD_SYNC_ENABLED): types are made on the main server (Q16). */
  OFFLINE = 'VT_OFFLINE',
  // ── the Sales Bill's pick (plan §7.4) ─────────────────────────────────────
  /** A bill with no type and nothing to default to. */
  BILL_TYPE_REQUIRED = 'VT_BILL_TYPE_REQUIRED',
  /** Not 3 or an active child of 3 of the bill's company; 3 when it is not offered. */
  BILL_TYPE_INVALID = 'VT_BILL_TYPE_INVALID',
  /** A saved bill keeps its type (Q5). */
  BILL_TYPE_LOCKED = 'VT_BILL_TYPE_LOCKED',
  // ── delivery tracking (plan 2026-11-15 §8.4 item 11) ──────────────────────
  /** A Sales Bill type (the base or a child) was sent no delivery mode (null / ''). */
  DELIVERY_MODE_REQUIRED = 'VT_DELIVERY_MODE_REQUIRED',
  /** A type other than Sales Bill and its children was sent a delivery mode. */
  DELIVERY_MODE_NOT_ALLOWED = 'VT_DELIVERY_MODE_NOT_ALLOWED',
}

/** Warnings of /voucher-types/validate and /save — never a refusal. */
export enum VoucherTypeWarningCode {
  /** C5: the prefix / suffix / width / starting no changed and a counter of this year exists. */
  FORMAT_NEXT_COUNTER = 'VT_FORMAT_NEXT_COUNTER',
  /** A non-GST type's first number passes 16 characters. */
  NO_OVER_16 = 'VT_NO_OVER_16',
}

/** assertMenuRight's code prefix: VT_RIGHT_<RIGHT>. */
export const VOUCHER_TYPE_RIGHT_PREFIX = 'VT';
