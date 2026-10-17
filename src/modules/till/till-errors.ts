/**
 * till-errors.ts — how a till refusal leaves the server. Every TILL_* refusal is thrown here as an
 * HttpException carrying the house error body; TillExceptionFilter passes it through unchanged.
 *
 *   throwTill()           — the general refusal: the status TILL_ERROR_STATUS gives the code
 *                           (403 / 409 / 422 / 428 …) plus any extra detail the client reads
 *   throwTillBadRequest() — always 400: a body shape the DTO cannot express (notes 119)
 *   throwTillNotFound()   — always 404: a master or a document that is not there (notes 119)
 *   tillErrorCodeOf()     — the code back out of a caught error, for a caller that reacts to one
 *                           (a bill void, a payment letting 428 TILL_APPROVAL_REQUIRED through)
 */
import { HttpException } from '@nestjs/common';
import { buildErrorResponse } from '../../common/utils/module-shared.utils';
import { TILL_ERROR_STATUS, TillErrorCode } from './types/till-enum';
import type { TillErrorDetail, TillErrorResponse } from './types/till-api.types';

/**
 * Every till refusal goes out through here: the house error body
 * (`{ success:false, message, errors:[{ field, message, code }] }`) at the
 * status §7.3 gives the code. TillExceptionFilter passes the body through as it
 * is, so a 428 TILL_APPROVAL_REQUIRED reaches the client with the event, the
 * amount and the level it needs — what the client's TillGate (§12) reads.
 */
export function throwTill(
  code: TillErrorCode,
  message: string,
  field: string,
  extra: Omit<TillErrorDetail, 'field' | 'message' | 'code'> = {},
): never {
  const detail: TillErrorDetail = { field, message, code, ...extra };
  throw new HttpException(
    buildErrorResponse<TillErrorDetail, TillErrorResponse>(message, [detail]),
    TILL_ERROR_STATUS[code],
  );
}

/** The TillErrorCode a thrown till refusal carries, or null for any other error. */
export function tillErrorCodeOf(error: unknown): TillErrorCode | null {
  if (!(error instanceof HttpException)) {
    return null;
  }
  const body = error.getResponse() as { errors?: { code?: string }[] } | string;
  const code = typeof body === 'object' ? body.errors?.[0]?.code : undefined;
  return code && (Object.values(TillErrorCode) as string[]).includes(code)
    ? (code as TillErrorCode)
    : null;
}

/**
 * 400 for a shape the DTO could not express (two fields that only make sense together).
 * Notes 119: coded like every other till refusal — always 400, whatever the code.
 */
export function throwTillBadRequest(code: TillErrorCode, message: string, field: string): never {
  throw new HttpException(
    buildErrorResponse<TillErrorDetail, TillErrorResponse>(message, [{ field, message, code }]),
    400,
  );
}

/**
 * 404 for a master or a document that is not there (or not in the caller's company).
 * Notes 119: `code` names WHAT was not found (TILL_SESSION_NOT_FOUND …) — always 404.
 */
export function throwTillNotFound(
  code: TillErrorCode,
  what: string,
  field: string,
  id: string | number,
): never {
  const message = `${what} ${id} was not found`;
  throw new HttpException(
    buildErrorResponse<TillErrorDetail, TillErrorResponse>(message, [{ field, message, code }]),
    404,
  );
}
