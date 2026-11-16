import { NotFoundException } from '@nestjs/common';
import { buildErrorResponse } from 'src/common/utils/module-service.utils';
import { wordingFor, type UserWording } from 'src/common/error-wording/error-wording';
import {
  throwSalesLocked,
  throwSalesRefused,
  throwSalesRight,
  type SalesCodedErrorDetail,
} from '../posting/sales.errors';
import type { SalesMessageParams } from '../posting/types/posting.types';
import { DELIVERY_ERROR_CODES as C } from './core/delivery.constants';

/**
 * One finding of the Delivery Note rules (plan §8.1 "Validate / post rules").
 *
 * `/validate` returns them all, split into errors / warnings / infos, each
 * worded from fixed.error_message; `/save` and `/post` throw the first error
 * in rule order with its own HTTP status, and refuse WARNs the caller did not
 * tick (DN_WARN_NOT_CONFIRMED).
 */
export type NoteSeverity = 'REFUSE' | 'WARN' | 'INFO';

export interface DeliveryNote {
  code: string;
  severity: NoteSeverity;
  /** 'sdnGodownId', 'lines[4].qty' … */
  field: string;
  /** The note line no (1-based) the finding is about, when it is about one. */
  lineNo?: number | null;
  params: SalesMessageParams;
  /** The developer sentence (the client words its box from `code` + `user`). */
  message: string;
}

/** A finding as /validate returns it: the note plus the catalogue words. */
export interface WordedNote extends DeliveryNote {
  user?: UserWording;
}

const FORBIDDEN = new Set<string>([
  C.DN_RIGHT_VIEW,
  C.DN_RIGHT_CREATE,
  C.DN_RIGHT_EDIT,
  C.DN_RIGHT_DELETE,
  C.DN_RIGHT_POST,
  C.DN_RIGHT_CANCEL,
  C.DN_RIGHT_PRINT,
  C.DN_RIGHT_EXPORT,
  C.DN_GODOWN_RIGHT,
  C.DELIVERY_RIGHT_VIEW,
  C.DELIVERY_RIGHT_MODE,
]);

const CONFLICT = new Set<string>([
  C.DN_NOT_DRAFT,
  C.DN_ALREADY_CANCELLED,
  C.DN_REVISION_STALE,
  C.DN_GODOWN_LOCKED,
  C.DN_QTY_OVER_PENDING,
  C.DN_BILL_NOT_POSTED,
  C.DN_BILL_INSTANT,
  C.DN_BILL_OTHER_BRANCH,
  C.DN_LINE_NOT_GOODS,
  C.DN_WARN_NOT_CONFIRMED,
  C.DN_GODOWN_FROZEN,
  C.DN_STOCK_NEGATIVE,
  C.DN_GOODS_BACK_OVER,
  C.DN_GOODS_BACK_NOT_POSTED,
  C.DN_SCAN_NO_OPEN_HERE,
  C.DN_UNDO_BELOW_RETURNED,
  C.DN_DRAFT_YEAR_CHANGED,
  C.DELIVERY_NOTHING_OPEN,
  C.DELIVERY_MODE_GIVEN,
  C.DELIVERY_MODE_INSTANT,
]);

const NOT_FOUND = new Set<string>([C.DN_NOT_FOUND, C.DN_SCAN_UNKNOWN]);

/** The HTTP status a code is refused with (plan §7.10). */
export function httpStatusOf(code: string): 403 | 404 | 409 | 422 {
  if (FORBIDDEN.has(code)) {
    return 403;
  }
  if (NOT_FOUND.has(code)) {
    return 404;
  }
  if (CONFLICT.has(code)) {
    return 409;
  }
  return 422;
}

/**
 * Throw one finding with its own status, code, field, line and params.
 * `event` (optional) names the step the refusal is about, e.g. 'GOODS_BACK': a
 * top-level key the catalogue picks an `event=<value>` wording variant by
 * (as TILL_APPROVAL_REQUIRED's `event`), so one code reads right on each step.
 */
export function raiseNote(
  note: Pick<DeliveryNote, 'code' | 'field' | 'message' | 'params' | 'lineNo'> & { event?: string },
): never {
  const detail: Partial<SalesCodedErrorDetail> & { event?: string } = {
    ...(note.lineNo ? { line: note.lineNo } : {}),
    ...(note.event ? { event: note.event } : {}),
    params: note.params,
  };
  switch (httpStatusOf(note.code)) {
    case 403:
      throwSalesRight(note.message, note.code, note.field);
      break;
    case 404:
      throw new NotFoundException(
        buildErrorResponse('Not found', [
          { field: note.field, message: note.message, code: note.code, params: note.params } as never,
        ]),
      );
    case 409:
      throwSalesLocked(note.message, note.code, note.field, detail);
      break;
    default:
      throwSalesRefused(note.message, note.code, note.field, detail);
  }
  throw new Error('unreachable');
}

/** Shorthand: throw a coded refusal. */
export function refuseWith(
  code: string,
  message: string,
  field: string,
  params: SalesMessageParams = {},
  lineNo?: number | null,
  event?: string,
): never {
  return raiseNote({ code, message, field, params, lineNo, event });
}

/** Word a finding from the catalogue (title / line / todo with its params filled). */
export function worded(note: DeliveryNote): WordedNote {
  const user = wordingFor({ ...note, line: note.lineNo ?? undefined } as unknown as Record<string, unknown>);
  return user ? { ...note, user } : { ...note };
}

/** A finding builder. */
export function note(
  code: string,
  severity: NoteSeverity,
  field: string,
  message: string,
  params: SalesMessageParams = {},
  lineNo?: number | null,
): DeliveryNote {
  return { code, severity, field, message, params, lineNo: lineNo ?? null };
}
