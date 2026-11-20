import { Injectable } from '@nestjs/common';
import { WaRelayError } from './wa-errors';
import {
  RELAY_CODES,
  WA_CODES,
  WA_HEALTH_TIMEOUT_MS,
  WA_RELAY_SEND_TIMEOUT_MS,
  WA_RELAY_TIMEOUT_MS,
  waMetaCode,
} from './wa.constants';

/** GET /v1/connection `data` (wa-relay-keys §1). */
export interface RelayConnection {
  shopCode: string;
  installId: string | null;
  state: string;
  displayName: string | null;
  displayPhone: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  qualityRating: string | null;
  messagingLimit: number | null;
  coexistence?: boolean | null;
  connectedOn: string | null;
  serverTime: string | null;
  templates: RelayTemplate[];
}

export interface RelayTemplate {
  name: string;
  lang: string;
  purpose: string;
  category: string | null;
  status: string;
  reason: string | null;
  body: string | null;
  params: string[];
  headerKind: string;
  buttons: unknown[];
  statusOn: string | null;
}

export interface RelayEvent {
  id: number;
  kind: 'STATUS' | 'TAP' | 'STOP' | 'TEMPLATE' | 'ACCOUNT' | string;
  clientRef: string | null;
  wamid: string | null;
  status: string | null;
  at: string | null;
  metaErrorCode: number | null;
  metaErrorTitle: string | null;
  reply: string | null;
  fromPhone: string | null;
  detail: Record<string, unknown> | null;
}

export interface RelaySendMeta {
  clientRef: string;
  to: string;
  templateName: string;
  lang: string;
  params: Record<string, string>;
  documentFilename?: string;
}

export interface RelaySendResult {
  relayMsgId: string;
  wamid: string | null;
  acceptedAt: string;
  duplicate: boolean;
}

type FetchFn = typeof fetch;

/**
 * The relay's `/v1` API over native fetch + FormData (no queue: plan decision 7 /
 * Q12). Every failure comes out as a WaRelayError carrying the ERP code
 * (wa-relay-keys §5 + P1 notes):
 *
 *   network / timeout / RELAY_META_UNREACHABLE      → WA_RELAY_UNREACHABLE
 *   RELAY_RATE_LIMITED                               → WA_RELAY_BUSY
 *   RELAY_INTERNAL / _DB_DOWN / _NOT_FOUND / garbage → WA_RELAY_ERROR
 *   RELAY_KEY_INVALID / _REVOKED                     → WA_KEY_REVOKED
 *   RELAY_SHOP_SUSPENDED                             → WA_SHOP_SUSPENDED
 *   RELAY_NOT_CONNECTED                              → WA_NOT_CONNECTED
 *   RELAY_ALREADY_CONNECTED                          → WA_ALREADY_CONNECTED
 *   RELAY_CODE_INVALID                               → WA_ACTIVATION_INVALID
 *   RELAY_TEMPLATE_NOT_APPROVED                      → WA_TEMPLATE_NOT_APPROVED
 *   RELAY_PDF_TOO_BIG / _PAYLOAD_TOO_BIG             → WA_PDF_TOO_BIG
 *   RELAY_META_ERROR                                 → WA_META_<code> | WA_META_OTHER
 *   RELAY_BAD_REQUEST on `to`                        → WA_BAD_NUMBER
 *   RELAY_BAD_REQUEST otherwise                      → WA_RELAY_BAD_REQUEST
 *   RELAY_SEND_UNCONFIRMED (504, POST /v1/messages)  → `unconfirmed`: NOT a failure,
 *       the send keeps its row SENDING for the event poll (review S3)
 *
 * Timeouts: 30 s for the JSON calls, 60 s for POST /v1/messages (the relay may
 * take ~50 s to upload the PDF and send).
 */
@Injectable()
export class WaRelayClient {
  /** Replaced in unit tests. */
  fetchFn: FetchFn = (...args) => fetch(...args);

  /** WA_RELAY_URL with no trailing slash, or null when unset. */
  configuredUrl(): string | null {
    const raw = process.env.WA_RELAY_URL?.trim();
    return raw ? raw.replace(/\/+$/, '') : null;
  }

