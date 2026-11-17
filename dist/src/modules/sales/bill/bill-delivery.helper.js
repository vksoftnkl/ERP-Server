"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeliveryMode = isDeliveryMode;
exports.posDeliveryModeRefusal = posDeliveryModeRefusal;
exports.assertPosDeliveryMode = assertPosDeliveryMode;
exports.resolveBillDeliveryMode = resolveBillDeliveryMode;
exports.voucherTypeDeliveryMode = voucherTypeDeliveryMode;
exports.assertAmendKeepsDelivery = assertAmendKeepsDelivery;
exports.assertNothingGiven = assertNothingGiven;
exports.deliveryLineNames = deliveryLineNames;
exports.istDateText = istDateText;
const client_1 = require("@prisma/client");
const sales_errors_1 = require("../posting/sales.errors");
const delivery_constants_1 = require("../delivery/core/delivery.constants");
const SALES_BILL_TYPE_ID = 3;
function isDeliveryMode(v) {
    return typeof v === 'string' && delivery_constants_1.DELIVERY_MODES.includes(v);
}
function posDeliveryModeRefusal(billMode, requestedMode) {
    const requested = isDeliveryMode(requestedMode) ? requestedMode : null;
    if ((billMode ?? '').toUpperCase() !== 'POS' || !requested || requested === 'INSTANT') {
        return null;
    }
    return {
        code: delivery_constants_1.DELIVERY_ERROR_CODES.BILL_DELIVERY_MODE_POS,
        message: `A counter (POS) bill is always INSTANT; ${requested} was asked for`,
        field: 'sbDeliveryMode',
    };
}
function assertPosDeliveryMode(billMode, requestedMode) {
    const refusal = posDeliveryModeRefusal(billMode, requestedMode);
    if (refusal) {
        (0, sales_errors_1.throwSalesRefused)(refusal.message, refusal.code, refusal.field ?? 'sbDeliveryMode');
    }
}
async function resolveBillDeliveryMode(tx, input) {
    const requested = isDeliveryMode(input.requested) ? input.requested : null;
    if ((input.billMode ?? '').toUpperCase() === 'POS') {
        assertPosDeliveryMode(input.billMode, input.requested);
        return 'INSTANT';
    }
    if (requested) {
        return requested;
    }
    const typeMode = await voucherTypeDeliveryMode(tx, input.vchrTypeId ?? SALES_BILL_TYPE_ID);
    if (typeMode === 'INSTANT') {
        return 'INSTANT';
    }
    const orderId = input.srcDocType === 'SALES_ORDER' && input.srcDocId
        ? input.srcDocId
        : ((input.items ?? []).find((i) => i.sbiSrcDocType === 'SALES_ORDER' && i.sbiSrcDocId)
            ?.sbiSrcDocId ?? null);
    if (orderId) {
        const [order] = await tx.$queryRaw `
      SELECT so_delivery_mode FROM sales.sale_order WHERE so_id = ${orderId}::uuid LIMIT 1`;
        const om = (order?.so_delivery_mode ?? '').trim().toUpperCase();
        if (om) {
            return om === 'STORE_PICKUP' ? 'PICKUP' : 'DISPATCH';
        }
    }
    return typeMode;
}
async function voucherTypeDeliveryMode(client, vchrTypeId) {
    const [row] = await client.$queryRaw `
    SELECT t.vchr_delivery_mode AS own, p.vchr_delivery_mode AS base
      FROM accounts.acc_voucher_types t
      LEFT JOIN accounts.acc_voucher_types p ON p.vchr_type_id = t.vchr_parent_id
     WHERE t.vchr_type_id = ${vchrTypeId}::int`;
    const mode = row?.own ?? row?.base ?? null;
    return isDeliveryMode(mode) ? mode : 'INSTANT';
}
function assertAmendKeepsDelivery(bill, requestedMode, lines, newItems, names) {
    if (isDeliveryMode(requestedMode) && requestedMode !== bill.sbDeliveryMode) {
        (0, sales_errors_1.throwSalesLocked)(`The delivery mode of a posted bill changes only on Pending Deliveries (Pickup ↔ Dispatch); ${bill.sbDeliveryMode} → ${requestedMode} was asked for`, delivery_constants_1.DELIVERY_ERROR_CODES.BILL_DELIVERY_MODE_LOCKED, 'sbDeliveryMode');
    }
    const byId = new Map(newItems.filter((i) => i.sbiId).map((i) => [i.sbiId, i]));
    for (const l of lines) {
        if (l.settledQty.isZero() && l.givenQty.isZero()) {
            continue;
        }
        const n = names.get(l.billItemId) ?? { itemName: l.itemId, unitName: '' };
        const params = {
            n: l.lineNo,
            item: n.itemName,
            given: l.settledQty.toString(),
            unit: n.unitName,
        };
        const next = byId.get(l.billItemId);
        const fail = (why) => (0, sales_errors_1.throwSalesLocked)(`Line ${l.lineNo} (${n.itemName}): ${l.settledQty.toString()} ${n.unitName} already given or returned — ${why}`, delivery_constants_1.DELIVERY_ERROR_CODES.BILL_DELIVERED_AMEND, `items[${l.lineNo}]`, { line: l.lineNo, params });
        if (!next) {
            fail('the line cannot be dropped');
        }
        const same = (a, b) => (a ?? null) === (b ?? null);
        if ((next.sbiItemId !== undefined && !same(next.sbiItemId, l.itemId)) ||
            (next.sbiItemUnitId !== undefined && !same(next.sbiItemUnitId, l.unitId)) ||
            (next.sbiGodownId !== undefined && !same(next.sbiGodownId, l.godownId)) ||
            (next.sbiLotId !== undefined && !same(next.sbiLotId, l.lotId)) ||
            (next.sbiBucket !== undefined && !same(next.sbiBucket ?? 'SALEABLE', l.bucket))) {
            fail('its item, unit, godown, lot and bucket must stay');
        }
        const qty = next.sbiBillQty === undefined || next.sbiBillQty === null
            ? l.billedQty
            : new client_1.Prisma.Decimal(String(next.sbiBillQty));
        if (qty.lessThan(l.settledQty)) {
            fail(`the qty cannot go below ${l.settledQty.toString()}`);
        }
    }
}
function assertNothingGiven(bill, lines, lastNote) {
    const given = lines.find((l) => !l.givenQty.isZero());
    if (given) {
        (0, sales_errors_1.throwSalesLocked)(`${bill.sbBillRefno ?? 'This bill'}: goods left the godown${lastNote?.refno ? ` on ${lastNote.refno}` : ''}; a bill with given goods cannot be cancelled — make a sale return instead`, delivery_constants_1.DELIVERY_ERROR_CODES.BILL_DELIVERED_CANCEL, 'sbId', {
            params: {
                bill: bill.sbBillRefno ?? '',
                dn: lastNote?.refno ?? '',
                date: lastNote?.date ?? '',
            },
        });
    }
}
async function deliveryLineNames(tx, billItemIds) {
    const out = new Map();
    if (billItemIds.length === 0) {
        return out;
    }
    const rows = await tx.$queryRaw `
    SELECT i.sbi_id, im.item_name_en AS item_name, um.unit_name
      FROM sales.sale_bill_item i
      JOIN inventory.item_master im ON im.item_id = i.sbi_item_id
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     WHERE i.sbi_id = ANY(${[...billItemIds]}::uuid[])`;
    for (const r of rows) {
        out.set(r.sbi_id, { itemName: r.item_name ?? '', unitName: r.unit_name ?? '' });
    }
    return out;
}
function istDateText(at) {
    if (!at) {
        return '';
    }
    const ist = new Date(at.getTime() + 330 * 60_000);
    const dd = String(ist.getUTCDate()).padStart(2, '0');
    const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${ist.getUTCFullYear()}`;
}
//# sourceMappingURL=bill-delivery.helper.js.map