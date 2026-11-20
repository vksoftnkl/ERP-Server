import { HttpException } from '@nestjs/common';
import { buildErrorResponse } from 'src/common/utils/module-shared.utils';
import { RELAY_CODES, WA_CODES } from './wa.constants';

/**
 * Review N9 — codes of the house catalogue (fixed.error_message) that /whatsapp/*
 * also answers, where no WA_ code fits.
 */
export const WA_HOUSE_CODES = {
  /** activate for a company id that is not there (Company not found). */
  COMPANY_NOT_FOUND: 'LOOKUP_COMPANY_NOT_FOUND',
  /** a retry of a kind this build does not send (as /messages/send refuses another docType). */
  KIND_NOT_SENT: 'VALIDATION_IS_IN',
} as const;

/** One refusal detail: the house shape plus whatever the screen needs to act on it. */
export interface WaErrorDetail {
  field: string;
  code: string;
  message: string;
  [extra: string]: unknown;
}

const C = WA_CODES;

/** §5.6 — the HTTP status of each code when it is a refusal (not a logged SKIPPED / FAILED). */
const STATUS_OF: Record<string, number> = {
  [C.RIGHT_VIEW]: 403,
  [C.RIGHT_EDIT]: 403,
  [C.RIGHT_POST]: 403,
  [C.RIGHT_PRINT]: 403,
  [C.KEY_MISSING]: 503,
  [C.RELAY_NOT_SET]: 503,
  [C.RELAY_UNREACHABLE]: 503,
  [C.RELAY_BUSY]: 503,
  [C.RELAY_ERROR]: 503,
  [C.RELAY_BAD_REQUEST]: 400,
  [C.ACTIVATION_INVALID]: 422,
  [C.SETTING_INVALID]: 400,
  [C.DOC_NOT_FOUND]: 404,
  [C.PARTY_NOT_FOUND]: 404,
  [C.BAD_NUMBER]: 400,
  [C.BATCH_EMPTY]: 400,
  [C.BATCH_TOO_BIG]: 400,
  [C.ALLOW_AGAIN_CONFIRM]: 400,
  [WA_HOUSE_CODES.COMPANY_NOT_FOUND]: 404,
  [WA_HOUSE_CODES.KIND_NOT_SENT]: 400,
};

/** 409 unless listed: the request is fine, the state of things refuses it. */
export function waHttpStatus(code: string): number {
  return STATUS_OF[code] ?? 409;
}

/** Throw a coded WhatsApp refusal; `extra` keys ride on errors[0] (e.g. parties for WA_REMINDER_GAP). */
export function waRefuse(
  code: string,
  message: string,
  field = 'request',
  extra: Record<string, unknown> = {},
): never {
  throw new HttpException(
    buildErrorResponse<WaErrorDetail>(message, [{ field, code, message, ...extra }]),
    waHttpStatus(code),
  );
}

/** Several details under one code family (e.g. one WA_SETTING_INVALID per bad field). */
export function waRefuseMany(message: string, details: WaErrorDetail[]): never {
  throw new HttpException(
    buildErrorResponse<WaErrorDetail>(message, details),
    waHttpStatus(details[0]?.code ?? ''),
  );
}

/**
 * A relay failure, already mapped to the ERP's code (wa-relay-keys §5, P1 "P3 must know").
 * `relayCode` / `metaCode` are kept for wml_error_text / wml_meta_error_code.
 */
export class WaRelayError extends Error {
  constructor(
    readonly waCode: string,
    message: string,
    readonly relay: {
      httpStatus: number | null;
      relayCode: string | null;
      field?: string | null;
      metaCode?: number | null;
      metaTitle?: string | null;
      /** The relay's message id (504 RELAY_SEND_UNCONFIRMED carries it). */
      relayMsgId?: string | null;
    },
  ) {
    super(message);
    this.name = 'WaRelayError';
  }

  /**
   * Review S3 — the relay could not confirm the send in time (504
   * RELAY_SEND_UNCONFIRMED): the message may have gone, so it is NOT a failure.
   */
  get unconfirmed(): boolean {
    return this.relay.relayCode === RELAY_CODES.SEND_UNCONFIRMED;
  }
}
