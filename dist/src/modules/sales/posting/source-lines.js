"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BILL_SOURCE_KEYS = exports.DC_SOURCE_KEYS = void 0;
exports.resolveSourceLines = resolveSourceLines;
exports.DC_SOURCE_KEYS = {
    type: 'sdiSrcDocType',
    docId: 'sdiSrcDocId',
    accYear: 'sdiSrcDocAccYear',
    lineNo: 'sdiSrcLineNo',
    itemId: 'sdiSrcItemId',
};
exports.BILL_SOURCE_KEYS = {
    type: 'sbiSrcDocType',
    docId: 'sbiSrcDocId',
    accYear: 'sbiSrcDocYear',
    lineNo: 'sbiSrcDocLineNo',
    itemId: 'sbiSrcItemId',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOf = (v) => (typeof v === 'string' && UUID.test(v) ? v : null);
const lineNoOf = (v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return typeof n === 'number' && Number.isInteger(n) ? n : null;
};
async function sourceLinesOf(tx, kind, ids) {
    if (ids.length === 0) {
        return [];
    }
    const rows = kind === 'SALES_ORDER'
        ? await tx.$queryRaw `
          SELECT soi_id AS id, soi_order_id AS doc_id, soi_line_no AS line_no, soi_acc_year AS acc_year
            FROM sales.sale_order_item
           WHERE (soi_id = ANY(${ids}::uuid[]) OR soi_order_id = ANY(${ids}::uuid[]))
             AND soi_is_deleted = false`
        : await tx.$queryRaw `
          SELECT sdi_id AS id, sdi_dc_id AS doc_id, sdi_line_no AS line_no, sdi_acc_year AS acc_year
            FROM sales.sale_dc_item
           WHERE (sdi_id = ANY(${ids}::uuid[]) OR sdi_dc_id = ANY(${ids}::uuid[]))
             AND sdi_is_deleted = false`;
    return (rows ?? []).filter((r) => typeof r?.id === 'string' && typeof r.doc_id === 'string');
}
async function resolveSourceLines(tx, lines, keys, kinds) {
    const unresolved = [];
    const changed = [];
    const list = lines ?? [];
    for (const kind of kinds) {
        const mine = list
            .map((l, idx) => ({ l, idx }))
            .filter(({ l }) => l[keys.type] === kind);
        if (mine.length === 0) {
            continue;
        }
        const ids = [
            ...new Set(mine.flatMap(({ l }) => [uuidOf(l[keys.itemId]), uuidOf(l[keys.docId])]).filter((v) => !!v)),
        ];
        const found = await sourceLinesOf(tx, kind, ids);
        const byId = new Map(found.map((r) => [r.id, r]));
        const byDocLine = new Map();
        for (const r of found) {
            const k = `${r.doc_id}|${r.line_no}`;
            byDocLine.set(k, byDocLine.has(k) ? null : r);
        }
        for (const { l, idx } of mine) {
            const itemId = uuidOf(l[keys.itemId]);
            const docId = uuidOf(l[keys.docId]);
            const lineNo = lineNoOf(l[keys.lineNo]);
            const r = (itemId ? byId.get(itemId) : undefined) ??
                (docId ? byId.get(docId) : undefined) ??
                (docId !== null && lineNo !== null ? byDocLine.get(`${docId}|${lineNo}`) ?? undefined : undefined);
            if (!r) {
                if (itemId || docId) {
                    unresolved.push(idx);
                }
                continue;
            }
            const year = (r.acc_year ?? '').trim() || l[keys.accYear] || null;
            if (l[keys.itemId] !== r.id ||
                l[keys.docId] !== r.doc_id ||
                lineNoOf(l[keys.lineNo]) !== r.line_no ||
                l[keys.accYear] !== year) {
                changed.push(idx);
            }
            l[keys.itemId] = r.id;
            l[keys.docId] = r.doc_id;
            l[keys.lineNo] = r.line_no;
            l[keys.accYear] = year;
        }
    }
    return { unresolved, changed };
}
//# sourceMappingURL=source-lines.js.map