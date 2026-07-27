import { CONFIGURED_SQL_TABLE_REPLACEMENTS } from '../master-lookup.constants';
import { DropdownLookupConfig } from '../types/master-lookup-internal.types';

/**
 * The SQL statements to try for a configured dropdown, regional first, each one
 * already sanitised and rewritten. Duplicates are collapsed so identical
 * regional/base SQL is not run twice.
 */
export function resolveConfiguredSqlCandidates(config: DropdownLookupConfig): string[] {
  const candidates = [config.dropdownSqlRegional, config.dropdownSql]
    .map((value) => normalizeConfiguredSql(value))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(candidates));
}

/**
 * Sanitises one stored statement, or returns undefined when it cannot be run:
 * only a single SELECT/WITH statement is accepted, and the known editor
 * artefacts (a trailing comma before FROM, a dangling alias dot) are repaired
 * or rejected before the statement reaches the database.
 */
export function normalizeConfiguredSql(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/;+$/g, '').trim();
  if (!trimmed) return undefined;
  if (!/^(select|with)\b/i.test(trimmed)) return undefined;
  if (trimmed.includes(';')) return undefined;
  const normalized = trimmed.replace(
    /,(\s*(from|where|group\s+by|order\s+by|having|union|limit|offset)\b)/gi,
    '$1',
  );
  // Reject SQL that would cause "syntax error at or near '.'" — a dot without a
  // column name after it, e.g. "t. FROM" produced by an incomplete alias reference.
  if (/\.\s*(from|where|group\s+by|order\s+by|having|union|limit|offset)\b/i.test(normalized)) {
    return undefined;
  }
  return normalizeConfiguredSqlTableReferences(normalized);
}

function normalizeConfiguredSqlTableReferences(sql: string): string {
  return CONFIGURED_SQL_TABLE_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    sql,
  );
}
