import { Prisma } from '@prisma/client';
import type { AgeBy } from './types/party-outstanding.types';

/**
 * §4.4 — ageing, due dates and bucket labels. Pure: no database, no Nest. The
 * SQL in party-outstanding.sql.ts buckets with `bucketIndexSql`, which is built
 * from the same edges by the same rule as `bucketIndex`, so a row's bucket and
 * its label cannot disagree.
 *
 *   dueEff(b)    = COALESCE(abl_due_date, abl_doc_date + abl_credit_days)   (O2)
 *   overdue on D ⇔ D > dueEff + grace;   overdueDays = D − dueEff − grace (when > 0)
 *   BILL_DATE    age = D − doc_date
 *   DUE_DATE     age = D − dueEff;  age < 0 → 'Not due', the first bucket
 */

export const DEFAULT_BUCKETS: readonly number[] = [30, 60, 90, 180];
export const MAX_BUCKET_EDGES = 6;
export const MAX_BUCKET_DAYS = 3650;
export const NOT_DUE_LABEL = 'Not due';

/**
 * `"30,60,90,180"` → `[30, 60, 90, 180]`; null when it breaks a rule (1 to 6
 * whole numbers, each 1–3650, strictly rising). Commas and/or spaces separate.
 * Absent / blank → the default edges.
 */
export function parseBuckets(raw: string | null | undefined): number[] | null {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return [...DEFAULT_BUCKETS];
  }
  const parts = raw.split(/[\s,]+/).filter((p) => p !== '');
  if (parts.length < 1 || parts.length > MAX_BUCKET_EDGES) {
    return null;
  }
  const edges: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (n < 1 || n > MAX_BUCKET_DAYS) {
      return null;
    }
    if (edges.length > 0 && n <= edges[edges.length - 1]) {
      return null;
    }
    edges.push(n);
  }
  return edges;
}

/** `[30, 60]` → `['0–30', '31–60', '> 60']`, with 'Not due' first for DUE_DATE. */
export function bucketLabels(edges: readonly number[], ageBy: AgeBy): string[] {
  const labels: string[] = ageBy === 'DUE_DATE' ? [NOT_DUE_LABEL] : [];
  let low = 0;
  for (const edge of edges) {
    labels.push(`${low}–${edge}`);
    low = edge + 1;
  }
  labels.push(`> ${edges[edges.length - 1]}`);
  return labels;
}

export function bucketCount(edges: readonly number[], ageBy: AgeBy): number {
  return edges.length + 1 + (ageBy === 'DUE_DATE' ? 1 : 0);
}

/** The bucket an owed bill of `age` days falls in — the index into bucketLabels. */
export function bucketIndex(age: number, edges: readonly number[], ageBy: AgeBy): number {
  const shift = ageBy === 'DUE_DATE' ? 1 : 0;
  if (ageBy === 'DUE_DATE' && age < 0) {
    return 0;
  }
  for (let i = 0; i < edges.length; i += 1) {
    if (age <= edges[i]) {
      return i + shift;
    }
  }
  return edges.length + shift;
}

/** `bucketIndex` as a SQL CASE over an integer age expression. */
export function bucketIndexSql(
  ageExpr: Prisma.Sql,
  edges: readonly number[],
  ageBy: AgeBy,
): Prisma.Sql {
  const shift = ageBy === 'DUE_DATE' ? 1 : 0;
  const arms: Prisma.Sql[] = [];
  if (ageBy === 'DUE_DATE') {
    arms.push(Prisma.sql`WHEN ${ageExpr} < 0 THEN 0`);
  }
  edges.forEach((edge, i) => {
    arms.push(Prisma.sql`WHEN ${ageExpr} <= ${edge}::int THEN ${i + shift}::int`);
  });
  return Prisma.sql`(CASE ${Prisma.join(arms, ' ')} ELSE ${edges.length + shift}::int END)`;
}

/**
 * The "Above N days" tile's N — the THIRD bucket edge (90 in the default set),
 * or the last edge when there are fewer than three.
 */
export function aboveDaysEdge(edges: readonly number[]): number {
  return edges[2] ?? edges[edges.length - 1];
}

/** O2 — the due date ageing and overdue are measured from. */
export function dueEff(docDate: string, dueDate: string | null, creditDays: number | null): string {
  return dueDate ?? addDays(docDate, creditDays ?? 0);
}

/** Days past dueEff + grace on `asOn`, or null when not overdue. */
export function overdueDays(asOn: string, due: string, graceDays: number | null): number | null {
  const days = daysBetween(due, asOn) - (graceDays ?? 0);
  return days > 0 ? days : null;
}

export function ageOf(asOn: string, docDate: string, due: string, ageBy: AgeBy): number {
  return ageBy === 'DUE_DATE' ? daysBetween(due, asOn) : daysBetween(docDate, asOn);
}

// ── ISO date arithmetic (UTC midnight, so no zone can shift a day) ──────────

const DAY_MS = 86_400_000;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `to − from` in whole days. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** A real calendar date in `YYYY-MM-DD` (rejects 2026-02-30). */
export function isRealIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return false;
  }
  const t = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
}

/**
 * Today in IST — the business date. Not the Node process's UTC date: between
 * 00:00 and 05:30 IST that is still yesterday.
 */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

// ── collection days ─────────────────────────────────────────────────────────

/**
 * `sales.area_master.arm_collection_days` holds ISO weekday numbers, Monday = 1
 * … Sunday = 7 (the stored values run 1–7; Postgres `isodow` counts the same
 * way). The Qt customer-group / supplier widget numbers Monday = 0 — that is a
 * different column and is not read here.
 */
export const COLLECTION_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type CollectionDay = (typeof COLLECTION_DAYS)[number];

export function collectionDayNumber(day: CollectionDay): number {
  return COLLECTION_DAYS.indexOf(day) + 1;
}

export function collectionDayNames(days: readonly number[] | null): string[] {
  return [...new Set(days ?? [])]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b)
    .map((d) => COLLECTION_DAYS[d - 1]);
}