  async activate(
    baseUrl: string,
    body: { activationCode: string; installLabel: string | null; erpVersion: string | null },
  ): Promise<{ shopCode: string; installId: string; apiKey: string; keyPrefix: string }> {
    return this.json(baseUrl, 'POST', '/v1/activate', null, body);
  }

  async connection(baseUrl: string, key: string): Promise<RelayConnection> {
    return this.json(baseUrl, 'GET', '/v1/connection', key);
  }

  async connectCode(
    baseUrl: string,
    key: string,
    body: { requestedBy: string; shopInfo: Record<string, string | null> },
  ): Promise<{ code: string; url: string; expiresAt: string }> {
    return this.json(baseUrl, 'POST', '/v1/connect-codes', key, body);
  }

  async events(
    baseUrl: string,
    key: string,
    after: bigint | number,
    limit = 200,
  ): Promise<{ events: RelayEvent[]; more: boolean }> {
    return this.json(baseUrl, 'GET', `/v1/events?after=${after.toString()}&limit=${limit}`, key);
  }

  async ack(baseUrl: string, key: string, upTo: number): Promise<{ acked: number }> {
    return this.json(baseUrl, 'POST', '/v1/events/ack', key, { upTo });
  }

  async rotate(baseUrl: string, key: string): Promise<{ apiKey: string; keyPrefix: string; oldKeyValidUntil: string }> {
    return this.json(baseUrl, 'POST', '/v1/keys/rotate', key);
  }

  async disconnect(baseUrl: string, key: string, body: { requestedBy: string; reason: string | null }): Promise<{ state: string }> {
    return this.json(baseUrl, 'POST', '/v1/disconnect', key, body);
  }

  /** POST /v1/messages (multipart): part `meta` = JSON, part `document` = the PDF when the template has one. */
  async send(
    baseUrl: string,
    key: string,
    meta: RelaySendMeta,
    pdf: { bytes: Buffer; filename: string } | null,
  ): Promise<RelaySendResult> {
    const form = new FormData();
    form.append('meta', JSON.stringify(meta));
    if (pdf) {
      form.append(
        'document',
        new Blob([new Uint8Array(pdf.bytes)], { type: 'application/pdf' }),
        pdf.filename,
      );
    }
    return this.request(baseUrl, 'POST', '/v1/messages', key, form, WA_RELAY_SEND_TIMEOUT_MS);
  }

  /** GET /health within 3 s: true only for `{success:true, data:{ok:true}}`. */
  async healthy(baseUrl: string): Promise<boolean> {
    try {
      const data = await this.request<{ ok?: boolean }>(baseUrl, 'GET', '/health', null, undefined, WA_HEALTH_TIMEOUT_MS);
      return data?.ok === true;
    } catch {
      return false;
    }
  }

  private json<T>(baseUrl: string, method: 'GET' | 'POST', path: string, key: string | null, body?: unknown): Promise<T> {
    return this.request<T>(
      baseUrl,
      method,
      path,
      key,
      body === undefined ? undefined : JSON.stringify(body),
      WA_RELAY_TIMEOUT_MS,
    );
  }

