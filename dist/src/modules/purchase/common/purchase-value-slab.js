"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valuePerPiece = valuePerPiece;
exports.pickSlab = pickSlab;
exports.applyValueSlabs = applyValueSlabs;
const purchase_doc_helpers_1 = require("./purchase-doc.helpers");
function valuePerPiece(l, toBaseFactor) {
    const f = (0, purchase_doc_helpers_1.D)(toBaseFactor);
    const perUnit = (0, purchase_doc_helpers_1.D)(l.rate).times((0, purchase_doc_helpers_1.D)(1).minus((0, purchase_doc_helpers_1.D)(l.discPct ?? 0).div(100))).minus((0, purchase_doc_helpers_1.D)(l.discPerQty ?? 0))
        .times((0, purchase_doc_helpers_1.D)(1).minus((0, purchase_doc_helpers_1.D)(l.schPct ?? 0).div(100))).minus((0, purchase_doc_helpers_1.D)(l.schPerQty ?? 0));
    return f.isZero() ? perUnit : perUnit.div(f);
}
function pickSlab(baseTaxId, perPiece, threshold, aboveTaxId) {
    if (threshold == null || !aboveTaxId)
        return baseTaxId;
    return perPiece.greaterThan((0, purchase_doc_helpers_1.D)(threshold)) ? aboveTaxId : baseTaxId;
}
let columnsReady = null;
async function applyValueSlabs(tx, lines, factorOf) {
    if (columnsReady === null) {
        const [c] = await tx.$queryRaw `
      SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = 'inventory' AND table_name = 'tax_rate_master' AND column_name IN ('tax_value_threshold', 'tax_above_tax_id')`;
        columnsReady = Number(c?.n ?? 0) === 2;
    }
    if (!columnsReady)
        return;
    const ids = [...new Set(lines.map((l) => l.taxId).filter((t) => !!t))];
    if (!ids.length)
        return;
    const slabs = await tx.$queryRawUnsafe(`SELECT tax_id, tax_value_threshold, tax_above_tax_id FROM inventory.tax_rate_master
      WHERE tax_id = ANY($1::uuid[]) AND tax_value_threshold IS NOT NULL AND tax_above_tax_id IS NOT NULL`, ids);
    if (!slabs.length)
        return;
    const by = new Map(slabs.map((s) => [s.tax_id, s]));
    for (const l of lines) {
        const s = l.taxId ? by.get(l.taxId) : undefined;
        if (!s)
            continue;
        l.taxId = pickSlab(l.taxId, valuePerPiece(l, factorOf(l.uomId) ?? 1), s.tax_value_threshold, s.tax_above_tax_id);
    }
}
//# sourceMappingURL=purchase-value-slab.js.map