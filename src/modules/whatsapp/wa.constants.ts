/**
 * WhatsApp option B (plan Shared/Prathap/whatsapp/whatsapp-plan-v1-2026-11-17.md §5):
 * the ERP side. Every send goes through VK's wa-relay; this server never holds a
 * Meta token, only the relay's install key (encrypted, WA_CRED_KEY).
 */

/** §2 F23 — the three menus (seeded hidden by 20261119100000_whatsapp). */
export const WA_MENU = {
  /** Settings › Configuration › WhatsApp: {VIEW, EDIT}. */
  WHATSAPP: 307,
  /** Reports › WhatsApp Log: {VIEW, EXPORT, POST}. (308 Payment Reminders comes with the reminders.) */
  LOG: 309,
  SALE_BILL: 12,
  SALES_ORDER: 11,
  RECEIPT: 99,
} as const;

/** §5.6 — every refusal / skip / failure code (fixed.error_message, 62 rows). */
export const WA_CODES = {
  RIGHT_VIEW: 'WA_RIGHT_VIEW',
  RIGHT_EDIT: 'WA_RIGHT_EDIT',
  RIGHT_POST: 'WA_RIGHT_POST',
  RIGHT_PRINT: 'WA_RIGHT_PRINT',
  KEY_MISSING: 'WA_KEY_MISSING',
  RELAY_NOT_SET: 'WA_RELAY_NOT_SET',
  RELAY_UNREACHABLE: 'WA_RELAY_UNREACHABLE',
  RELAY_BUSY: 'WA_RELAY_BUSY',
  RELAY_ERROR: 'WA_RELAY_ERROR',
  RELAY_BAD_REQUEST: 'WA_RELAY_BAD_REQUEST',
  ACTIVATION_INVALID: 'WA_ACTIVATION_INVALID',
  ALREADY_ACTIVATED: 'WA_ALREADY_ACTIVATED',
  NOT_ACTIVATED: 'WA_NOT_ACTIVATED',
  KEY_REVOKED: 'WA_KEY_REVOKED',
  SHOP_SUSPENDED: 'WA_SHOP_SUSPENDED',
  NOT_CONNECTED: 'WA_NOT_CONNECTED',
  ALREADY_CONNECTED: 'WA_ALREADY_CONNECTED',
  CONNECT_NOT_FINISHED: 'WA_CONNECT_NOT_FINISHED',
  SITE_OFFLINE: 'WA_SITE_OFFLINE',
  SETTING_INVALID: 'WA_SETTING_INVALID',
  DOC_NOT_FOUND: 'WA_DOC_NOT_FOUND',
  DOC_NOT_POSTED: 'WA_DOC_NOT_POSTED',
  DOC_CANCELLED: 'WA_DOC_CANCELLED',
  PARTY_NOT_FOUND: 'WA_PARTY_NOT_FOUND',
  NO_NUMBER: 'WA_NO_NUMBER',
  BAD_NUMBER: 'WA_BAD_NUMBER',
  OPTED_OUT: 'WA_OPTED_OUT',
  REMINDERS_STOPPED: 'WA_REMINDERS_STOPPED',
  REMINDER_GAP: 'WA_REMINDER_GAP',
  REMINDER_HOURS: 'WA_REMINDER_HOURS',
  NOTHING_DUE: 'WA_NOTHING_DUE',
  TEMPLATE_NOT_APPROVED: 'WA_TEMPLATE_NOT_APPROVED',
  PDF_NO_DESIGN: 'WA_PDF_NO_DESIGN',
  PDF_FAILED: 'WA_PDF_FAILED',
  PDF_TOO_BIG: 'WA_PDF_TOO_BIG',
  BATCH_EMPTY: 'WA_BATCH_EMPTY',
  BATCH_TOO_BIG: 'WA_BATCH_TOO_BIG',
  DAILY_LIMIT: 'WA_DAILY_LIMIT',
  RETRY_NOT_ALLOWED: 'WA_RETRY_NOT_ALLOWED',
  ALREADY_DELIVERED: 'WA_ALREADY_DELIVERED',
  SEND_INTERRUPTED: 'WA_SEND_INTERRUPTED',
  ALLOW_AGAIN_CONFIRM: 'WA_ALLOW_AGAIN_CONFIRM',
  META_OTHER: 'WA_META_OTHER',
} as const;

