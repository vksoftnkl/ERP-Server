/**
 * Notes 120 — the plain words for an error code live on the server. Every
 * refusal carries a `code` (notes 119); this registry turns it into the words
 * a cashier reads, attached beside `field`, `code` and `message`:
 *
 *   { "field": "sbSessionId", "code": "TILL_SESSION_NOT_OPEN", "status": "PENDING_APPROVAL",
 *     "message": "Session … is PENDING_APPROVAL: it takes no money",
 *     "user": { "title": "Cannot take payment",
 *               "line": "Your till is waiting for supervisor OK.",
 *               "todo": "Call supervisor." } }
 *
 * The rows are fixed.error_message, loaded into memory by ErrorMessageService
 * (src/modules/error-messages) and read here with no DI, so every exception
 * filter — the module filters, TillExceptionFilter, AllExceptionsFilter — words
 * its errors without a constructor change, and no throw site changes.
 *
 * A code with no row gets no `user` block: the developer sentence is never put
 * into it (the app shows `message` under a plain title instead).
 */

/** One row of fixed.error_message, as the registry and GET /error-messages carry it. */
export interface ErrorWordingRow {
  code: string;
  /** '' = plain · field=<name> · <key>=<value> · <key>=* (any value). */
  variant: string;
  lang: string;
  title: string;
  line: string;
  todo: string;
}

/** The `user` block on an error. */
export interface UserWording {
  title: string;
  line: string;
  todo: string;
}

interface Variant {
  key: string;
  /** null = `*`, any value. */
  value: string | null;
  row: ErrorWordingRow;
}

interface CodeEntry {
  plain: ErrorWordingRow | null;
  variants: Variant[];
}

const DEFAULT_LANG = 'en';

/** lang → code (or prefix without its *) → entry. */
let exact = new Map<string, Map<string, CodeEntry>>();
/** lang → prefix rows, longest prefix first. */
let prefixes = new Map<string, { prefix: string; entry: CodeEntry }[]>();
let catalogueVersion: string | null = null;

/** Replace the whole catalogue (ErrorMessageService, on boot and on a new version). */
export function setErrorWording(rows: readonly ErrorWordingRow[], version: string | null): void {
  const nextExact = new Map<string, Map<string, CodeEntry>>();
  const nextPrefixes = new Map<string, Map<string, CodeEntry>>();
  for (const row of rows) {
    const isPrefix = row.code.endsWith('*');
    const key = isPrefix ? row.code.slice(0, -1) : row.code;
    const byLang = isPrefix ? nextPrefixes : nextExact;
    const codes = byLang.get(row.lang) ?? new Map<string, CodeEntry>();
    byLang.set(row.lang, codes);
    const entry = codes.get(key) ?? { plain: null, variants: [] };
    codes.set(key, entry);
    const variant = parseVariant(row.variant);
    if (variant) {
      entry.variants.push({ ...variant, row });
    } else {
      entry.plain = row;
    }
  }
  exact = nextExact;
  prefixes = new Map(
    [...nextPrefixes].map(([lang, codes]) => [
      lang,
      [...codes]
        .map(([prefix, entry]) => ({ prefix, entry }))
        .sort((a, b) => b.prefix.length - a.prefix.length),
    ]),
  );
  catalogueVersion = version;
}

export function errorWordingVersion(): string | null {
  return catalogueVersion;
}

/**
 * The words for one error, or null when the catalogue has none. The exact code
 * before any prefix row; within one, `field=` first, then `<key>=<value>`,
 * then `<key>=*`, then the plain row. A language with no row for the code
 * falls back to English.
 */
export function wordingFor(
  detail: Record<string, unknown>,
  lang: string = DEFAULT_LANG,
): UserWording | null {
  const code = typeof detail.code === 'string' ? detail.code : null;
  if (!code) {
    return null;
  }
  const langs = lang === DEFAULT_LANG ? [lang] : [lang, DEFAULT_LANG];
  for (const l of langs) {
    const entry = exact.get(l)?.get(code);
    const row = entry ? pick(entry, detail) : null;
    if (row) {
      return toUser(row);
    }
    for (const p of prefixes.get(l) ?? []) {
      if (code.startsWith(p.prefix)) {
        const prefixed = pick(p.entry, detail);
        if (prefixed) {
          return toUser(prefixed);
        }
      }
    }
  }
  return null;
}

