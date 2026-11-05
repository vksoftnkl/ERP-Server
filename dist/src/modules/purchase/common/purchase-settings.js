"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPurchaseSettings = loadPurchaseSettings;
const pick = (v, allowed, dflt) => allowed.includes((v ?? '').toUpperCase()) ? (v ?? '').toUpperCase() : dflt;
const bool = (v, dflt) => v === undefined ? dflt : ['true', '1', 'yes', 'y', 'on'].includes(v.trim().toLowerCase());
const num = (v, dflt) => (v === undefined || v.trim() === '' || Number.isNaN(Number(v)) ? dflt : Number(v));
async function loadPurchaseSettings(tx, companyId, branchId) {
    const rows = await tx.$queryRaw `
    SELECT out_asd_key AS key, out_effective_value AS value
      FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid, NULL::uuid, NULL::uuid)
     WHERE out_asd_key LIKE 'purchase.%'`;
    const s = new Map(rows.map((r) => [r.key, r.value ?? undefined]));
    const g = (k) => s.get(`purchase.${k}`);
    return {
        defaultEntry: pick(g('default_entry'), ['DIRECT', 'GRN'], 'DIRECT'),
        invAmountCheck: pick(g('inv_amount_check'), ['REFUSE', 'WARN'], 'REFUSE'),
        duplicateBillMode: pick(g('duplicate_bill_mode'), ['REFUSE', 'WARN'], 'REFUSE'),
        labelsAfterPost: pick(g('labels_after_post'), ['ASK', 'ALWAYS', 'NEVER'], 'ASK'),
        allowPriceUpdate: bool(g('allow_price_update'), false),
        priceUpdate: pick(g('price_update'), ['UPDATE_PRICES', 'COST_ONLY', 'OPEN_CHANGE_SELLING', 'NONE'], 'UPDATE_PRICES'),
        priceSetAt: pick(g('price_set_at'), ['INVOICE', 'GRN'], 'INVOICE'),
        rateTolerancePct: num(g('rate_tolerance_pct'), 2),
        shelfLifeMode: pick(g('shelf_life_mode'), ['OFF', 'WARN', 'REFUSE'], 'WARN'),
        minShelfLifePct: num(g('min_shelf_life_pct'), 60),
        closePoOnFirstBill: bool(g('close_po_on_first_bill'), false),
        poApprovalAbove: num(g('po_approval_above'), 0),
        returnSettlementDefault: pick(g('return_settlement_default'), ['ADJUST', 'ADVANCE', 'CASH'], 'ADJUST'),
    };
}
//# sourceMappingURL=purchase-settings.js.map