export type WaCode = (typeof WA_CODES)[keyof typeof WA_CODES] | `WA_META_${number}`;

/** The Meta error codes with their own wording row (§5.6); any other is WA_META_OTHER. */
export const WA_META_CODES_WORDED: readonly number[] = [
  131026, 131042, 130429, 131056, 132001, 132015, 131031, 131053, 132000, 190,
];

export function waMetaCode(metaCode: number | null | undefined): string {
  return typeof metaCode === 'number' && WA_META_CODES_WORDED.includes(metaCode)
    ? `WA_META_${metaCode}`
    : WA_CODES.META_OTHER;
}

/** ck_wac_state. */
export type WacState = 'ACTIVATED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'SUSPENDED';
/** /connection/get adds the no-row state. */
export type WaConnectionState = WacState | 'NOT_ACTIVATED';

/** ck_wml_kind / ck_wml_trigger / ck_wml_status. */
export type WaKind = 'BILL' | 'ORDER' | 'RECEIPT' | 'REMINDER' | 'TEST';
export type WaTrigger = 'ON_POST' | 'MANUAL' | 'BULK' | 'RETRY' | 'TEST';
export type WaStatus = 'SKIPPED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type WaDocType = 'SALE_BILL' | 'SALES_ORDER' | 'RECEIPT';
export type WaPhoneSource = 'WHATSAPP' | 'PHONE1' | 'PHONE2' | 'TYPED';

/**
 * Review S5 — the one key of `wml_params` that is not a template parameter (the
 * relay never sees it): true when the number was typed in the send popup, so a
 * retry passes it again as the popup number (before the master numbers). A
 * TYPED row without it took the number typed on the document.
 */
export const WA_POPUP_PHONE_MARK = '$typedInPopup';

export const WA_KIND_OF_DOC: Record<WaDocType, WaKind> = {
  SALE_BILL: 'BILL',
  SALES_ORDER: 'ORDER',
  RECEIPT: 'RECEIPT',
};

export const WA_MENU_OF_DOC: Record<WaDocType, number> = {
  SALE_BILL: WA_MENU.SALE_BILL,
  SALES_ORDER: WA_MENU.SALES_ORDER,
  RECEIPT: WA_MENU.RECEIPT,
};

/** VK's fixed templates (relay catalogue, Q17) and the test one. */
export const WA_TEMPLATE_OF_KIND: Record<WaKind, string> = {
  BILL: 'nex_bill_v1',
  ORDER: 'nex_order_confirm_v1',
  RECEIPT: 'nex_receipt_v1',
  REMINDER: 'nex_payment_reminder_v1',
  TEST: 'hello_world',
};
/** hello_world is Meta's own sample: en_US, no document. */
export const WA_TEST_LANG = 'en_US';
export const WA_LANGS = ['en', 'ta'] as const;
export type WaLang = (typeof WA_LANGS)[number];

/** Phase-1 on-post voucher types (decision 18): 3 Sales Bill (+ its children), 4 SO, 12 Receipt. */
export const WA_VT = { BILL: 3, ORDER: 4, RECEIPT: 12 } as const;

/** The voucher types this build can send on post (scope cut 17/11: Sales Order only). */
export const WA_ON_POST_SERVED: readonly number[] = [WA_VT.ORDER];

/** §3.4 app_setting_def keys (module WHATSAPP, max scope COMPANY). */
export const WA_SETTING = {
  GAP_DAYS: 'whatsapp.reminder_gap_days',
  FROM: 'whatsapp.reminder_from',
  TO: 'whatsapp.reminder_to',
  DEFAULT_LANGUAGE: 'whatsapp.default_language',
  RATE: 'whatsapp.rate_per_message',
  GST: 'whatsapp.rate_gst_percent',
  FALLBACK: 'whatsapp.fallback_click_to_chat',
  RETENTION_YEARS: 'whatsapp.log_retention_years',
  BULK_MAX: 'whatsapp.bulk_max_parties',
  /**
   * Review S7 — "WhatsApp on Post", per company: a JSON array of voucher type ids,
   * e.g. [4] (JSON, max scope COMPANY, default []; migration
   * 20261119190000_whatsapp_on_post_company). A missing def or value reads as [].
   */
  ON_POST_TYPES: 'whatsapp.on_post_types',
} as const;

