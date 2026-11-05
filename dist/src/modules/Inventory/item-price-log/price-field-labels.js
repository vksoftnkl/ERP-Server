"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICE_FIELD_LABELS = void 0;
exports.labelOf = labelOf;
exports.orderColumns = orderColumns;
exports.PRICE_FIELD_LABELS = {
    ipm_company_id: 'Company',
    ipm_branch_id: 'Branch',
    ipm_item_id: 'Item',
    ipm_uc_unit_id: 'Unit',
    ipm_godown_id: 'Godown',
    ipm_sales_price_a: 'Price A',
    ipm_price_a_wot: 'Price A (w/o tax)',
    ipm_price_a_markup_perc: 'Markup A %',
    ipm_sales_price_b: 'Price B',
    ipm_price_b_wot: 'Price B (w/o tax)',
    ipm_price_b_markup_perc: 'Markup B %',
    ipm_sales_price_c: 'Price C',
    ipm_price_c_wot: 'Price C (w/o tax)',
    ipm_price_c_markup_perc: 'Markup C %',
    ipm_sales_price_d: 'Price D',
    ipm_price_d_wot: 'Price D (w/o tax)',
    ipm_price_d_markup_perc: 'Markup D %',
    ipm_max_price: 'MRP',
    ipm_min_price: 'Min price',
    ipm_cost_price: 'Cost',
    ipm_cost_wot: 'Cost (w/o tax)',
    ipm_disc_perc: 'Disc %',
    ipm_disc_qty: 'Disc qty',
    ipm_addl_cess: 'Addl cess',
    ipm_profit_type: 'Profit type',
    ipm_round_off: 'Round off',
    ipm_loading_charge: 'Loading charge',
    ipm_freight_charge: 'Freight charge',
    ipm_loyalty_points: 'Loyalty points',
    ipm_uom_remarks: 'Unit remarks',
    ipm_cost_remarks: 'Cost remarks',
    ipm_is_active: 'Active',
    ipm_is_deleted: 'Deleted',
    ipm_sl_no: 'Sl no',
    ipm_bucket_mrp: 'MRP bucket',
    ipm_bucket_sp: 'Sale price bucket',
    ipm_effective_from: 'From date',
    ipm_effective_to: 'To date',
    iqp_company_id: 'Company',
    iqp_branch_id: 'Branch',
    iqp_item_id: 'Item',
    iqp_item_unit_id: 'Unit',
    iqp_party_id: 'Party',
    iqp_price_level: 'Price level',
    iqp_from_qty: 'From qty',
    iqp_to_qty: 'To qty',
    iqp_price_mode: 'Price mode',
    iqp_disc_pct: 'Disc %',
    iqp_flat_off: 'Flat off',
    iqp_price: 'Slab price',
    iqp_is_tax_incl: 'Tax incl.',
    iqp_effective_from: 'From date',
    iqp_effective_to: 'To date',
    iqp_is_active: 'Active',
    iqp_is_deleted: 'Deleted',
};
function labelOf(column) {
    return exports.PRICE_FIELD_LABELS[column] ?? column;
}
const ROW_ID_COLUMNS = new Set(['ipm_id', 'iqp_id']);
const FIELD_ORDER = new Map(Object.keys(exports.PRICE_FIELD_LABELS).map((column, index) => [column, index]));
function orderColumns(columns) {
    const rank = (column) => FIELD_ORDER.get(column) ?? Number.MAX_SAFE_INTEGER;
    return columns
        .filter((column) => !ROW_ID_COLUMNS.has(column))
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
//# sourceMappingURL=price-field-labels.js.map