/**
 * The house error body with each coded error worded — a copy; the thrown
 * exception's own object is never touched. `warnings[]` / `refusals[]` of a
 * success body are worded by withUserWordingOnNotes.
 */
export function withUserWording<T>(body: T, lang: string = DEFAULT_LANG): T {
  if (!isRecord(body) || !Array.isArray(body.errors)) {
    return body;
  }
  return { ...body, errors: wordList(body.errors, lang) };
}

/**
 * A success body whose data carries `warnings[]` / `refusals[]` (the /validate
 * answers, a post that went through with warnings): each note with a code gets
 * its `user` block too.
 */
export function withUserWordingOnNotes<T>(body: T, lang: string = DEFAULT_LANG): T {
  if (!isRecord(body) || !isRecord(body.data)) {
    return body;
  }
  const data = body.data;
  const lists = ['warnings', 'refusals'].filter((k) => Array.isArray(data[k]));
  if (lists.length === 0) {
    return body;
  }
  const worded: Record<string, unknown> = { ...data };
  for (const k of lists) {
    worded[k] = wordList(data[k] as unknown[], lang);
  }
  return { ...body, data: worded };
}

/**
 * The language an error is worded in: `lang` from the query, else the first
 * tag of Accept-Language ('ta-IN' → 'ta'), else English. Only English rows
 * exist today; Tamil later is new rows, no app change.
 */
export function wordingLangOf(request: {
  query?: unknown;
  headers?: Record<string, unknown>;
}): string {
  const query = isRecord(request.query) ? request.query.lang : undefined;
  const header = request.headers?.['accept-language'];
  const raw =
    (typeof query === 'string' && query) ||
    (typeof header === 'string' && header.split(',')[0]) ||
    DEFAULT_LANG;
  const lang = raw.trim().toLowerCase().split(/[-_;]/)[0];
  return /^[a-z]{2}$/.test(lang) ? lang : DEFAULT_LANG;
}

/**
 * An exception filter's response, wording every body it writes: replace
 * `host.switchToHttp().getResponse()` with this and nothing else changes.
 */
export function wordedResponse<
  TRes extends { status(code: number): { json(body: unknown): unknown } },
>(response: TRes, request: unknown): { status(code: number): { json(body: unknown): unknown } } {
  const lang = wordingLangOf(isRecord(request) ? request : {});
  return {
    status: (code: number) => ({
      json: (body: unknown) => response.status(code).json(withUserWording(body, lang)),
    }),
  };
}

function wordList(items: unknown[], lang: string): unknown[] {
  return items.map((item) => {
    if (!isRecord(item) || isRecord(item.user)) {
      return item;
    }
    const user = wordingFor(item, lang);
    return user ? { ...item, user } : item;
  });
}

function pick(entry: CodeEntry, detail: Record<string, unknown>): ErrorWordingRow | null {
  const valueOf = (key: string): string | null => {
    const v = detail[key];
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : null;
  };
  const byField = entry.variants.find(
    (v) => v.key === 'field' && v.value !== null && valueOf('field') === v.value,
  );
  if (byField) {
    return byField.row;
  }
  const byValue = entry.variants.find(
    (v) => v.key !== 'field' && v.value !== null && valueOf(v.key) === v.value,
  );
  if (byValue) {
    return byValue.row;
  }
  const byAny = entry.variants.find((v) => v.value === null && valueOf(v.key) !== null);
  if (byAny) {
    return byAny.row;
  }
  return entry.plain;
}

/** 'status=PENDING_APPROVAL' → { key, value }; 'status=*' → value null; '' → null. */
function parseVariant(variant: string): { key: string; value: string | null } | null {
  const at = variant.indexOf('=');
  if (!variant || at <= 0) {
    return null;
  }
  const value = variant.slice(at + 1);
  return { key: variant.slice(0, at), value: value === '*' ? null : value };
}

function toUser(row: ErrorWordingRow): UserWording {
  return { title: row.title, line: row.line, todo: row.todo };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