/** Relay limits (wa-relay-keys §1). */
export const WA_PDF_MAX_BYTES = 10 * 1024 * 1024;
/** Every JSON call to the relay (activate, connection, events, ack, rotate, disconnect). */
export const WA_RELAY_TIMEOUT_MS = 30_000;
/**
 * Review S3 — POST /v1/messages: the relay may take about 50 s (PDF upload + send,
 * 25 s each at Meta), so the ERP waits longer than that. A relay that cannot
 * confirm in its own time answers 504 RELAY_SEND_UNCONFIRMED instead.
 */
export const WA_RELAY_SEND_TIMEOUT_MS = 60_000;
/**
 * A synchronous send route (messages/send, messages/retry, connection/test)
 * answers within this: the house TimeoutInterceptor cuts every request at 15 s
 * (HTTP_408), shorter than a slow relay. Past it the route answers SENDING and
 * the send runs on (the row settles in the WhatsApp Log).
 */
export const WA_SYNC_ANSWER_MS = 12_000;
/** The /get "is the relay there" probe: short, so the screen never waits on it. */
export const WA_HEALTH_TIMEOUT_MS = 3_000;

/** Decision 20 — polling. */
export const WA_POLL = {
  TICK_MS: 10_000,
  SLOW_MS: 60_000,
  FAST_MS: 10_000,
  FAST_WINDOW_MS: 5 * 60_000,
  BACKOFF_AFTER_FAILS: 3,
  BACKOFF_MS: 5 * 60_000,
  /**
   * Review N5 — the lease outlives a worst-case pull: no new page starts after
   * PULL_BUDGET_MS (120 s); the last page is at most an events call + an ack
   * (30 s each), then one /v1/connection read (30 s) — 210 s in all, under 300.
   */
  LEASE_SECONDS: 300,
  PULL_BUDGET_MS: 120_000,
  CONNECTION_EVERY_MS: 30 * 60_000,
  SENDING_SWEEP_MINUTES: 10,
  RETENTION_EVERY_MS: 24 * 60 * 60_000,
} as const;

/** The relay's own codes (wa-relay-keys §0 / §5). */
export const RELAY_CODES = {
  KEY_INVALID: 'RELAY_KEY_INVALID',
  KEY_REVOKED: 'RELAY_KEY_REVOKED',
  SHOP_SUSPENDED: 'RELAY_SHOP_SUSPENDED',
  NOT_CONNECTED: 'RELAY_NOT_CONNECTED',
  ALREADY_CONNECTED: 'RELAY_ALREADY_CONNECTED',
  CODE_INVALID: 'RELAY_CODE_INVALID',
  TEMPLATE_NOT_APPROVED: 'RELAY_TEMPLATE_NOT_APPROVED',
  PDF_TOO_BIG: 'RELAY_PDF_TOO_BIG',
  PAYLOAD_TOO_BIG: 'RELAY_PAYLOAD_TOO_BIG',
  META_ERROR: 'RELAY_META_ERROR',
  META_UNREACHABLE: 'RELAY_META_UNREACHABLE',
  RATE_LIMITED: 'RELAY_RATE_LIMITED',
  INTERNAL: 'RELAY_INTERNAL',
  NOT_FOUND: 'RELAY_NOT_FOUND',
  DB_DOWN: 'RELAY_DB_DOWN',
  BAD_REQUEST: 'RELAY_BAD_REQUEST',
  /**
   * Review S3 — HTTP 504 on POST /v1/messages: the relay handed the message on but
   * could not confirm Meta's answer in time. It may have gone: the row stays
   * SENDING and the event poll settles it (or the sweeper after 10 minutes).
   */
  SEND_UNCONFIRMED: 'RELAY_SEND_UNCONFIRMED',
} as const;
