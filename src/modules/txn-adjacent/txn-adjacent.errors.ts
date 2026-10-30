/**
 * Notes 142 — the refusals of `GET /txn/adjacent`. The Qt client words its
 * box by `code` alone (notes 119), so each string is an API contract.
 *
 *   400  the request names a type or status the docType does not have
 *   403  TXN_RIGHT_VIEW — no `um_can_view` on the docType's menu (assertMenuRight)
 *   404  the document on screen is not there under its four keys
 */
export const TXN_ADJ = {
  RIGHT_VIEW: 'TXN_RIGHT_VIEW',
  DOC_NOT_FOUND: 'TXN_DOC_NOT_FOUND',
  TYPE_NOT_IN_DOC: 'TXN_TYPE_NOT_IN_DOC',
  STATUS_NOT_IN_DOC: 'TXN_STATUS_NOT_IN_DOC',
} as const;

/** `assertMenuRight` builds `<prefix>_RIGHT_VIEW` = TXN_ADJ.RIGHT_VIEW. */
export const TXN_RIGHT_PREFIX = 'TXN';
