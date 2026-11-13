import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Part B Step 4: the files CI puts into a backend package, next to package.json
 * (or next to the packed exe):
 *
 *   build-info.json  this backend's own version / build / commit / builtAt
 *   compat.json      the client build it expects per platform
 *   releases.json    the client release list, imported into app_release
 *
 * Where a file is looked for, first hit wins:
 *   1. env APP_PACKAGE_DIR (absolute, or relative to the working directory).
 *      Set = final: a typo must not silently fall back to another folder.
 *   2. beside the executable, when running as the packed exe (scripts/build-exe.js)
 *   3. beside the package.json above the running code (repo, dist or package folder)
 */
export const PACKAGE_FILES = {
  buildInfo: 'build-info.json',
  compat: 'compat.json',
  releases: 'releases.json',
} as const;

export type PackageFileName = (typeof PACKAGE_FILES)[keyof typeof PACKAGE_FILES];

export type PackageFileRead =
  | { found: true; path: string; json: unknown }
  | { found: false; path: string | null; reason: string };

export function locatePackageFile(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  startDir: string = __dirname,
  execPath: string | null = isPackedExe() ? process.execPath : null,
): string | null {
  const configured = env.APP_PACKAGE_DIR?.trim();
  if (configured) {
    return join(isAbsolute(configured) ? configured : resolve(process.cwd(), configured), name);
  }
  if (execPath) {
    const besideExe = join(dirname(execPath), name);
    if (existsSync(besideExe)) {
      return besideExe;
    }
  }
  const root = packageRoot(startDir);
  if (root) {
    const besidePackage = join(root, name);
    if (existsSync(besidePackage)) {
      return besidePackage;
    }
  }
  return null;
}

/** Locates and parses one package file. Never throws. */
export function readPackageFile(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  startDir: string = __dirname,
): PackageFileRead {
  const path = locatePackageFile(name, env, startDir);
  if (!path) {
    return { found: false, path: null, reason: `no ${name} found` };
  }
  if (!existsSync(path)) {
    return { found: false, path, reason: `${name} is not at ${path}` };
  }
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error: unknown) {
    return { found: false, path, reason: `cannot read it: ${describe(error)}` };
  }
  try {
    return { found: true, path, json: JSON.parse(text.replace(/^﻿/, '')) as unknown };
  } catch {
    return { found: false, path, reason: 'it is not valid JSON' };
  }
}

/** The folder of the nearest package.json at or above `startDir`. */
export function packageRoot(startDir: string): string | null {
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

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPackedExe(): boolean {
  return Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);
}

function describe(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
