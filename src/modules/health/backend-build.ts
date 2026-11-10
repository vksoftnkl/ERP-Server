import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Part B Step 2: which backend build is running, for /health.
 *
 *   version  APP_VERSION, else package.json's version, else 'unknown'
 *   build    APP_BUILD (digits only), else null
 *   commit   APP_COMMIT, else null
 *
 * CI sets the three APP_* variables in production (Step 4). Locally they are
 * optional. Read once and kept: they cannot change while the process runs.
 */
export interface BackendBuild {
  version: string;
  build: number | null;
  commit: string | null;
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
  return {
    version: text(env.APP_VERSION, 32) ?? packageVersion(startDir) ?? 'unknown',
    build: buildNumber(env.APP_BUILD),
    commit: text(env.APP_COMMIT, 40),
  };
}

function text(value: string | undefined, maxLength: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function buildNumber(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{1,15}$/.test(trimmed)) {
    return null;
  }
  const build = Number(trimmed);
  return Number.isSafeInteger(build) ? build : null;
}

/** The version of the nearest package.json above `startDir` (src/… under ts, dist/src/… built). */
function packageVersion(startDir: string): string | null {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: unknown };
        return typeof parsed.version === 'string' && parsed.version.trim()
          ? parsed.version.trim()
          : null;
      } catch {
        return null;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}
