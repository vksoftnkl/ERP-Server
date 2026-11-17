"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withUndeliveredOnSheet = withUndeliveredOnSheet;
exports.withUndeliveredOnDocument = withUndeliveredOnDocument;
exports.withUndeliveredOnValidate = withUndeliveredOnValidate;
const client_1 = require("@prisma/client");
const error_wording_1 = require("../../../common/error-wording/error-wording");
const delivery_constants_1 = require("../../sales/delivery/core/delivery.constants");
const count_undelivered_helper_1 = require("../stock-voucher/count-undelivered.helper");
async function withUndeliveredOnSheet(client, scope, page) {
    const itemIds = page.items.map((r) => r.itemId);
    const [bnd, units] = await Promise.all([
        (0, count_undelivered_helper_1.readHoldingUndelivered)(client, {
            companyId: scope.companyId,
            branchId: scope.branchId,
            godownIds: [scope.godownId],
            itemIds,
            withBills: true,
        }),
        (0, count_undelivered_helper_1.readSellUnits)(client, itemIds),
    ]);
    return {
        ...page,
        items: page.items.map((r) => {
            const h = bnd.get((0, count_undelivered_helper_1.undeliveredKey)(r.godownId, r.itemId, r.lotId, r.bucket));
            const undeliveredQty = h ? Number(h.bndBase) : 0;
            const unit = units.get(r.itemId);
            return {
                ...r,
                undeliveredQty,
                physicalQty: Number(new client_1.Prisma.Decimal(r.bookQty ?? 0).plus(h?.bndBase ?? 0)),
                undeliveredBills: h?.bills ?? [],
                sellUnitName: unit?.name ?? r.unitName,
                sellUnitFactor: unit?.factor ?? 1,
            };
        }),
    };
}
async function withUndeliveredOnDocument(client, doc) {
    const lines = doc.lines;
    const itemIds = lines.map((l) => l.itemId);
    const draft = doc.header.status === 'DRAFT';
    const [bnd, units] = await Promise.all([
        draft
            ? (0, count_undelivered_helper_1.readHoldingUndelivered)(client, {
                companyId: doc.header.companyId,
                branchId: doc.header.branchId,
                godownIds: lines.map((l) => l.godownId),
                itemIds,
                withBills: true,
            })
            : Promise.resolve(null),
        (0, count_undelivered_helper_1.readSellUnits)(client, itemIds),
    ]);
    return {
        ...doc,
        lines: lines.map((l) => {
            const unit = units.get(l.itemId);
            const h = bnd?.get((0, count_undelivered_helper_1.undeliveredKey)(l.godownId, l.itemId, l.lotId, l.bucket));
            return {
                ...l,
                undeliveredBills: h?.bills ?? [],
                sellUnitName: unit?.name ?? l.unitName,
                sellUnitFactor: unit?.factor ?? 1,
            };
        }),
    };
}
async function withUndeliveredOnValidate(client, scope, rows) {
    const stored = await client.$queryRaw `
    SELECT svi.svi_id, svi.svi_line_no, svi.svi_godown_id, svi.svi_item_id, svi.svi_lot_id,
           svi.svi_bucket, svi.svi_undelivered_qty, itm.item_name_en AS item_name
      FROM stock.stock_voucher_item svi
      JOIN inventory.item_master itm ON itm.item_id = svi.svi_item_id
     WHERE svi.svi_voucher_id = ${scope.svhId}::uuid
       AND svi.svi_acc_year = ${scope.accYear}::bpchar
       AND svi.svi_is_deleted = false`;
    const live = await (0, count_undelivered_helper_1.readHoldingUndelivered)(client, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        godownIds: stored.map((s) => s.svi_godown_id),
        itemIds: stored.map((s) => s.svi_item_id),
    });
    const byId = new Map(stored.map((s) => [s.svi_id, s]));
    return rows.map((r) => {
        const s = byId.get(r.sviId);
        if (!s) {
            return r;
        }
        const before = new client_1.Prisma.Decimal(s.svi_undelivered_qty ?? 0);
        const now = (live.get((0, count_undelivered_helper_1.undeliveredKey)(s.svi_godown_id, s.svi_item_id, s.svi_lot_id, s.svi_bucket))?.bndBase ??
            new client_1.Prisma.Decimal(0)).toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const changed = !before.equals(now);
        const item = s.item_name ?? r.itemName;
        const params = { n: r.lineNo, item, old: Number(before), new: Number(now) };
        const message = `Line ${r.lineNo}: ${item} had ${Number(before)} billed not delivered when the sheet was ` +
            `drawn; now ${Number(now)}. Check the count before posting.`;
        return {
            ...r,
            undeliveredQty: Number(now),
            previousUndeliveredQty: Number(before),
            undeliveredChanged: changed,
            warning: changed
                ? {
                    code: delivery_constants_1.DELIVERY_ERROR_CODES.PHY_UNDELIVERED_CHANGED,
                    level: 'WARN',
                    message,
                    params,
                    user: (0, error_wording_1.wordingFor)({ code: delivery_constants_1.DELIVERY_ERROR_CODES.PHY_UNDELIVERED_CHANGED, params }),
                }
                : null,
        };
    });
}
//# sourceMappingURL=physical-stock-delivery.js.map