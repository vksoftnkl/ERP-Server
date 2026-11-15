/**
 * Notes 119 / 127 §5 — every refusal of the voucher sequence routes (/sequences)
 * and of the number allocator every document save goes through
 * (voucher-sequence.helper) carries one of these as `errors[].code`; the client
 * words its box by the code alone. Never reuse a code for a different meaning.
 *
 * A malformed field answers with the house ValidationPipe's own code
 * (VALIDATION_ + the constraint), so it reads the same however it is caught.
 */
export enum SequenceErrorCode {
  /** No live sequence has the id given — 404. */
  NOT_FOUND = 'SEQUENCE_NOT_FOUND',
  /** vchrTypeId names no voucher type. */
  VOUCHER_TYPE_NOT_FOUND = 'SEQUENCE_VOUCHER_TYPE_NOT_FOUND',
  /** companyId names no active company. */
  COMPANY_NOT_FOUND = 'SEQUENCE_COMPANY_NOT_FOUND',
  /** branchId names no active branch of that company. */
  BRANCH_NOT_FOUND = 'SEQUENCE_BRANCH_NOT_FOUND',
  /** A sequence with this voucher type, company, branch, year, device and period already exists — 409. */
  SCOPE_DUPLICATE = 'SEQUENCE_SCOPE_DUPLICATE',
  /** A document's number comes from a sequence an administrator deactivated (or deleted) for that year. */
  INACTIVE = 'SEQUENCE_INACTIVE',
  /**
   * The number built from the prefix, counter and suffix is longer than the ref no column (100).
   * Also (400) when a `{FY}` / `{YY}` / `{BR}` format, expanded as its counter opens, would build a
   * number over 50 (avh_voucher_refno / abl_voucher_refno) or overflow the counter's prefix (60) or
   * suffix (20) column, or a typed number is over 50.
   * And (422, the detail carries `rule: 'GST16'`, wording variant rule=GST16) when a GST outward
   * type's first number at a new counter is over 16 characters (Voucher Types plan decision 35).
   */
  REFNO_TOO_LONG = 'SEQUENCE_REFNO_TOO_LONG',
  /**
   * 422 — the voucher type is numbered MANUAL and the document sent no typed number
   * (Voucher Types plan §7.3). No document sends one yet (decision 42).
   */
  NUMBER_REQUIRED = 'SEQUENCE_NUMBER_REQUIRED',
  /**
   * 422 — a CHILD GST outward voucher type with no `{BR}` in its number opens its first counter at
   * a branch whose GSTIN another active branch of the company shares (Voucher Types plan decision
   * 40). The Voucher Types master's own code, raised here because the counter is where it bites.
   */
  BR_REQUIRED = 'VT_BR_REQUIRED',
  /**
   * 422 — the format holds `{BR}` and the branch has neither a Bill Prefix nor a code
   * (branch serial plan §9.3).
   */
  BRANCH_CODE_MISSING = 'SEQUENCE_BRANCH_CODE_MISSING',
  /** 422 — the format holds `{BR}` and the branch's code is not `^[A-Z0-9-]{1,10}$` (§5.5). */
  BRANCH_CODE_INVALID = 'SEQUENCE_BRANCH_CODE_INVALID',
  /**
   * 422 — the voucher type's prefix or suffix holds a `{…}` other than `{FY}` / `{YY}` / `{BR}`, or
   * a stray brace. Refused rather than printed raw. `params.token` names it (no braces). Also when
   * the format holds `{YY}` and the accounting year is not shaped NNNN-NNNN (`params.token` 'YY').
   */
  FORMAT_TOKEN_UNKNOWN = 'SEQUENCE_FORMAT_TOKEN_UNKNOWN',
  /** A field that must be a UUID is not one. */
  FIELD_NOT_UUID = 'VALIDATION_IS_UUID',
  /** A text field came as something other than a string. */
  FIELD_NOT_STRING = 'VALIDATION_IS_STRING',
  /** A required text field is blank. */
  FIELD_EMPTY = 'VALIDATION_IS_NOT_EMPTY',
  /** A text field is longer than its column. */
  FIELD_TOO_LONG = 'VALIDATION_MAX_LENGTH',
  /** A number is below its minimum. */
  FIELD_BELOW_MIN = 'VALIDATION_MIN',
  /** A number is above its maximum. */
  FIELD_ABOVE_MAX = 'VALIDATION_MAX',
  /** A field that must be a whole number (non-negative for a counter) is not one. */
  FIELD_NOT_INTEGER = 'VALIDATION_IS_INT',
  /** A flag is not true / false. */
  FIELD_NOT_BOOLEAN = 'VALIDATION_IS_BOOLEAN',
}
