/**
 * Sticker Printing (menu 32, plan S-P1 §7.4) — every refusal's code.
 *
 * The Qt client words its box by `errors[].code` alone, from the catalogue
 * rows in prisma/seed/Error_Messages.json (2026-11-25.1). Never reuse a code
 * for another meaning; add a member.
 *
 * STICKER_BARCODE_TOO_LONG and STICKER_BATCH_TOO_LONG came later (catalogue
 * 2026-11-25.2, migration 20261126100100_sticker_sp1_wording): the job line's
 * columns are varchar(50) / varchar(60) while the source columns allow more,
 * and a line is refused rather than an insert truncating what was printed.
 */
export const STICKER_ERROR = {
  RIGHT_VIEW: 'STICKER_RIGHT_VIEW',
  RIGHT_PRINT: 'STICKER_RIGHT_PRINT',
  BRANCH_NOT_IN_COMPANY: 'STICKER_BRANCH_NOT_IN_COMPANY',
  PURPOSE_INVALID: 'STICKER_PURPOSE_INVALID',
  NO_DESIGN: 'STICKER_NO_DESIGN',
  NO_PRINTER: 'STICKER_NO_PRINTER',
  DESIGN_NOT_FOUND: 'STICKER_DESIGN_NOT_FOUND',
  DESIGN_NOT_PUBLISHED: 'STICKER_DESIGN_NOT_PUBLISHED',
  /** Plain: no label sheet. Variant rule=PURPOSE: a label design of another purpose. */
  DESIGN_NOT_LABEL: 'STICKER_DESIGN_NOT_LABEL',
  ITEM_NOT_FOUND: 'STICKER_ITEM_NOT_FOUND',
  UNIT_NOT_OF_ITEM: 'STICKER_UNIT_NOT_OF_ITEM',
  LOT_NOT_OF_ITEM: 'STICKER_LOT_NOT_OF_ITEM',
  CODE_NOT_FOUND: 'STICKER_CODE_NOT_FOUND',
  LOT_REQUIRED: 'STICKER_LOT_REQUIRED',
  LINE_NO_BARCODE: 'STICKER_LINE_NO_BARCODE',
  LABELS_INVALID: 'STICKER_LABELS_INVALID',
  TOO_MANY_LABELS: 'STICKER_TOO_MANY_LABELS',
  TOO_MANY_ITEMS: 'STICKER_TOO_MANY_ITEMS',
  NOTHING_TO_PRINT: 'STICKER_NOTHING_TO_PRINT',
  JOB_NOT_FOUND: 'STICKER_JOB_NOT_FOUND',
  JOB_STATUS_SET: 'STICKER_JOB_STATUS_SET',
  JOB_OTHER_COUNTER: 'STICKER_JOB_OTHER_COUNTER',
  REASON_REQUIRED: 'STICKER_REASON_REQUIRED',
  NOTE_REQUIRED: 'STICKER_NOTE_REQUIRED',
  REASON_INVALID: 'STICKER_REASON_INVALID',
  REPRINT_NOT_PRINTED: 'STICKER_REPRINT_NOT_PRINTED',
  LINE_NOT_ON_JOB: 'STICKER_LINE_NOT_ON_JOB',
  RESEND_NOT_FAILED: 'STICKER_RESEND_NOT_FAILED',
  /**
   * 409. Plain: a resend of the failed job already PRINTED. Variant rule=SENT
   * (review SF1, catalogue 2026-11-26.1): a resend of it is still SENT, not
   * marked Printed or Failed yet.
   */
  ALREADY_RESENT: 'STICKER_ALREADY_RESENT',
  /** The barcode is longer than the job line keeps (50); worded in catalogue 2026-11-25.2. */
  BARCODE_TOO_LONG: 'STICKER_BARCODE_TOO_LONG',
  /** The batch is longer than the job line keeps (60); worded in catalogue 2026-11-25.2. */
  BATCH_TOO_LONG: 'STICKER_BATCH_TOO_LONG',

  // ── S-P2: stickers of a document (plan S-P2 §6.6 / §7, catalogue 2026-11-27.1) ──
  // The wording rows read `{doc}`, `{status}`, `{item}`, `{printed}`, `{needed}`,
  // `{left}` from the error's `params` (the refusals fill them). ALREADY_LISTED,
  // ASK and PRINTED are worded for Qt's own popups / sentences and filled there.
  /** docType is not PURCHASE_BILL or SHORTAGE_RECEIPT (422). */
  DOC_TYPE_INVALID: 'STICKER_DOC_TYPE_INVALID',
  /** No such live document in this company (404). */
  DOC_NOT_FOUND: 'STICKER_DOC_NOT_FOUND',
  /** The document is another branch's (422, Q17). */
  DOC_OTHER_BRANCH: 'STICKER_DOC_OTHER_BRANCH',
  /** The document is not POSTED (draft, cancelled) (422). */
  DOC_NOT_POSTED: 'STICKER_DOC_NOT_POSTED',
  /** stickerOnly and no line of the document is ticked Sticker (422, C9). */
  DOC_NOTHING_TICKED: 'STICKER_DOC_NOTHING_TICKED',
  /** Qt's popup only: the document is already in the Print list. */
  DOC_ALREADY_LISTED: 'STICKER_DOC_ALREADY_LISTED',
  /** More labels than are left (422). Plain: nothing left; variant rule=LEFT: some left. */
  DOC_OVER_LEFT: 'STICKER_DOC_OVER_LEFT',
  /**
   * A job line that is not on the document (422): plain = not a line of it /
   * not its item / not its lot / a source job line with no srcLineId / a
   * manual job line with one (C6); variant rule=UNIT = not the Def unit (C2).
   */
  DOC_LINE_NOT_ON_DOC: 'STICKER_DOC_LINE_NOT_ON_DOC',
  /** Qt's question after Post (variant rule=CARRIED). */
  DOC_ASK: 'STICKER_DOC_ASK',
  /** Qt's sentence in the cancel reason box (variant rule=GRN_BILL). */
  DOC_PRINTED: 'STICKER_DOC_PRINTED',
} as const;

export type StickerErrorCode = (typeof STICKER_ERROR)[keyof typeof STICKER_ERROR];

/** Test print's gate: Print on Print Assignments (menu 248, PQ4). */
export const PRINT_ASSIGN_RIGHT_PREFIX = 'PRINT_ASSIGN';

/** The shared device helper's codes (stock-voucher-numbering.helper), worded. */
export const STOCK_DEVICE_NOT_FOUND = 'STOCK_DEVICE_NOT_FOUND';
