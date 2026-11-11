import { CLIENT_PLATFORMS, type ClientPlatform } from '../../../common/client-info/client-info';
import {
  PACKAGE_FILES,
  isPlainObject,
  readPackageFile,
} from '../../../common/package-files/package-files';
import { RELEASE_SEVERITIES, type ReleaseSeverity } from '../app-version.constants';
import { isBuildNumber } from './compat-manifest';

/**
 * Part B Step 4 §6 (decision E4): releases.json, the client release list CI
 * puts into the backend package. Each on-prem backend has its own database, so
 * this is how its app_release, and with it the update notice, gets filled with
 * no call to the cloud. Imported on the first start of a new backend build.
 *
 *   {
 *     "generatedAt": "2026-11-11T10:00:00Z",
 *     "releases": [
 *       { "platform": "desktop", "build": 24, "version": "1.2.0", "commit": "aa10be0d",
 *         "severity": "normal", "notes": "…", "downloadUrl": "https://…",
 *         "releasedAt": "2026-11-10T09:00:00Z", "isDeleted": false }
 *     ]
 *   }
 *
 * Yanked releases are listed too, with isDeleted true. The import never deletes
 * a row and never restores a yanked one (a stale list must not un-yank a bad
 * build). Anything malformed rejects the whole file: the import is skipped and
 * the rest of the startup step goes on.
 */
export interface ReleaseImport {
  platform: ClientPlatform;
  build: number;
  version: string;
  commit: string | null;
  severity: ReleaseSeverity;
  notes: string | null;
  downloadUrl: string | null;
  releasedAt: string;
  isDeleted: boolean;
}

export interface ReleaseList {
  path: string;
  releases: ReleaseImport[];
}

export type ReleaseListResult =
  | { ok: true; list: ReleaseList }
  | { ok: false; path: string | null; reason: string };

/** More would be a mistake (a client per day for 13 years); refuse rather than import it. */
const MAX_RELEASES = 5_000;
const ENTRY_KEYS: ReadonlySet<string> = new Set([
  'platform',
  'build',
  'version',
  'commit',
  'severity',
  'notes',
  'downloadUrl',
  'releasedAt',
  'isDeleted',
]);
const TOP_KEYS: ReadonlySet<string> = new Set(['releases', 'generatedAt', 'comment', 'source']);

export function loadReleaseList(
  env: NodeJS.ProcessEnv = process.env,
  startDir: string = __dirname,
): ReleaseListResult {
  const read = readPackageFile(PACKAGE_FILES.releases, env, startDir);
  if (!read.found) {
    return { ok: false, path: read.path, reason: read.reason };
  }
  return parseReleaseList(read.json, read.path);
}

export function parseReleaseList(raw: unknown, path: string): ReleaseListResult {
  const fail = (reason: string): ReleaseListResult => ({ ok: false, path, reason });
  if (!isPlainObject(raw)) {
    return fail('it is not a JSON object');
  }
  const unknownTop = Object.keys(raw).filter((key) => !TOP_KEYS.has(key));
  if (unknownTop.length > 0) {
    return fail(`unknown key(s) ${unknownTop.join(', ')}`);
  }
  if (!Array.isArray(raw.releases)) {
    return fail('releases is missing or not an array');
  }
  if (raw.releases.length > MAX_RELEASES) {
    return fail(`more than ${MAX_RELEASES} releases`);
  }
  const seen = new Set<string>();
  const releases: ReleaseImport[] = [];
  for (const [index, entry] of raw.releases.entries()) {
    const parsed = parseEntry(entry);
    if (typeof parsed === 'string') {
      return fail(`releases[${index}]: ${parsed}`);
    }
    const key = `${parsed.platform}:${parsed.build}`;
    if (seen.has(key)) {
      return fail(`releases[${index}]: ${parsed.platform} build ${parsed.build} is listed twice`);
    }
    seen.add(key);
    releases.push(parsed);
  }
  return { ok: true, list: { path, releases } };
}

function parseEntry(entry: unknown): ReleaseImport | string {
  if (!isPlainObject(entry)) {
    return 'not an object';
  }
  const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key));
  if (unknown.length > 0) {
    return `unknown key(s) ${unknown.join(', ')}`;
  }
  const { platform, build, version, commit, severity, notes, downloadUrl, releasedAt, isDeleted } =
    entry;
  if (typeof platform !== 'string' || !(CLIENT_PLATFORMS as readonly string[]).includes(platform)) {
    return `platform must be ${CLIENT_PLATFORMS.join(' | ')}`;
  }
  if (!isBuildNumber(build)) {
    return 'build must be a positive integer';
  }
  if (typeof version !== 'string' || !version.trim() || version.length > 32) {
    return 'version must be a non-empty string of at most 32 characters';
  }
  const severityValue = severity ?? 'normal';
  if (
    typeof severityValue !== 'string' ||
    !(RELEASE_SEVERITIES as readonly string[]).includes(severityValue)
  ) {
    return `severity must be ${RELEASE_SEVERITIES.join(' | ')}`;
  }
  if (typeof releasedAt !== 'string' || Number.isNaN(Date.parse(releasedAt))) {
    return 'releasedAt must be an ISO date-time';
  }
  if (isDeleted !== undefined && typeof isDeleted !== 'boolean') {
    return 'isDeleted must be true or false';
  }
  const texts: [string, unknown, number][] = [
    ['commit', commit, 40],
    ['notes', notes, 10_000],
    ['downloadUrl', downloadUrl, 500],
  ];
  for (const [name, value, max] of texts) {
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'string' || value.length > max)
    ) {
      return `${name} must be a string of at most ${max} characters or null`;
    }
  }
  const blankToNull = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  return {
    platform: platform as ClientPlatform,
    build,
    version: version.trim(),
    commit: blankToNull(commit),
    severity: severityValue as ReleaseSeverity,
    notes: blankToNull(notes),
    downloadUrl: blankToNull(downloadUrl),
    releasedAt: new Date(releasedAt).toISOString(),
    isDeleted: isDeleted === true,
  };
}
