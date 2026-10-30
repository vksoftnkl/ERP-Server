/**
 * Notes 144 — the refusals of /item-price-log/*. The Qt client words its box by
 * `code` alone (notes 119), so each string is an API contract.
 */
export const IPCL = {
  /** No `um_can_view` on menu 290, Price Change Log (assertMenuRight builds it). */
  RIGHT_VIEW: 'IPCL_RIGHT_VIEW',
  /** No log row with that id. */
  NOT_FOUND: 'IPCL_NOT_FOUND',
  /** toDate before fromDate, or a range longer than the report reads. */
  BAD_RANGE: 'IPCL_BAD_RANGE',
} as const;

/** `assertMenuRight` builds `<prefix>_RIGHT_VIEW` = IPCL.RIGHT_VIEW. */
export const IPCL_RIGHT_PREFIX = 'IPCL';
