import type { ModuleErrorDetail } from 'src/common/utils/module-shared.utils';

/**
 * Notes 119 / 127 §5 — every refusal of the size master carries one of these as
 * `errors[].code`; the client words its message box by the code alone.
 */
export enum ItemSizeErrorCode {
  NOT_FOUND = 'ITEM_SIZE_NOT_FOUND',
  /** Another live size of this company (or a shared one) has the name, ignoring case. */
  NAME_TAKEN = 'ITEM_SIZE_NAME_TAKEN',
  /** Delete refused: a batch detail still names the size — deactivate it instead. */
  IN_USE = 'ITEM_SIZE_IN_USE',
  ALREADY_DELETED = 'ITEM_SIZE_ALREADY_DELETED',
  NOT_DELETED = 'ITEM_SIZE_NOT_DELETED',
  /** isz_company_id names no live company. */
  COMPANY_NOT_FOUND = 'ITEM_SIZE_COMPANY_NOT_FOUND',
}

/** The colour master's codes, one for one with the size master's. */
export enum ItemColourErrorCode {
  NOT_FOUND = 'ITEM_COLOUR_NOT_FOUND',
  NAME_TAKEN = 'ITEM_COLOUR_NAME_TAKEN',
  IN_USE = 'ITEM_COLOUR_IN_USE',
  ALREADY_DELETED = 'ITEM_COLOUR_ALREADY_DELETED',
  NOT_DELETED = 'ITEM_COLOUR_NOT_DELETED',
  COMPANY_NOT_FOUND = 'ITEM_COLOUR_COMPANY_NOT_FOUND',
}

export interface ItemAttributeErrorCodes {
  NOT_FOUND: string;
  NAME_TAKEN: string;
  IN_USE: string;
  ALREADY_DELETED: string;
  NOT_DELETED: string;
  COMPANY_NOT_FOUND: string;
}

/**
 * A refusal; the 409 on a taken name also carries `existingId`, the live row
 * that has it, so a quick-add simply uses that row.
 */
export interface ItemAttributeErrorDetail extends ModuleErrorDetail {
  existingId?: string;
}

/** What tells the two masters apart; the service is the same. */
export interface ItemAttributeMasterConfig {
  table: 'item_size_master' | 'item_colour_master';
  prefix: 'isz' | 'icl';
  /** "size" / "colour", for messages. */
  label: string;
  auditScreenName: string;
  restoreRoute: string;
  /** The stock_batch_detail column that uses a row — the delete refusal. */
  batchDetailColumn: 'sbd_size_id' | 'sbd_colour_id';
  /** Sizes only: ALPHA / WAIST / KIDS / free text. */
  hasSizeSet: boolean;
  codes: ItemAttributeErrorCodes;
}

/** One row, in column names (`isz_*` / `icl_*`), as /create and /get return it. */
export type ItemAttributePayload = Record<string, string | number | boolean | null>;
