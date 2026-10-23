import { orderColumns } from './price-field-labels';
import type {
  PriceChangeAction,
  PriceChangeScope,
  PriceRowSnapshot,
  PriceTable,
} from './types/price-change-log.types';

/**
 * Notes 144 §5 — the columns a change is NOT judged by: who and when stamped
 * it, the sync mark, and the generated key columns (they follow the bucket,
 * which is compared). A save that touched only these changed no price, writes
 * no log row, and is the no-op the report must not show.
 */
export const IGNORED_COLUMNS: Readonly<Record<PriceTable, readonly string[]>> = {
  IPM: [
    'ipm_created_on',
    'ipm_created_by',
    'ipm_updated_on',
    'ipm_updated_by',
    'ipm_sync_date',
    'ipm_key_mrp',
    'ipm_key_sp',
  ],
  IQP: ['iqp_created_on', 'iqp_created_by', 'iqp_modified_on', 'iqp_modified_by', 'iqp_sync_date'],
};

/** The deleted flag of each table — the flip that makes an update a DELETE or a RESTORE. */
export const DELETED_COLUMN: Readonly<Record<PriceTable, string>> = {
  IPM: 'ipm_is_deleted',
  IQP: 'iqp_is_deleted',
};

/** Two snapshot values the same? jsonb values are scalars here; numbers compare as numbers. */
function same(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * The business columns that differ, in the report's order (orderColumns). A
 * create names every column it set (non-null) but its id; a delete with no row
 * after names every column it had.
 */
export function changedColumns(
  table: PriceTable,
  before: PriceRowSnapshot | null,
  after: PriceRowSnapshot | null,
): string[] {
  const ignored = new Set(IGNORED_COLUMNS[table]);
  const keys = Object.keys(after ?? before ?? {}).filter((key) => !ignored.has(key));
  if (!before) {
    return orderColumns(keys.filter((key) => (after?.[key] ?? null) !== null));
  }
  if (!after) {
    return orderColumns(keys.filter((key) => (before[key] ?? null) !== null));
  }
  for (const key of Object.keys(before)) {
    if (!ignored.has(key) && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return orderColumns(keys.filter((key) => !same(before[key], after[key])));
}

/**
 * What the statement did to the row, read off before / after: no row before is
 * a CREATE, a deleted flag set is a DELETE and one cleared a RESTORE (both are
 * soft — the row stays), anything else an UPDATE. REKEY is never inferred; the
 * re-key states it.
 */
export function actionOf(
  table: PriceTable,
  before: PriceRowSnapshot | null,
  after: PriceRowSnapshot | null,
): Exclude<PriceChangeAction, 'REKEY'> {
  if (!before) {
    return 'CREATE';
  }
  if (!after) {
    return 'DELETE';
  }
  const flag = DELETED_COLUMN[table];
  if (before[flag] !== true && after[flag] === true) {
    return 'DELETE';
  }
  if (before[flag] === true && after[flag] !== true) {
    return 'RESTORE';
  }
  return 'UPDATE';
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;
const amount = (value: unknown): number | null =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value !== ''
      ? Number(value)
      : null;

/**
 * Where the price applies (notes 144 §2): the AFTER row's, else the BEFORE
 * row's for a delete. An IQP row has no godown and no bucket; an IPM row no
 * party and no price level.
 */
export function scopeOf(table: PriceTable, row: PriceRowSnapshot | null): PriceChangeScope {
  const r = row ?? {};
  if (table === 'IPM') {
    return {
      companyId: text(r.ipm_company_id),
      branchId: text(r.ipm_branch_id),
      itemId: text(r.ipm_item_id),
      unitId: text(r.ipm_uc_unit_id),
      godownId: text(r.ipm_godown_id),
      partyId: null,
      priceLevel: null,
      bucketMrp: amount(r.ipm_bucket_mrp),
      bucketSp: amount(r.ipm_bucket_sp),
      effectiveFrom: text(r.ipm_effective_from),
      effectiveTo: text(r.ipm_effective_to),
    };
  }
  return {
    companyId: text(r.iqp_company_id),
    branchId: text(r.iqp_branch_id),
    itemId: text(r.iqp_item_id),
    unitId: text(r.iqp_item_unit_id),
    godownId: null,
    partyId: text(r.iqp_party_id),
    priceLevel: amount(r.iqp_price_level),
    bucketMrp: null,
    bucketSp: null,
    effectiveFrom: text(r.iqp_effective_from),
    effectiveTo: text(r.iqp_effective_to),
  };
}
