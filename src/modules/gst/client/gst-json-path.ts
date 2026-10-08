/**
 * The JSONPath subset the gst_* rows use — `$`, `.name`, `[n]`, `['name']`:
 * '$.Data', '$.ErrorDetails[0].ErrorCode', '$.data.result.irn'. No wildcards
 * and no filters: a path that needs one is a row the mapper cannot honour, and
 * parsePath says so instead of guessing.
 */

export const REDACTED = '***';

type Segment = string | number;

export function parsePath(path: string): Segment[] {
  if (!path.startsWith('$')) {
    throw new Error(`JSONPath must start with $: ${path}`);
  }
  const segments: Segment[] = [];
  const pattern = /\.([A-Za-z_$][\w$-]*)|\[(\d+)\]|\['([^']*)'\]|\["([^"]*)"\]/y;
  let index = 1;
  while (index < path.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(path);
    if (!match) {
      throw new Error(`Unsupported JSONPath at "${path.slice(index)}": ${path}`);
    }
    segments.push(match[1] ?? (match[2] !== undefined ? Number(match[2]) : (match[3] ?? match[4])));
    index = pattern.lastIndex;
  }
  return segments;
}

/** The value at `path`, or undefined when any step is missing. */
export function getPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of parsePath(path)) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

/**
 * A deep copy of `root` with each path that exists replaced by '***' — what
 * the log stores. A path that does not resolve is skipped, and a path the
 * subset cannot parse blanks the whole value: a log line must never carry a
 * secret because a redact row was written in a dialect we do not read.
 */
export function redactPaths(root: unknown, paths: readonly string[]): unknown {
  if (root === null || typeof root !== 'object') {
    return root;
  }
  const copy = structuredClone(root) as Record<string | number, unknown>;
  for (const path of paths) {
    let segments: Segment[];
    try {
      segments = parsePath(path);
    } catch {
      return REDACTED;
    }
    if (!segments.length) {
      return REDACTED;
    }
    let parent: unknown = copy;
    for (const segment of segments.slice(0, -1)) {
      parent =
        parent !== null && typeof parent === 'object'
          ? (parent as Record<string | number, unknown>)[segment]
          : undefined;
    }
    const last = segments[segments.length - 1];
    if (parent !== null && typeof parent === 'object' && last in parent) {
      (parent as Record<string | number, unknown>)[last] = REDACTED;
    }
  }
  return copy;
}
