import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import {
  CLIENT_PLATFORMS,
  MAX_CLIENT_BUILD,
  type ClientPlatform,
} from '../../../common/client-info/client-info';
import { COMPAT_MANIFEST_FILE } from '../app-version.constants';

/**
 * Part B Step 2 Rev 2 §3B / §5.1: the compat manifest. CI writes it into the
 * backend package. It names the client build this backend expects on each
 * platform. On the first start of a new APP_BUILD the backend copies it into
 * public.app_build_policy (rows an admin set by hand are left alone).
 *
 *   {
 *     "backendBuild": 57,                       optional; if given it must equal APP_BUILD
 *     "clients": {
 *       "web":     { "expectedBuild": 57,  "enforce": false },
 *       "desktop": { "expectedBuild": 120, "enforce": true,
 *                    "message": "Please update VK Nex Desktop",
 *                    "downloadUrl": "https://…/setup.exe" },
 *       "mobile":  { "expectedBuild": 20,  "enforce": false }
 *     }
 *   }
 *
 * `enforce` defaults to false, so a manifest switches nothing on unless it
 * says so per platform (rollout gate, decision D6: mobile stays false). A
 * platform left out reads as "expects nothing": enforce false, no build.
 * Anything malformed rejects the WHOLE manifest. The backend then changes
 * nothing (no epoch bump, no policy write) and logs why, the same as when the
 * file is missing.
 *
 * Where it is looked for, first hit wins:
 *   1. env APP_COMPAT_MANIFEST (absolute, or relative to the working directory)
 *   2. beside the executable, when running as the packed exe (scripts/build-exe.js)
 *   3. beside the package.json above this file (the repo / dist checkout)
 */
export interface CompatManifestEntry {
  expectedBuild: number | null;
  enforce: boolean;
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
const ENTRY_KEYS: ReadonlySet<string> = new Set([
  'expectedBuild',
  'enforce',
  'message',
  'downloadUrl',
]);
const TOP_KEYS: ReadonlySet<string> = new Set([
  'backendBuild',
  'clients',
  // free-form, for people reading the file
  'generatedAt',
  'commit',
  'version',
  'comment',
]);

const NO_EXPECTATION: Readonly<CompatManifestEntry> = Object.freeze({
  expectedBuild: null,
  enforce: false,
  message: null,
  downloadUrl: null,
});

export function locateCompatManifest(
  env: NodeJS.ProcessEnv,
  startDir: string = __dirname,
  execPath: string | null = isPackedExe() ? process.execPath : null,
): string | null {
  const configured = env.APP_COMPAT_MANIFEST?.trim();
  if (configured) {
    // An explicit path is final: a typo must not silently fall back to another file.
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  if (execPath) {
    const besideExe = join(dirname(execPath), COMPAT_MANIFEST_FILE);
    if (existsSync(besideExe)) {
      return besideExe;
    }
  }
  const root = packageRoot(startDir);
  if (root) {
    const besidePackage = join(root, COMPAT_MANIFEST_FILE);
    if (existsSync(besidePackage)) {
      return besidePackage;
    }
  }
  return null;
}

export function loadCompatManifest(
  appBuild: number,
  env: NodeJS.ProcessEnv = process.env,
  startDir: string = __dirname,
): CompatManifestResult {
  const path = locateCompatManifest(env, startDir);
  if (!path) {
    return { ok: false, path: null, reason: `no ${COMPAT_MANIFEST_FILE} found` };
  }
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unreadable';
    return { ok: false, path, reason: `cannot read it: ${message}` };
  }
  return parseCompatManifest(text, appBuild, path);
}

/** Pure: validates the file's text against APP_BUILD. */
export function parseCompatManifest(
  text: string,
  appBuild: number,
  path: string,
): CompatManifestResult {
  const fail = (reason: string): CompatManifestResult => ({ ok: false, path, reason });
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return fail('it is not valid JSON');
  }
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
      return fail(`backendBuild ${raw.backendBuild} is not this backend's APP_BUILD ${appBuild}`);
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
    const entry = clientsRaw[platform];
    if (entry === undefined || entry === null) {
      clients[platform] = { ...NO_EXPECTATION };
      continue;
    }
    const parsed = parseEntry(entry);
    if (typeof parsed === 'string') {
      return fail(`clients.${platform}: ${parsed}`);
    }
    clients[platform] = parsed;
  }
  return { ok: true, manifest: { path, backendBuild, clients } };
}

function parseEntry(entry: unknown): CompatManifestEntry | string {
  if (!isPlainObject(entry)) {
    return 'not an object';
  }
  const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key));
  if (unknown.length > 0) {
    return `unknown key(s) ${unknown.join(', ')}`;
  }
  const { expectedBuild, enforce, message, downloadUrl } = entry;
  if (expectedBuild !== undefined && expectedBuild !== null && !isBuildNumber(expectedBuild)) {
    return `expectedBuild must be an integer 1..${MAX_CLIENT_BUILD} or null`;
  }
  if (enforce !== undefined && typeof enforce !== 'boolean') {
    return 'enforce must be true or false';
  }
  const build = typeof expectedBuild === 'number' ? expectedBuild : null;
  if (enforce === true && build === null) {
    return 'enforce is true but expectedBuild is missing';
  }
  const text = (value: unknown, max: number, name: string): string | null | Error => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string' || value.length > max) {
      return new Error(`${name} must be a string of at most ${max} characters`);
    }
    return value.trim() || null;
  };
  const msg = text(message, MAX_MESSAGE_LENGTH, 'message');
  if (msg instanceof Error) {
    return msg.message;
  }
  const url = text(downloadUrl, MAX_URL_LENGTH, 'downloadUrl');
  if (url instanceof Error) {
    return url.message;
  }
  return { expectedBuild: build, enforce: enforce === true, message: msg, downloadUrl: url };
}

function isBuildNumber(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CLIENT_BUILD
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPackedExe(): boolean {
  return Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);
}

function packageRoot(startDir: string): string | null {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}
