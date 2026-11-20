import {
  isUniqueConstraintError,
  violatedConstraintOf,
} from 'src/common/utils/module-service.utils';

/**
 * Did `error` break a unique index known by `indexName`, or one over `column`?
 * Prisma names an index in several ways — a P2002's `meta.target` (the index
 * name, or its columns: `lower((emp_code)::text)` for an expression index), its
 * message, or a raw 23505's "Key (…)=(…)" detail — so every text is read. The
 * column is matched as a whole word, so `ed_code` never matches `led_code`.
 */
export function isUniqueViolationOf(error: unknown, indexName: string, column: string): boolean {
  if (!isUniqueConstraintError(error)) {
    return false;
  }
  const meta = (error as { meta?: Record<string, unknown> }).meta ?? {};
  const text = [
    violatedConstraintOf(error),
    typeof meta.message === 'string' ? meta.message : null,
    error instanceof Error ? error.message : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
  return (
    text.includes(indexName.toLowerCase()) ||
    new RegExp(`(^|[^a-z0-9_])${column.toLowerCase()}($|[^a-z0-9_])`).test(text)
  );
}
