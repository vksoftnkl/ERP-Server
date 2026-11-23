import type { ItemCompositePayload } from './types/item-composite-api.types';

/**
 * Item master History step 2 (user 2026-11-21: "history as a revision, easy to
 * track"). Every item save writes ONE audit row (AuditLogService
 * .logDocumentRevision, notes 89) holding the whole item before and after in
 * the shape the Qt revision panel (TxnAuditPanel) compares:
 *
 *   { header: { item fields, with names },
 *     lines:  [ every unit, price, barcode and reorder row, one list ] }
 *
 * A line carries `section` (Unit / Price / Barcode / Reorder), a stable
 * `lineId` (its own row id), a `name` that says which row it is in words, and
 * the figures an operator changes. Ids stay beside the names (compare on the
 * id, show the name), so a master renamed between two saves is not a change.
 *
 * The per-row "Item Master" audit rows (screen 25 and its child screens) are
 * still written as before; this is a second, whole-item view under its own
 * audit screen (170 "Item Revision", migration 20261121140000).
 */
export const ITEM_REVISION_SCREEN_NAME = 'Item Revision';
export const ITEM_REVISION_TABLE = 'item_master';

export interface ItemRevisionSnapshot {
  header: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
}

/** Item keys left out of the header: stamps and read-only extras, not edits. */
const HEADER_SKIP = new Set([
  'item_created_on',
  'item_created_by',
  'item_modified_on',
  'item_modified_by',
  'item_is_deleted',
  'item_units_in_use',
  'item_photo',
  'item_image_url',
]);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const yesNo = (v: unknown): string => (v === true || v === 'true' ? 'Yes' : 'No');

/** "PCS · Coimbatore · Main · MRP 150": which row it is, in words. */
const joinName = (...parts: Array<string | null>): string =>
  parts.filter((p): p is string => !!p).join(' · ');

export function itemRevisionSnapshot(composite: ItemCompositePayload): ItemRevisionSnapshot {
  const header: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(composite.item as unknown as Record<string, unknown>)) {
    // A tick box reads Yes / No in History, not true / false.
    if (!HEADER_SKIP.has(key)) header[key] = typeof value === 'boolean' ? yesNo(value) : value;
  }

  const lines: Array<Record<string, unknown>> = [];
  const push = (line: Record<string, unknown>) => lines.push({ lineNo: lines.length + 1, ...line });

  const units = [...(composite.unit_conversions ?? [])].sort(
    (a, b) => (num(a.iuc_unit_slno) ?? 0) - (num(b.iuc_unit_slno) ?? 0),
  );
  for (const u of units) {
    const row = u as unknown as Record<string, unknown>;
    push({
      lineId: u.iuc_id,
      section: 'Unit',
      name: joinName(text(row.iuc_unit_name) ?? text(u.iuc_unit_id), u.iuc_is_base_unit ? '(stock unit)' : null),
      unitId: u.iuc_unit_id,
      conv: num(u.iuc_unit_factor),
      toBase: num(u.iuc_to_base_factor),
      weight: num(u.iuc_uom_weight),
      isDefault: yesNo(u.iuc_is_default_unit),
      remarks: text(u.iuc_uom_remarks),
    });
  }

  const prices = [...(composite.prices ?? [])].sort(
    (a, b) => (num(a.ipm_sl_no) ?? 0) - (num(b.ipm_sl_no) ?? 0),
  );
  for (const p of prices) {
    const row = p as unknown as Record<string, unknown>;
    const mrpBucket = num(row.ipm_bucket_mrp);
    push({
      lineId: p.ipm_id,
      section: 'Price',
      name: joinName(
        text(row.ipm_unit_name),
        text(row.ipm_branch_name),
        text(row.ipm_godown_name),
        mrpBucket ? `MRP ${mrpBucket}` : null,
      ),
      unitId: p.ipm_uc_unit_id,
      profitType: text(p.ipm_profit_type),
      roundOff: num(p.ipm_round_off),
      cost: num(p.ipm_cost_price),
      priceA: num(p.ipm_sales_price_a),
      priceB: num(p.ipm_sales_price_b),
      priceC: num(p.ipm_sales_price_c),
      priceD: num(p.ipm_sales_price_d),
      profitA: num(p.ipm_price_a_markup_perc),
      profitB: num(p.ipm_price_b_markup_perc),
      mrp: num(p.ipm_max_price),
      minPrice: num(p.ipm_min_price),
      discPerc: num(p.ipm_disc_perc),
      isActive: yesNo(p.ipm_is_active),
    });
  }

  for (const e of composite.ean_codes ?? []) {
    const row = e as unknown as Record<string, unknown>;
    push({
      lineId: e.ean_id,
      section: 'Barcode',
      name: joinName(text(row.ean_unit_name) ?? text(e.ean_unit_id), e.ean_is_default ? '(default)' : null),
      unitId: e.ean_unit_id,
      barcode: text(e.ean_code),
      isActive: yesNo(e.ean_is_active),
    });
  }

  for (const r of composite.reorders ?? []) {
    const row = r as unknown as Record<string, unknown>;
    push({
      lineId: r.ir_id,
      section: 'Reorder',
      name: joinName(text(row.ir_unit_name) ?? 'any unit', text(row.ir_branch_name), text(row.ir_godown_name)),
      unitId: r.ir_unit_id,
      minLevel: num(r.ir_min_level),
      maxLevel: num(r.ir_max_level),
      reorderLevel: num(r.ir_reorder_level),
      reorderQty: num(r.ir_reorder_qty),
      isActive: yesNo(r.ir_is_active),
    });
  }

  return { header, lines };
}

/** JSON with object keys sorted, so two reads of one item compare equal whatever their key order. */
const stableJson = (v: unknown): string =>
  JSON.stringify(v, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)))
      : value,
  );

/** True when two snapshots say the same thing (a save that changed nothing writes no revision). */
export function sameRevision(a: ItemRevisionSnapshot | null, b: ItemRevisionSnapshot): boolean {
  if (a === null) return false;
  return stableJson(a) === stableJson(b);
}
