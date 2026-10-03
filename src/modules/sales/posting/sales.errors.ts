import {
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesForbidden,
  throwUnprocessable,
  type SalesErrorDetail,
} from 'src/common/utils/module-service.utils';
import type { SalesErrorCodeLike, SalesRefusal, SalesStatutoryRef } from './types/posting.types';

/**
 * One throw site per HTTP status, so every sales refusal reaches the client in
 * the same shape.
 *
 * The house error detail is `{field, message}`. HANDOVER §9 adds `code`, which
 * is the ONLY thing the Qt client switches on — the message is for the
 * operator, the code is for the screen. So the detail is widened here rather
 * than a second error envelope being invented: the existing exception filters
 * already serialise `ModuleErrorDetail[]` and pass unknown keys through.
 */
export interface SalesCodedErrorDetail extends SalesErrorDetail {
  code: SalesErrorCodeLike;
  line?: number;
  statutory?: SalesStatutoryRef;
}

/** 409 — the row exists and the request is well formed; its STATE refuses. */
export function throwSalesLocked(
  message: string,
  code: SalesErrorCodeLike,
  field: string,
  detail?: Partial<SalesCodedErrorDetail>,
): never {
  throwSalesConflict<SalesCodedErrorDetail>(message, [{ field, message, code, ...detail }]);
}

/**
 * 422 — the request is understood and REFUSED on a rule. This is the status
 * the guard layer raises for everything in §9's REFUSE list, because 400 is
 * reserved for a request that did not parse.
 */
export function throwSalesRefused(
  message: string,
  code: SalesErrorCodeLike,
  field: string,
  detail?: Partial<SalesCodedErrorDetail>,
): never {
  throwUnprocessable<SalesCodedErrorDetail>(message, [{ field, message, code, ...detail }]);
}

/** 422 carrying every refusal a `/validate` run collected, not just the first. */
export function throwSalesRefusals(message: string, refusals: SalesRefusal[]): never {
  throwUnprocessable<SalesCodedErrorDetail>(
    message,
    refusals.map((r) => ({
      field: r.field ?? 'document',
      message: r.message,
      code: r.code,
      ...(r.line === undefined ? {} : { line: r.line }),
      ...(r.statutory === undefined ? {} : { statutory: r.statutory }),
    })),
  );
}

/** 403 — a `user_menus` flag is false. Retrying will not help. */
export function throwSalesRight(
  message: string,
  code: SalesErrorCodeLike,
  field = 'userId',
): never {
  throwSalesForbidden<SalesCodedErrorDetail>(message, [{ field, message, code }]);
}

/** 400 — the request itself is wrong (a bad acc year, a missing key). */
export function throwSalesInvalid(message: string, code: SalesErrorCodeLike, field: string): never {
  throwSalesBadRequest<SalesCodedErrorDetail>(message, [{ field, message, code }]);
}
