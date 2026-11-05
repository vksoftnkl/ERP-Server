"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPurchaseChargeMasters = loadPurchaseChargeMasters;
exports.purchaseChargeInput = purchaseChargeInput;
async function loadPurchaseChargeMasters(db, ids) {
    const uniq = [...new Set(ids)];
    const rows = uniq.length
        ? await db.$queryRaw `
        SELECT c.chg_id, c.chg_name, c.chg_type, c.chg_method, c.chg_default_rate, c.chg_cost_alloc, c.chg_before_tax,
               c.chg_tax_apl, c.chg_landing_cost, c.chg_on_bill, c.chg_ledger_code, c.chg_role, c.chg_tax_id, t.tax_rate_perc
          FROM public.charge_master c LEFT JOIN inventory.tax_rate_master t ON t.tax_id = c.chg_tax_id
         WHERE c.chg_id = ANY(${uniq}::uuid[]) AND c.chg_is_deleted = false AND c.chg_module IN ('P','B')`
        : [];
    return new Map(rows.map((r) => [r.chg_id, r]));
}
function purchaseChargeInput(m, keyed, key) {
    return {
        key, type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD',
        method: m.chg_method ?? 'FIXED',
        rate: keyed.rate ?? m.chg_default_rate ?? 0, amount: keyed.amount ?? null,
        alloc: (m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE'),
        beforeTax: m.chg_on_bill ? m.chg_before_tax : false,
        onBill: m.chg_on_bill,
        landingCost: m.chg_on_bill ? m.chg_landing_cost : true,
        taxPct: m.chg_on_bill && m.chg_tax_apl && !m.chg_before_tax ? (m.tax_rate_perc ?? 0) : 0,
        payees: m.chg_on_bill ? [] : (keyed.payees ?? []).map((p) => ({ partyId: p.partyId, amount: p.amount ?? null })),
    };
}
//# sourceMappingURL=purchase-charges.js.map