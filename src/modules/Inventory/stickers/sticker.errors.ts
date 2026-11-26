import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { buildErrorResponse, type ModuleErrorDetail } from 'src/common/utils/module-shared.utils';
import { STICKER_ERROR, STOCK_DEVICE_NOT_FOUND } from './types/sticker-error-codes';

/**
 * One coded refusal of the sticker routes (plan §7.4).
 *
 * `rule` picks a wording variant (STICKER_DESIGN_NOT_LABEL rule=PURPOSE);
 * `line` is the 1-based line of the request the refusal is about.
 */
export interface StickerErrorDetail extends ModuleErrorDetail {
  rule?: string;
  line?: number;
  /** The wording row's `{name}` values (S-P2: doc, status, item, printed, needed, left). */
  params?: Record<string, string | number>;
  /** Figures for the client (S-P2 STICKER_DOC_OVER_LEFT: itemId, lotId, needed, printed, carried, left). */
  meta?: Record<string, unknown>;
}

/** What a refusal may carry besides its code, words and field. */
export interface StickerRefusalExtra {
  rule?: string;
  line?: number;
  params?: Record<string, string | number>;
  meta?: Record<string, unknown>;
}

const FORBIDDEN = new Set<string>([
  STICKER_ERROR.RIGHT_VIEW,
  STICKER_ERROR.RIGHT_PRINT,
  STICKER_ERROR.JOB_OTHER_COUNTER,
]);

const NOT_FOUND = new Set<string>([
  STOCK_DEVICE_NOT_FOUND,
  STICKER_ERROR.DESIGN_NOT_FOUND,
  STICKER_ERROR.ITEM_NOT_FOUND,
  STICKER_ERROR.JOB_NOT_FOUND,
  STICKER_ERROR.DOC_NOT_FOUND,
]);

const CONFLICT = new Set<string>([STICKER_ERROR.JOB_STATUS_SET, STICKER_ERROR.ALREADY_RESENT]);

/** The HTTP status each code is refused with (plan §7.4); everything else is a 422. */
export function stickerStatusOf(code: string): 403 | 404 | 409 | 422 {
  if (FORBIDDEN.has(code)) return 403;
  if (NOT_FOUND.has(code)) return 404;
  if (CONFLICT.has(code)) return 409;
  return 422;
}

/** A refusal waiting to be thrown — a line's `problem` is the same thing, kept. */
export class StickerRefusal {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly field: string,
    readonly extra: StickerRefusalExtra = {},
  ) {}

  /** As the line object's `problem` key. */
  toProblem(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}

/** Throw one coded refusal with its own status. */
export function refuseSticker(
  code: string,
  message: string,
  field: string,
  extra: StickerRefusalExtra = {},
): never {
  const detail: StickerErrorDetail = {
    field,
    code,
    message,
    ...(extra.rule ? { rule: extra.rule } : {}),
    ...(extra.line ? { line: extra.line } : {}),
    ...(extra.params ? { params: extra.params } : {}),
    ...(extra.meta ? { meta: extra.meta } : {}),
  };
  const body = buildErrorResponse<StickerErrorDetail>(message, [detail]);
  switch (stickerStatusOf(code)) {
    case 403:
      throw new ForbiddenException(body);
    case 404:
      throw new NotFoundException(body);
    case 409:
      throw new ConflictException(body);
    default:
      throw new UnprocessableEntityException(body);
  }
}

/** Throw a kept refusal (a line problem turned into a refusal). */
export function throwRefusal(refusal: StickerRefusal, extra: StickerRefusalExtra = {}): never {
  return refuseSticker(refusal.code, refusal.message, refusal.field, {
    ...refusal.extra,
    ...extra,
  });
}
