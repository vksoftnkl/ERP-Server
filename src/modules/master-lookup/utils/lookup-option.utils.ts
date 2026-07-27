import { toNumber } from '../../../common/utils/module-service.utils';
import { FreightChargeOption, NameIdOption } from '../types/master-lookup-api.types';
import { LookupRow } from '../types/master-lookup-internal.types';

/**
 * Builds the `{ id, name }` shape every lookup returns. A blank name falls back
 * to the id, except for configured dropdown rows — there a missing name column
 * must stay blank rather than echo the id back as a label.
 */
export function toOption(
  id: string,
  name: string | null | undefined,
  options?: { fallbackNameToId?: boolean },
): NameIdOption {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const fallbackNameToId = options?.fallbackNameToId ?? true;
  return {
    id,
    name: normalizedName || (fallbackNameToId ? id : ''),
  };
}

/** Configured dropdown rows are returned whole, so JSON-hostile values are converted. */
export function serializeLookupRow(row: LookupRow): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializeLookupValue(value)]),
  );
}

function serializeLookupValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeLookupValue(item));
  if (value && typeof value === 'object') {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
          key,
          serializeLookupValue(nested),
        ]),
      );
    }
  }
  return value;
}

export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Legacy billed_date: `concat((CURRENT_DATE - billed_date),' days : ',
 * to_char(billed_date, 'dd/MM/yy'))` → e.g. "10 days : 01/07/26". Uses UTC
 * getters since `@db.Date` values are returned at UTC midnight.
 */
export function formatBilledDate(billedDate: Date | null): string | null {
  if (!billedDate) return null;
  const now = new Date();
  const billedUtc = Date.UTC(
    billedDate.getUTCFullYear(),
    billedDate.getUTCMonth(),
    billedDate.getUTCDate(),
  );
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.floor((todayUtc - billedUtc) / 86_400_000);
  const dd = String(billedDate.getUTCDate()).padStart(2, '0');
  const mm = String(billedDate.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(billedDate.getUTCFullYear()).slice(-2);
  return `${days} days : ${dd}/${mm}/${yy}`;
}

export function toFreightChargeOption(row: {
  frId: string;
  frFromKm: number | null;
  frToKm: number | null;
  frFreightChrg: unknown;
  frFromWeight: unknown;
  frToWeight: unknown;
}): FreightChargeOption {
  return {
    id: row.frId,
    fromKm: row.frFromKm ?? null,
    toKm: row.frToKm ?? null,
    freightCharge: toNullableDecimal(row.frFreightChrg),
    fromWeight: toNullableDecimal(row.frFromWeight),
    toWeight: toNullableDecimal(row.frToWeight),
  };
}

function toNullableDecimal(value: unknown): number | null {
  return value === null || value === undefined ? null : toNumber(value as never);
}
