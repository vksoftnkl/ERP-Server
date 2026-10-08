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

/** 400 for a shape the DTO could not express (two fields that only make sense together). */
export function throwTillBadRequest(message: string, field: string): never {
  throw new HttpException(
    buildErrorResponse<TillErrorDetail, TillErrorResponse>(message, [{ field, message }]),
    400,
  );
}

/** 404 for a master or a document that is not there (or not in the caller's company). */
export function throwTillNotFound(what: string, field: string, id: string | number): never {
  const message = `${what} ${id} was not found`;
  throw new HttpException(
    buildErrorResponse<TillErrorDetail, TillErrorResponse>(message, [{ field, message }]),
    404,
  );
}
