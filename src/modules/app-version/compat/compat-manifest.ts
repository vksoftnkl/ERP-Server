import {
  CLIENT_PLATFORMS,
  MAX_CLIENT_BUILD,
  type ClientPlatform,
} from '../../../common/client-info/client-info';
import {
  PACKAGE_FILES,
  isPlainObject,
  readPackageFile,
} from '../../../common/package-files/package-files';

/**
 * Part B Step 2 Rev 2 / Step 4 §5: compat.json, the client build this backend
 * package expects on each platform. CI writes it from the release registry
 * (the latest live release per platform, or a hand-set override). On the first
 * start of a new backend build it is copied into public.app_build_policy.
 *
 *   {
 *     "backendBuild": 1057,                  optional; if given it must equal this build
 *     "generatedAt": "2026-11-11T10:00:00Z", free-form keys for people: generatedAt, commit, version, comment
 *     "clients": {
 *       "web": 24,                           a bare number = { "expectedBuild": 24 }
 *       "desktop": { "expectedBuild": 120, "message": "…", "downloadUrl": "https://…" },
 *       "mobile": null
 *     }
 *   }
 *
 * It NEVER switches enforcement (Step 4): `enforce` is an admin's call
 * (PATCH /app-version/policy/:platform), and a manifest that carries it is
 * refused. A platform left out, or null, means "no new value": the stored
 * expected build stays as it is. Anything malformed rejects the WHOLE file; the
 * backend then behaves as if it were missing (no logout, no policy change).
 * Located like every package file (common/package-files).
 */
export interface CompatManifestEntry {
  /** null = keep the stored value. */
  expectedBuild: number | null;
  message: string | null;
  downloadUrl: string | null;
}

export interface CompatManifest {
  /** The file it was read from. */
  path: string;
  backendBuild: number | null;
  clients: Record<ClientPlatform, CompatManifestEntry>;
}

export type CompatManifestResult =
  | { ok: true; manifest: CompatManifest }
  | { ok: false; path: string | null; reason: string };

const MAX_MESSAGE_LENGTH = 500;
const MAX_URL_LENGTH = 500;
const ENTRY_KEYS: ReadonlySet<string> = new Set(['expectedBuild', 'message', 'downloadUrl']);
const TOP_KEYS: ReadonlySet<string> = new Set([
  'backendBuild',
  'clients',
  'generatedAt',
  'commit',
  'version',
  'comment',
]);

export function loadCompatManifest(
  appBuild: number,
  env: NodeJS.ProcessEnv = process.env,
  startDir: string = __dirname,
): CompatManifestResult {
  const read = readPackageFile(PACKAGE_FILES.compat, env, startDir);
  if (!read.found) {
    return { ok: false, path: read.path, reason: read.reason };
  }
  return parseCompatManifest(read.json, appBuild, read.path);
}

/** Pure: validates the parsed file against this backend's build. */
export function parseCompatManifest(
  raw: unknown,
  appBuild: number,
  path: string,
): CompatManifestResult {
  const fail = (reason: string): CompatManifestResult => ({ ok: false, path, reason });
  if (!isPlainObject(raw)) {
    return fail('it is not a JSON object');
  }
  const unknownTop = Object.keys(raw).filter((key) => !TOP_KEYS.has(key));
  if (unknownTop.length > 0) {
    return fail(`unknown key(s) ${unknownTop.join(', ')}`);
  }
  let backendBuild: number | null = null;
  if (raw.backendBuild !== undefined && raw.backendBuild !== null) {
    if (!isBuildNumber(raw.backendBuild)) {
      return fail('backendBuild is not a positive integer');
    }
    if (raw.backendBuild !== appBuild) {
      return fail(`backendBuild ${raw.backendBuild} is not this backend's build ${appBuild}`);
    }
    backendBuild = raw.backendBuild;
  }
  if (!isPlainObject(raw.clients)) {
    return fail('clients is missing or not an object');
  }
  const clientsRaw = raw.clients;
  const unknownPlatforms = Object.keys(clientsRaw).filter(
    (key) => !(CLIENT_PLATFORMS as readonly string[]).includes(key),
  );
  if (unknownPlatforms.length > 0) {
    return fail(
      `unknown platform(s) ${unknownPlatforms.join(', ')} (expected ${CLIENT_PLATFORMS.join(' | ')})`,
    );
  }
  const clients = {} as Record<ClientPlatform, CompatManifestEntry>;
  for (const platform of CLIENT_PLATFORMS) {
    const parsed = parseEntry(clientsRaw[platform]);
    if (typeof parsed === 'string') {
      return fail(`clients.${platform}: ${parsed}`);
    }
    clients[platform] = parsed;
  }
  return { ok: true, manifest: { path, backendBuild, clients } };
}

function parseEntry(entry: unknown): CompatManifestEntry | string {
  if (entry === undefined || entry === null) {
    return { expectedBuild: null, message: null, downloadUrl: null };
  }
  if (typeof entry === 'number') {
    return isBuildNumber(entry)
      ? { expectedBuild: entry, message: null, downloadUrl: null }
      : `a build must be an integer 1..${MAX_CLIENT_BUILD}`;
  }
  if (!isPlainObject(entry)) {
    return 'not a build number or an object';
  }
  if ('enforce' in entry) {
    return 'enforce is not read from compat.json; switch it with PATCH /app-version/policy/:platform';
  }
  const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key));
  if (unknown.length > 0) {
    return `unknown key(s) ${unknown.join(', ')}`;
  }
  const { expectedBuild, message, downloadUrl } = entry;
  if (expectedBuild !== undefined && expectedBuild !== null && !isBuildNumber(expectedBuild)) {
    return `expectedBuild must be an integer 1..${MAX_CLIENT_BUILD} or null`;
  }
  const msg = optionalText(message, MAX_MESSAGE_LENGTH, 'message');
  if (msg instanceof Error) {
    return msg.message;
  }
  const url = optionalText(downloadUrl, MAX_URL_LENGTH, 'downloadUrl');
  if (url instanceof Error) {
    return url.message;
  }
  return {
    expectedBuild: typeof expectedBuild === 'number' ? expectedBuild : null,
    message: msg,
    downloadUrl: url,
  };
}

function optionalText(value: unknown, max: number, name: string): string | null | Error {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.length > max) {
    return new Error(`${name} must be a string of at most ${max} characters`);
  }
  return value.trim() || null;
}

export function isBuildNumber(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CLIENT_BUILD
  );
}
