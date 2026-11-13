import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PACKAGE_FILES,
  isPlainObject,
  packageRoot,
  readPackageFile,
} from '../../common/package-files/package-files';

/**
 * Part B: which backend build is running (/health, and the logout-after-update
 * check in app-version/services/backend-update.service.ts).
 *
 * Step 4: CI writes build-info.json into the backend package
 * ({ version, build, commit, builtAt }), so an on-prem install needs nothing in
 * .env. Each env var still wins over its field (the cloud sets them):
 *
 *   version  APP_VERSION, else build-info.json, else package.json, else 'unknown'
 *   build    APP_BUILD (digits), else build-info.json, else null
 *   commit   APP_COMMIT, else build-info.json, else null
 *   builtAt  build-info.json, else null
 *
 * Read once and kept: none of it can change while the process runs. A missing
 * or malformed build-info.json is the same as no file (fields fall through).
 */
export interface BackendBuild {
  version: string;
  build: number | null;
  commit: string | null;
  builtAt: string | null;
  /** Where `build` came from. */
  buildSource: 'env' | 'build-info' | 'none';
}

let cached: BackendBuild | null = null;

export function backendBuild(): BackendBuild {
  cached ??= resolveBackendBuild(process.env);
  return cached;
}

export function resolveBackendBuild(
  env: NodeJS.ProcessEnv,
  startDir: string = __dirname,
): BackendBuild {
  const info = buildInfo(env, startDir);
  const envBuild = buildNumber(env.APP_BUILD);
  const fileBuild = buildNumber(info.build);
  return {
    version:
      text(env.APP_VERSION, 32) ?? text(info.version, 32) ?? packageVersion(startDir) ?? 'unknown',
    build: envBuild ?? fileBuild,
    commit: text(env.APP_COMMIT, 40) ?? text(info.commit, 40),
    builtAt: text(info.builtAt, 40),
    buildSource: envBuild !== null ? 'env' : fileBuild !== null ? 'build-info' : 'none',
  };
}

function buildInfo(env: NodeJS.ProcessEnv, startDir: string): Record<string, unknown> {
  const read = readPackageFile(PACKAGE_FILES.buildInfo, env, startDir);
  return read.found && isPlainObject(read.json) ? read.json : {};
}

function text(value: unknown, maxLength: number): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function buildNumber(value: unknown): number | null {
  const raw =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!raw || !/^\d{1,15}$/.test(raw)) {
    return null;
  }
  const build = Number(raw);
  return Number.isSafeInteger(build) ? build : null;
}

/** The version of the nearest package.json above `startDir` (src/… under ts, dist/src/… built). */
function packageVersion(startDir: string): string | null {
  const root = packageRoot(startDir);
  const candidate = root ? join(root, 'package.json') : null;
  if (!candidate || !existsSync(candidate)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.trim()
      ? parsed.version.trim()
      : null;
  } catch {
    return null;
  }
}
