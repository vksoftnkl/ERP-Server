import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { EMPTY_CLIENT_INFO, parseClientInfo, type ClientInfo } from './client-info';

/**
 * Part B Step 2 — the client-info middleware, registered in main.ts BEFORE the
 * body parser and the routes, so it sees every request, including one whose
 * body fails to parse.
 *
 * 1. Attaches the six X-App-* / X-Device-* headers as `request.clientInfo`
 *    (client-info.ts). A missing or bad header becomes null. It never refuses
 *    anything.
 * 2. Logs every error response, except 401 and 404, with the client's platform +
 *    build and the signed-in company + user. The log is written when the
 *    response finishes rather than in an exception filter: about ninety
 *    controller-scoped module filters answer before AllExceptionsFilter could,
 *    so the response is the one place every refusal passes through. 401 is
 *    skipped because the clients' refresh loop makes it routine. 404 is skipped
 *    because probes and typos make it noise.
 *
 * One line per refusal, e.g.
 *   409 POST /api/v1/app-version/releases code=APP_RELEASE_BUILD_EXISTS
 *       platform=desktop build=10 version=1.2.0 device=pc-1 company=<uuid> user=tester1
 */
const SKIPPED_STATUSES: ReadonlySet<number> = new Set([401, 404]);
const MAX_LOGGED_CODES = 5;

export interface ErrorLogSink {
  warn(message: string): void;
  error(message: string): void;
}

type RequestWithIdentity = Request & {
  clientInfo?: ClientInfo;
  /** Set by AccessTokenGuard from the verified token; absent on public routes. */
  user?: { sub?: unknown; user_name?: unknown; company_id?: unknown };
};

export function createClientInfoMiddleware(sink: ErrorLogSink = new Logger('HttpError')) {
  return function clientInfoMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    const req = request as RequestWithIdentity;
    try {
      req.clientInfo = parseClientInfo(request.headers);
    } catch {
      req.clientInfo = { ...EMPTY_CLIENT_INFO };
    }
    try {
      watchForErrorResponse(req, response, sink);
    } catch {
      // Logging is best effort: it must never stand between a client and its answer.
    }
    next();
  };
}

function watchForErrorResponse(
  request: RequestWithIdentity,
  response: Response,
  sink: ErrorLogSink,
): void {
  let codes: string[] = [];
  // Catch the codes on their way out. Every filter answers with res.json(body),
  // and the body's errors[].code is what support needs next to the status.
  const originalJson = response.json;
  response.json = function jsonWithCodeCapture(this: Response, body?: unknown) {
    if (response.statusCode >= 400) {
      codes = errorCodesOf(body);
    }
    return originalJson.call(this, body);
  } as Response['json'];
  response.once('finish', () => {
    const status = response.statusCode;
    if (status < 400 || SKIPPED_STATUSES.has(status)) {
      return;
    }
    try {
      const line = describeErrorResponse(request, status, codes);
      if (status >= 500) {
        sink.error(line);
      } else {
        sink.warn(line);
      }
    } catch {
      // see above
    }
  });
}

export function describeErrorResponse(
  request: RequestWithIdentity,
  status: number,
  codes: readonly string[],
): string {
  const client = request.clientInfo ?? parseClientInfo(request.headers);
  const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
  const user = request.user;
  const userName = textOf(user?.user_name) ?? textOf(user?.sub);
  return [
    `${status} ${request.method} ${path}`,
    `code=${codes.length > 0 ? codes.join(',') : '-'}`,
    `platform=${token(client.platform)}`,
    `build=${token(client.build)}`,
    `version=${token(client.version)}`,
    `device=${token(client.deviceId)}`,
    `company=${token(textOf(user?.company_id))}`,
    `user=${token(userName)}`,
  ].join(' ');
}

/** errors[].code of a house error body ({ success: false, message, errors: [...] }). */
export function errorCodesOf(body: unknown): string[] {
  if (!body || typeof body !== 'object') {
    return [];
  }
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  const codes: string[] = [];
  for (const entry of errors) {
    const code =
      entry && typeof entry === 'object' ? (entry as { code?: unknown }).code : undefined;
    if (typeof code === 'string' && code.length > 0 && !codes.includes(code)) {
      codes.push(code);
    }
    if (codes.length >= MAX_LOGGED_CODES) {
      break;
    }
  }
  return codes;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** A log value: '-' for none, quoted when it holds a space so key=value stays parseable. */
function token(value: string | number | null): string {
  if (value === null || value === '') {
    return '-';
  }
  const text = String(value);
  return /\s/.test(text) ? JSON.stringify(text) : text;
}