  private async request<T>(
    baseUrl: string,
    method: 'GET' | 'POST',
    path: string,
    key: string | null,
    body: string | FormData | undefined,
    timeoutMs: number,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (key) {
      headers.Authorization = `Bearer ${key}`;
    }
    if (typeof body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
    const version = (process.env.APP_VERSION ?? '').trim();
    if (version) {
      headers['X-ERP-Version'] = version.slice(0, 40);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        body: method === 'POST' ? (body ?? '{}') : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const why = controller.signal.aborted ? `no answer in ${timeoutMs / 1000} s` : errorText(error);
      throw new WaRelayError(WA_CODES.RELAY_UNREACHABLE, `The WhatsApp service could not be reached: ${why}`, {
        httpStatus: null,
        relayCode: null,
      });
    } finally {
      clearTimeout(timer);
    }
    let parsed: unknown = null;
    const text = await res.text().catch(() => '');
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const env = (parsed ?? {}) as { success?: boolean; data?: unknown };
    if (res.ok && env.success === true) {
      return env.data as T;
    }
    throw mapRelayFailure(res.status, parsed, text);
  }
}

function errorText(error: unknown): string {
  const e = error as { message?: string; cause?: { code?: string; message?: string } };
  return (e?.cause?.code ?? e?.cause?.message ?? e?.message ?? 'network error').toString().slice(0, 120);
}

/** A relay refusal body → the ERP's WaRelayError. Exported for the unit tests. */
export function mapRelayFailure(httpStatus: number, body: unknown, rawText = ''): WaRelayError {
  const b = (body ?? {}) as {
    success?: boolean;
    code?: string;
    message?: string;
    errors?: {
      field?: string;
      code?: string;
      message?: string;
      metaCode?: number;
      metaTitle?: string | null;
      relayMsgId?: string | null;
    }[];
  };
  const first = Array.isArray(b.errors) ? b.errors[0] : undefined;
  const relayCode = b.code ?? first?.code ?? null;
  const field = first?.field ?? null;
  const message = (b.message ?? first?.message ?? rawText ?? '').toString().slice(0, 300);
  const relay = {
    httpStatus,
    relayCode,
    field,
    metaCode: typeof first?.metaCode === 'number' ? first.metaCode : null,
    metaTitle: first?.metaTitle ?? null,
    relayMsgId: typeof first?.relayMsgId === 'string' ? first.relayMsgId : null,
  };
  const err = (code: string, text: string) => new WaRelayError(code, text, relay);
  if (b.success !== false || !relayCode) {
    return err(WA_CODES.RELAY_ERROR, `The WhatsApp service gave an answer this server cannot read (HTTP ${httpStatus})`);
  }
  switch (relayCode) {
    case RELAY_CODES.KEY_INVALID:
    case RELAY_CODES.KEY_REVOKED:
      return err(WA_CODES.KEY_REVOKED, message || 'VK has turned off WhatsApp for this server');
    case RELAY_CODES.SHOP_SUSPENDED:
      return err(WA_CODES.SHOP_SUSPENDED, message || 'VK has paused WhatsApp for this company');
    case RELAY_CODES.NOT_CONNECTED:
      return err(WA_CODES.NOT_CONNECTED, message || 'The WhatsApp number is not connected');
    case RELAY_CODES.ALREADY_CONNECTED:
      return err(WA_CODES.ALREADY_CONNECTED, message || 'The WhatsApp number is already connected');
    case RELAY_CODES.CODE_INVALID:
      return err(WA_CODES.ACTIVATION_INVALID, message || 'The activation code is wrong, used or expired');
    case RELAY_CODES.TEMPLATE_NOT_APPROVED:
      return err(WA_CODES.TEMPLATE_NOT_APPROVED, message || 'Meta has not approved this template');
    case RELAY_CODES.PDF_TOO_BIG:
    case RELAY_CODES.PAYLOAD_TOO_BIG:
      return err(WA_CODES.PDF_TOO_BIG, message || 'The PDF is larger than WhatsApp allows');
    case RELAY_CODES.META_ERROR:
      return err(waMetaCode(relay.metaCode), message || `Meta refused the message (${relay.metaCode ?? '?'})`);
    case RELAY_CODES.META_UNREACHABLE:
      return err(WA_CODES.RELAY_UNREACHABLE, message || 'Meta did not answer');
    case RELAY_CODES.RATE_LIMITED:
      return err(WA_CODES.RELAY_BUSY, message || 'Too many requests to the WhatsApp service');
    case RELAY_CODES.BAD_REQUEST:
      return field === 'to'
        ? err(WA_CODES.BAD_NUMBER, message || 'Not a mobile number')
        : err(WA_CODES.RELAY_BAD_REQUEST, message || 'The WhatsApp service refused the message details');
    case RELAY_CODES.SEND_UNCONFIRMED:
      // `unconfirmed` is true: WaSendService keeps the row SENDING and never shows this code.
      return err(WA_CODES.RELAY_ERROR, message || 'The WhatsApp service has not confirmed the send yet');
    default:
      return err(WA_CODES.RELAY_ERROR, message || `The WhatsApp service failed (${relayCode})`);
  }
}
