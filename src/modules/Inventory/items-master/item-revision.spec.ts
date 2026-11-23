import { itemRevisionSnapshot, sameRevision } from './item-revision';
import type { ItemCompositePayload } from './types/item-composite-api.types';

// History step 2 (user 2026-11-21): one whole-item snapshot per save.
const composite = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    item: {
      item_id: 'item-1',
      item_name_en: 'Biscuit',
      item_group_id: 'g-1',
      item_group_name: 'Snacks',
      item_modified_on: '2026-11-21T10:00:00Z',
      item_units_in_use: true,
      ...over,
    },
    unit_conversions: [
      { iuc_id: 'u-2', iuc_unit_id: 'pcs', iuc_unit_name: 'PCS', iuc_unit_slno: 2, iuc_unit_factor: 10,
        iuc_to_base_factor: 1, iuc_is_base_unit: true, iuc_is_default_unit: true, iuc_uom_weight: 0.1 },
      { iuc_id: 'u-1', iuc_unit_id: 'box', iuc_unit_name: 'BOX', iuc_unit_slno: 1, iuc_unit_factor: 1,
        iuc_to_base_factor: 10, iuc_is_base_unit: false, iuc_is_default_unit: false, iuc_uom_weight: 1 },
    ],
    prices: [
      { ipm_id: 'p-1', ipm_uc_unit_id: 'pcs', ipm_unit_name: 'PCS', ipm_branch_name: 'Coimbatore', ipm_sl_no: 1,
        ipm_cost_price: '30.000000', ipm_sales_price_a: 35, ipm_bucket_mrp: 150, ipm_profit_type: 'By %', ipm_is_active: true },
    ],
    scheduled_prices: [],
    ean_codes: [{ ean_id: 'e-1', ean_unit_id: 'pcs', ean_unit_name: 'PCS', ean_code: '8901', ean_is_default: true, ean_is_active: true }],
    reorders: [{ ir_id: 'r-1', ir_unit_id: null, ir_min_level: 5, ir_max_level: 20, ir_reorder_level: 8, ir_reorder_qty: 12, ir_is_active: true }],
  }) as unknown as ItemCompositePayload;

describe('itemRevisionSnapshot', () => {
  it('keeps the item fields with their names, without stamps', () => {
    const { header } = itemRevisionSnapshot(composite());
    expect(header).toMatchObject({ item_id: 'item-1', item_name_en: 'Biscuit', item_group_name: 'Snacks' });
    expect(header).not.toHaveProperty('item_modified_on');
    expect(header).not.toHaveProperty('item_units_in_use');
  });

  it('lists every unit (in grid order), price, barcode and reorder row as one set of lines', () => {
    const { lines } = itemRevisionSnapshot(composite());
    expect(lines.map((l) => [l.lineNo, l.section, l.lineId, l.name])).toEqual([
      [1, 'Unit', 'u-1', 'BOX'],
      [2, 'Unit', 'u-2', 'PCS · (stock unit)'],
      [3, 'Price', 'p-1', 'PCS · Coimbatore · MRP 150'],
      [4, 'Barcode', 'e-1', 'PCS · (default)'],
      [5, 'Reorder', 'r-1', 'any unit'],
    ]);
    expect(lines[2]).toMatchObject({ cost: 30, priceA: 35, profitType: 'By %' });
    expect(lines[1]).toMatchObject({ conv: 10, toBase: 1, weight: 0.1, isDefault: 'Yes' });
  });
});

describe('sameRevision', () => {
  it('is true for the same item read twice, whatever the key order', () => {
    const a = itemRevisionSnapshot(composite());
    const reordered = itemRevisionSnapshot(composite());
    reordered.header = Object.fromEntries(Object.entries(reordered.header).reverse());
    expect(sameRevision(a, reordered)).toBe(true);
  });

  it('is false when anything changed, and on a create (no before)', () => {
    const a = itemRevisionSnapshot(composite());
    expect(sameRevision(a, itemRevisionSnapshot(composite({ item_name_en: 'Biscuits' })))).toBe(false);
    expect(sameRevision(null, a)).toBe(false);
  });
});
