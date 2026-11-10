import type { IncomingHttpHeaders } from 'node:http';

/**
 * Part B Step 2 — which client build is speaking, read from six request headers.
 *
 *   X-App-Platform   web | desktop | mobile
 *   X-App-Build      the CI build number, a positive integer (the only number compared)
 *   X-App-Version    display label, e.g. 1.2.0
 *   X-App-Commit     short git hash
 *   X-Device-Id      the client's own device id
 *   X-Device-Os      e.g. "Windows 11 23H2"
 *
 * Every header is optional, and a missing or unreadable one becomes null. Parsing
 * never throws, and nothing in Step 2 refuses a request over these headers: an
 * old build sends none of them and must see exactly what it saw before.
 *
 * Build 0, a negative number or anything that is not digits counts as "no build".
 * A local developer build should send nothing (or 0) so that it is not tracked.
 */
export const CLIENT_PLATFORMS = ['web', 'desktop', 'mobile'] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export const CLIENT_INFO_HEADERS = {
  platform: 'x-app-platform',
  build: 'x-app-build',
  version: 'x-app-version',
  commit: 'x-app-commit',
  deviceId: 'x-device-id',
  deviceOs: 'x-device-os',
} as const;

/** int4 upper bound: cin_build / arl_build are `integer`. */
export const MAX_CLIENT_BUILD = 2_147_483_647;

/** Column widths in public.client_installation; longer values are cut to fit. */
const MAX_LENGTH = {
  version: 32,
  commit: 40,
  deviceId: 100,
  deviceOs: 100,
} as const;

export interface ClientInfo {
  platform: ClientPlatform | null;
  build: number | null;
  version: string | null;
  commit: string | null;
  deviceId: string | null;
  deviceOs: string | null;
}

/** A client that said both which platform and which build it is. */
export type IdentifiedClientInfo = ClientInfo & { platform: ClientPlatform; build: number };

export const EMPTY_CLIENT_INFO: Readonly<ClientInfo> = Object.freeze({
  platform: null,
  build: null,
  version: null,
  commit: null,
  deviceId: null,
  deviceOs: null,
});

/** What the middleware hangs on the request (see client-info.middleware.ts). */
export type RequestWithClientInfo = { headers: IncomingHttpHeaders; clientInfo?: ClientInfo };

export function parseClientInfo(headers: IncomingHttpHeaders | undefined | null): ClientInfo {
  if (!headers || typeof headers !== 'object') {
    return { ...EMPTY_CLIENT_INFO };
  }
  return {
    platform: parsePlatform(headerText(headers[CLIENT_INFO_HEADERS.platform])),
    build: parseClientBuild(headerText(headers[CLIENT_INFO_HEADERS.build])),
    version: fit(headerText(headers[CLIENT_INFO_HEADERS.version]), MAX_LENGTH.version),
    commit: fit(headerText(headers[CLIENT_INFO_HEADERS.commit]), MAX_LENGTH.commit),
    deviceId: fit(headerText(headers[CLIENT_INFO_HEADERS.deviceId]), MAX_LENGTH.deviceId),
    deviceOs: fit(headerText(headers[CLIENT_INFO_HEADERS.deviceOs]), MAX_LENGTH.deviceOs),
  };
}

/** The request's client info: what the middleware attached, else parsed from its headers now. */
export function clientInfoOf(request: unknown): ClientInfo {
  if (!request || typeof request !== 'object') {
    return { ...EMPTY_CLIENT_INFO };
  }
  const candidate = request as Partial<RequestWithClientInfo>;
  return candidate.clientInfo ?? parseClientInfo(candidate.headers);
}

/** True only when the client sent a known platform AND a usable build number. */
export function hasClientBuild(info: ClientInfo | null | undefined): info is IdentifiedClientInfo {
  return Boolean(info && info.platform !== null && info.build !== null);
}

export function parsePlatform(value: string | null): ClientPlatform | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  return (CLIENT_PLATFORMS as readonly string[]).includes(normalized)
    ? (normalized as ClientPlatform)
    : null;
}

export function parseClientBuild(value: string | null): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) {
    return null;
  }
  const build = Number(value);
  return Number.isSafeInteger(build) && build >= 1 && build <= MAX_CLIENT_BUILD ? build : null;
}

/** The first non-blank value of a header, with control characters removed. */
function headerText(value: string | string[] | undefined): string | null {
  const values = Array.isArray(value) ? value : [value];
  for (const entry of values) {
    if (typeof entry !== 'string') {
      continue;
    }
    // eslint-disable-next-line no-control-regex
    const cleaned = entry.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return null;
}

function fit(value: string | null, maxLength: number): string | null {
  if (value === null) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}
