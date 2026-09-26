import { LOOKUP_NAME_NOISE_TOKENS } from '../master-lookup.constants';
import { DropdownLookupColumnConfig, LookupRow } from '../types/master-lookup-internal.types';

/**
 * Configured dropdowns name their columns freely ("cgr_id", "Cus group name"),
 * so the id/name columns are found by shape rather than by a fixed key. Every
 * comparison happens on the normalized token form produced here.
 */
export function normalizeLookupToken(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !LOOKUP_NAME_NOISE_TOKENS.has(token))
    .join(' ');
}

/** Normalized keys of an actual result row, in column order. */
export function resolveRowLookupKeys(row: LookupRow): string[] {
  return normalizeUniqueTokens(Object.keys(row));
}

/** Normalized keys the dropdown config declares — each column's name, then its alias. */
export function resolveConfiguredLookupKeys(columns: DropdownLookupColumnConfig[]): string[] {
  return normalizeUniqueTokens(columns.flatMap((col) => [col.name, col.alias]));
}

/** The first id-shaped key, falling back to the leading key. */
export function resolveLikelyIdKey(keys: string[]): string | undefined {
  return keys.find((key) => isLikelyIdKey(key)) ?? keys[0];
}

/** The first name-shaped key other than the id, then any other key. */
export function resolveLikelyNameKey(
  keys: string[],
  idKey?: string,
  fallbackToId = true,
): string | undefined {
  return (
    keys.find((key) => key !== idKey && isLikelyNameKey(key)) ??
    keys.find((key) => key !== idKey) ??
    (fallbackToId ? idKey : undefined)
  );
}

/** Reads the row column whose key normalizes to `normalizedKey`. */
export function readLookupRowValue(row: LookupRow, normalizedKey: string): string | undefined {
  for (const [actualKey, value] of Object.entries(row)) {
    if (normalizeLookupToken(actualKey) === normalizedKey) {
      return toLookupValue(value);
    }
  }
  return undefined;
}

/** Scalar column value as a lookup string; blanks and non-scalars become undefined. */
export function toLookupValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return undefined;
}

function isLikelyIdKey(value: string): boolean {
  const tokens = value.split(' ').filter(Boolean);
  return tokens.includes('id') || tokens.includes('uuid') || tokens.includes('value');
}

function isLikelyNameKey(value: string): boolean {
  const tokens = value.split(' ').filter(Boolean);
  return (
    tokens.includes('name') ||
    tokens.includes('label') ||
    tokens.includes('title') ||
    tokens.includes('alias') ||
    tokens.includes('short') ||
    tokens.includes('description')
  );
}

function normalizeUniqueTokens(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const value of values) {
    const normalized = normalizeLookupToken(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      keys.push(normalized);
    }
  }
  return keys;
}
