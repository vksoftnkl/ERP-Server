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
  /** The number built from the prefix, counter and suffix is longer than the ref no column (100). */
  REFNO_TOO_LONG = 'SEQUENCE_REFNO_TOO_LONG',
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
