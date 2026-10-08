import { readFile } from 'node:fs/promises';
import { isAbsolute, normalize, resolve, sep } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Logo and signature resolution, with a size-capped in-memory cache.
 *
 * ── Why this is not just readFile ───────────────────────────────────────────
 * An image source comes out of a template expression, which means it comes out
 * of TENANT-AUTHORED content. `{{ company.logoUrl }}` is the intended use;
 * `../../../.env` and `http://169.254.169.254/latest/meta-data/` are what an
 * unrestricted fetcher would also accept. So:
 *
 *   * `data:` URIs are decoded inline and never touch the filesystem.
 *   * File paths are resolved and then required to sit INSIDE an allowed root.
 *     A path that escapes it is refused, not clamped.
 *   * `http(s)` is DISABLED by default. A render is a server-side request with
 *     the server's network position, so enabling it is an SSRF decision an
 *     operator makes deliberately via PRINT_ALLOW_REMOTE_IMAGES, not a
 *     default a template author gets for free.
 *
 * The cache is bounded by TOTAL BYTES, not entry count. A 6MB scanned
 * signature and a 4KB logo are not interchangeable, and a hundred-entry cache
 * of the former is how a 4 GB VPS runs out of memory mid-bulk-run.
 */

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const MAX_SINGLE_IMAGE_BYTES = 8 * 1024 * 1024;

interface CacheEntry {
  readonly bytes: Buffer;
  lastUsedAt: number;
}

@Injectable()
export class ImageCache {
  private readonly logger = new Logger(ImageCache.name);

  private readonly entries = new Map<string, CacheEntry>();

  private totalBytes = 0;

  private readonly warnings = new Set<string>();

  private readonly allowedRoots: string[];

  private readonly allowRemote: boolean;

  private readonly maxBytes: number;

  constructor() {
    this.allowedRoots = resolveAllowedRoots();
    this.allowRemote = ['1', 'true', 'yes', 'on'].includes(
      (process.env.PRINT_ALLOW_REMOTE_IMAGES ?? '').toLowerCase(),
    );
    this.maxBytes = Number(process.env.PRINT_IMAGE_CACHE_BYTES) || DEFAULT_MAX_BYTES;
  }

  drainWarnings(): string[] {
    const drained = [...this.warnings];
    this.warnings.clear();
    return drained;
  }

  /** Resolve an image source to bytes, or null if it cannot be used. */
  async resolveImage(source: string): Promise<Buffer | null> {
    const trimmed = source.trim();
    if (!trimmed) {
      return null;
    }

    const cached = this.entries.get(trimmed);
    if (cached) {
      cached.lastUsedAt = Date.now();
      return cached.bytes;
    }

    const bytes = await this.load(trimmed);
    if (!bytes) {
      return null;
    }

    if (bytes.length > MAX_SINGLE_IMAGE_BYTES) {
      this.warn(
        `Image '${truncateForLog(trimmed)}' is ${(bytes.length / 1024 / 1024).toFixed(1)}MB, over the ${
          MAX_SINGLE_IMAGE_BYTES / 1024 / 1024
        }MB per-image cap`,
      );
      return null;
    }

    this.store(trimmed, bytes);
    return bytes;
  }

  private async load(source: string): Promise<Buffer | null> {
    if (source.startsWith('data:')) {
      return this.decodeDataUri(source);
    }

    if (/^https?:\/\//i.test(source)) {
      if (!this.allowRemote) {
        this.warn(
          `Remote image '${truncateForLog(source)}' refused. Set PRINT_ALLOW_REMOTE_IMAGES=true ` +
            'to enable remote fetching, understanding that a render then makes ' +
            'outbound requests from the server.',
        );
        return null;
      }
      return this.fetchRemote(source);
    }

    return this.readLocal(source);
  }

  private decodeDataUri(source: string): Buffer | null {
    // data:[<mediatype>][;base64],<data>
    const comma = source.indexOf(',');
    if (comma < 0) {
      this.warn('Malformed data: URI in an image element');
      return null;
    }

    const header = source.slice(5, comma);
    const payload = source.slice(comma + 1);

    try {
      return header.includes(';base64')
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'binary');
    } catch (error) {
      this.warn(
        `Could not decode data: URI: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async readLocal(source: string): Promise<Buffer | null> {
    const candidate = isAbsolute(source) ? normalize(source) : resolve(process.cwd(), source);

    // Containment check on the NORMALISED path, and with a trailing separator:
    // without it '/srv/assets-evil' passes a naive startsWith('/srv/assets').
    const contained = this.allowedRoots.some(
      (root) => candidate === root || candidate.startsWith(root + sep),
    );

    if (!contained) {
      this.warn(
        `Image path '${truncateForLog(source)}' is outside the allowed roots ` +
          `(${this.allowedRoots.join(', ')}) and was refused`,
      );
      return null;
    }

    try {
      return await readFile(candidate);
    } catch (error) {
      this.warn(
        `Image '${truncateForLog(source)}' could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async fetchRemote(source: string): Promise<Buffer | null> {
    try {
      const controller = new AbortController();
      // A render holds a worker slot. A logo host that hangs must not hold it
      // with it — 5s is already generous for an image on the same LAN.
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const response = await fetch(source, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timeout);

      if (!response.ok) {
        this.warn(`Image '${truncateForLog(source)}' returned HTTP ${response.status}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.warn(
        `Image '${truncateForLog(source)}' could not be fetched: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /** Insert, evicting least-recently-used entries until the total fits. */
  private store(key: string, bytes: Buffer): void {
    while (this.totalBytes + bytes.length > this.maxBytes && this.entries.size > 0) {
      let oldestKey: string | null = null;
      let oldestAt = Number.POSITIVE_INFINITY;

      for (const [candidateKey, entry] of this.entries) {
        if (entry.lastUsedAt < oldestAt) {
          oldestAt = entry.lastUsedAt;
          oldestKey = candidateKey;
        }
      }

      if (oldestKey === null) {
        break;
      }

      const evicted = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      this.totalBytes -= evicted?.bytes.length ?? 0;
    }

    // A single image larger than the whole budget is simply not cached; it is
    // still returned to the caller, which is the useful behaviour.
    if (bytes.length <= this.maxBytes) {
      this.entries.set(key, { bytes, lastUsedAt: Date.now() });
      this.totalBytes += bytes.length;
    }
  }

  private warn(message: string): void {
    this.warnings.add(message);
    this.logger.warn(message);
  }

  /** Test and diagnostics accessor. */
  stats(): {
    entries: number;
    bytes: number;
    allowedRoots: readonly string[];
    allowRemote: boolean;
  } {
    return {
      entries: this.entries.size,
      bytes: this.totalBytes,
      allowedRoots: this.allowedRoots,
      allowRemote: this.allowRemote,
    };
  }
}

/**
 * Directories a template may read an image from.
 *
 * PRINT_IMAGE_ROOTS is a path-separator-joined list. The default is the
 * bundled assets directory plus an `uploads` directory, which is where a
 * customer's uploaded logo lands.
 */
const resolveAllowedRoots = (): string[] => {
  const configured = process.env.PRINT_IMAGE_ROOTS?.trim();
  const raw = configured ? configured.split(/[:;]/).filter(Boolean) : ['assets', 'uploads'];

  return raw.map((entry) => (isAbsolute(entry) ? normalize(entry) : resolve(process.cwd(), entry)));
};

const truncateForLog = (value: string): string =>
  value.length > 120 ? `${value.slice(0, 117)}...` : value;
