/**
 * Notes 119 / 127 §5 — every refusal the Batch Prefix master raises carries one
 * of these in `errors[].code`. The Qt client words its box by the code alone,
 * so each string is an API contract: rename one and the box loses its wording.
 */
export const BATCH_PREFIX_ERROR = {
  /** Another batch prefix already uses this prefixUsed (case-insensitive) — 409. */
  DUPLICATE: 'BATCH_PREFIX_DUPLICATE',
  /** prefixUsed is blank once trimmed. */
  PREFIX_EMPTY: 'BATCH_PREFIX_PREFIX_EMPTY',
  /** A date-time field (syncDate) is not a valid ISO-8601 date-time. */
  DATE_INVALID: 'BATCH_PREFIX_DATE_INVALID',
  /** No batch prefix has the requested id — 404. */
  NOT_FOUND: 'BATCH_PREFIX_NOT_FOUND',
} as const;

export type BatchPrefixErrorCode = (typeof BATCH_PREFIX_ERROR)[keyof typeof BATCH_PREFIX_ERROR];
