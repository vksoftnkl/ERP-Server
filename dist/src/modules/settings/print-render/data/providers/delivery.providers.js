"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_PRINT_PROVIDERS = exports.PendingListRowsProvider = exports.PendingListHeadProvider = exports.PickListLinesProvider = exports.PickListHeadProvider = exports.BillDeliveryProvider = exports.GodownSlipLinesProvider = exports.GodownSlipHeadProvider = exports.GatePassStillProvider = exports.GatePassLinesProvider = exports.GatePassHeadProvider = exports.DeliveryPrintSource = void 0;
exports.gatePassHeadRow = gatePassHeadRow;
exports.gatePassLineRows = gatePassLineRows;
exports.stillToComeRows = stillToComeRows;
exports.godownSlipHeadRow = godownSlipHeadRow;
exports.godownSlipLineRows = godownSlipLineRows;
exports.billDeliveryRow = billDeliveryRow;
exports.pickListRows = pickListRows;
exports.pickListHeadRow = pickListHeadRow;
exports.pendingRows = pendingRows;
exports.pendingHeadRow = pendingHeadRow;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../../database/prisma/prisma.service");
const rights_1 = require("../../../../../common/posting/rights");
const sales_context_service_1 = require("../../../../sales/posting/sales-context.service");
const delivery_constants_1 = require("../../../../sales/delivery/core/delivery.constants");
const delivery_pending_service_1 = require("../../../../sales/delivery/core/delivery-pending.service");
const delivery_pending_sql_1 = require("../../../../sales/delivery/core/delivery-pending.sql");
const delivery_qr_1 = require("../../../../sales/delivery/core/delivery-qr");
const delivery_weight_1 = require("../../../../sales/delivery/core/delivery-weight");
const delivery_note_read_service_1 = require("../../../../sales/delivery/delivery-note-read.service");
const provider_utils_1 = require("./provider.utils");
const print_text_utils_1 = require("./print-text.utils");
const Z = new client_1.Prisma.Decimal(0);
const NOTE_MODE_TEXT = {
    SELF: 'Self pickup',
    VEHICLE: 'Our vehicle',
    TRANSPORTER: 'Transporter',
};
const BILL_MODE_TEXT = {
    INSTANT: 'Instant',
    PICKUP: 'Pickup',
    DISPATCH: 'Dispatch',
};
function gatePassHeadRow(p, stillCount, f) {
    const n = p.note;
    const given = p.lines.filter((l) => (0, print_text_utils_1.decOf)(l.qty).greaterThan(0));
    const qty = given.reduce((a, l) => a.plus((0, print_text_utils_1.decOf)(l.qty)), Z);
    const kg = given.reduce((a, l) => a.plus((0, print_text_utils_1.decOf)(l.weightKg)), Z);
    const bags = given
        .filter((l) => /^bag/i.test(l.unitName.trim()))
        .reduce((a, l) => a.plus((0, print_text_utils_1.decOf)(l.qty)), Z);
    const back = (0, print_text_utils_1.decOf)(n.goodsBackPkgs);
    const bills = new Set(given.map((l) => l.billId)).size;
    const info = [];
    if (n.sdnMode === 'SELF') {
        const who = [n.sdnCollectedBy, n.sdnCollectorPhone].filter(Boolean).join('  ');
        info.push(['Collected by', who || '-']);
    }
    if (n.sdnVehicleNo || n.driverName) {
        info.push(['Vehicle', `${n.sdnVehicleNo ?? '-'}${n.driverName ? `   Driver: ${n.driverName}` : ''}`]);
    }
    if (n.transport.transporterName || n.transport.lrNo) {
        const lrDate = n.transport.lrDate ? (0, print_text_utils_1.dmyText)(n.transport.lrDate) : '';
        info.push([
            'Transporter',
            `${n.transport.transporterName ?? '-'}` +
                (n.transport.lrNo ? `   LR ${n.transport.lrNo}${lrDate ? ` dt ${lrDate}` : ''}` : ''),
        ]);
    }
    const crew = n.loadmanNames.filter(Boolean);
    if (crew.length > 0 || n.supervisorName) {
        info.push([
            'Loadmen',
            `${crew.length > 0 ? crew.join(', ') : '-'}` +
                (n.supervisorName ? `   Supervisor: ${n.supervisorName}` : ''),
        ]);
    }
    const posted = n.sdnStatus !== 'DRAFT';
    const statusMark = n.sdnStatus === 'DRAFT'
        ? 'DRAFT - NOT A GATE PASS'
        : n.sdnStatus === 'CANCELLED'
            ? 'CANCELLED'
            : '';
    const totals = [
        (0, print_text_utils_1.countText)(given.length, 'line'),
        (0, print_text_utils_1.countText)(bills, 'bill'),
        bags.greaterThan(0) ? `${(0, print_text_utils_1.qtyText)(bags)} bags` : null,
    ]
        .filter(Boolean)
        .join(' · ');
    const printedAt = (0, print_text_utils_1.istText)(f.at);
    return {
        title: 'GATE PASS / DELIVERY NOTE',
        company_name: f.companyName,
        branch_name: f.branchName,
        godown_name: n.godownName,
        refno: n.sdnRefno,
        device_code: n.deviceCode,
        status: n.sdnStatus,
        status_mark: statusMark,
        is_reprint: n.sdnPrintCount > 0,
        copy_mark: n.sdnPrintCount > 0 ? 'DUPLICATE' : '',
        date_text: posted ? (0, print_text_utils_1.istText)(n.sdnDatetime) : (0, print_text_utils_1.dmyText)(n.sdnDate),
        mode: n.sdnMode,
        mode_text: NOTE_MODE_TEXT[n.sdnMode] ?? n.sdnMode,
        info_1_label: info[0]?.[0] ?? '',
        info_1_text: info[0]?.[1] ?? '',
        info_2_label: info[1]?.[0] ?? '',
        info_2_text: info[1]?.[1] ?? '',
        info_3_label: info[2]?.[0] ?? '',
        info_3_text: info[2]?.[1] ?? '',
        info_4_label: info[3]?.[0] ?? '',
        info_4_text: info[3]?.[1] ?? '',
        qr_token: n.qrToken,
        qr_caption: (0, delivery_qr_1.deliveryQrCaption)(n.qrToken),
        lines_count: given.length,
        bills_count: bills,
        given_qty: (0, print_text_utils_1.numOf)(qty),
        given_text: (0, print_text_utils_1.qtyText)(qty),
        bags_text: (0, print_text_utils_1.qtyText)(bags),
        weight_kg: (0, print_text_utils_1.numOf)(kg),
        weight_text: (0, print_text_utils_1.qtyText)(kg),
        totals_text: totals,
        came_back_pkgs: (0, print_text_utils_1.numOf)(back),
        came_back_text: back.greaterThan(0)
            ? `${(0, print_text_utils_1.qtyText)(back)} ${back.equals(1) ? 'pkg' : 'pkgs'} came back${f.cameBackAt ? ` on ${(0, print_text_utils_1.istText)(f.cameBackAt)}` : ''}`
            : '',
        still_count: stillCount,
        still_title: stillCount > 0 ? 'Still to come on these bills:' : 'Nothing more to come on these bills.',
        remarks: n.sdnRemarks ?? '',
        posted_by: n.postedBy ?? '',
        cancelled_text: n.sdnStatus === 'CANCELLED'
            ? `Cancelled ${(0, print_text_utils_1.istText)(n.cancelledOn)}${n.cancelledBy ? ` by ${n.cancelledBy}` : ''}` +
                (n.cancelReason ? `: ${n.cancelReason}` : '')
            : '',
        printed_at: printedAt,
        printed_by: f.printedBy ?? '',
        printed_line: [
            `Printed ${printedAt}`,
            f.printedBy,
            n.deviceCode ? `device ${n.deviceCode}` : null,
        ]
            .filter(Boolean)
            .join(' · '),
    };
}
function gatePassLineRows(p) {
    const customer = new Map(p.bills.map((b) => [b.billId, b.custName ?? '']));
    return p.lines
        .filter((l) => (0, print_text_utils_1.decOf)(l.qty).greaterThan(0))
        .map((l, i) => {
        const back = (0, print_text_utils_1.decOf)(l.goodsBackQty);
        return {
            sl_no: i + 1,
            bill_refno: l.billRefno ?? '',
            cust_name: customer.get(l.billId) ?? '',
            item_code: l.itemCode ?? '',
            item_name: l.itemName,
            unit_name: l.unitName,
            qty: (0, print_text_utils_1.numOf)(l.qty),
            qty_text: (0, print_text_utils_1.qtyText)(l.qty),
            lot_no: l.lotNo ?? '',
            weight_kg: (0, print_text_utils_1.numOf)(l.weightKg),
            weight_text: (0, print_text_utils_1.decOf)(l.weightKg).isZero() ? '' : (0, print_text_utils_1.qtyText)(l.weightKg),
            came_back_qty: (0, print_text_utils_1.numOf)(back),
            came_back_text: back.greaterThan(0) ? `Came back ${(0, print_text_utils_1.qtyText)(back)}` : '',
            godown_name: l.godownName,
            bill_godown_name: l.billGodownName,
            other_godown: l.otherGodown,
            lot_swap: l.lotSwap,
            note_text: [
                l.lotSwap ? `lot ${l.lotNo ?? '-'} for ${l.billLotNo ?? '-'}` : null,
                l.otherGodown ? `billed from ${l.billGodownName}` : null,
            ]
                .filter(Boolean)
                .join(' · '),
        };
    });
}
function stillToComeRows(p, open) {
    const draftQty = new Map();
    if (p.note.sdnStatus === 'DRAFT') {
        for (const l of p.lines) {
            draftQty.set(l.billItemId, (draftQty.get(l.billItemId) ?? Z).plus((0, print_text_utils_1.decOf)(l.qty)));
        }
    }
    const billOrder = new Map(p.bills.map((b, i) => [b.billId, i]));
    return open
        .map((o) => ({ o, left: o.pendingQty.minus(draftQty.get(o.billItemId) ?? Z) }))
        .filter(({ left }) => left.greaterThan(0))
        .sort((a, b) => (billOrder.get(a.o.billId) ?? 0) - (billOrder.get(b.o.billId) ?? 0) ||
        a.o.lineNo - b.o.lineNo)
        .map(({ o, left }, i) => {
        const elsewhere = o.godownId !== p.note.sdnGodownId;
        return {
            sl_no: i + 1,
            bill_refno: o.billRefno ?? '',
            item_name: o.itemName,
            unit_name: o.unitName,
            pending_qty: (0, print_text_utils_1.numOf)(left),
            pending_text: (0, print_text_utils_1.qtyText)(left),
            godown_name: o.godownName,
            lot_no: o.lotNo ?? '',
            other_godown: elsewhere,
            text: `${o.billRefno ?? ''}  ${o.itemName} ${(0, print_text_utils_1.qtyText)(left)} ${o.unitName}`.trim() +
                (elsewhere ? ` (${o.godownName} godown)` : ''),
        };
    });
}
function godownSlipHeadRow(b, lines, godownName, printedBy, at) {
    const waiting = b.sb_delivery_mode === 'PICKUP' || b.sb_delivery_mode === 'DISPATCH';
    const token = waiting ? (0, delivery_qr_1.encodeDeliveryQr)('BILL', b.sb_id, b.sb_acc_year.trim()) : '';
    const qty = lines.reduce((a, l) => a.plus(l.pendingQty), Z);
    const kg = lines.reduce((a, l) => a.plus((0, delivery_weight_1.lineWeightKg)(l.pendingQty, l.unitKg)), Z);
    const statusMark = b.sb_status !== 'POSTED'
        ? `${b.sb_status} BILL - NOTHING TO GIVE`
        : !waiting
            ? 'INSTANT BILL - NOTHING TO GIVE'
            : '';
    const printedAt = (0, print_text_utils_1.istText)(at);
    return {
        title: 'GODOWN SLIP',
        company_name: b.comp_name,
        branch_name: b.br_name,
        godown_name: godownName ?? 'All godowns',
        bill_refno: b.sb_bill_refno ?? '',
        bill_date_text: b.sb_bill_datetime ? (0, print_text_utils_1.istText)(b.sb_bill_datetime) : (0, print_text_utils_1.dmyText)(b.sb_bill_date),
        status: b.sb_status,
        status_mark: statusMark,
        delivery_mode: b.sb_delivery_mode,
        delivery_mode_text: b.sb_delivery_mode === 'PICKUP'
            ? 'Pickup - the customer collects'
            : b.sb_delivery_mode === 'DISPATCH'
                ? 'Dispatch - we deliver'
                : (BILL_MODE_TEXT[b.sb_delivery_mode] ?? b.sb_delivery_mode),
        delivery_status: b.sb_delivery_status,
        cust_name: b.sb_cust_name ?? '',
        cust_place: [b.area_name, b.city_name ?? b.sb_cust_place].filter(Boolean).join(', '),
        cust_phone: b.sb_cust_phone ?? '',
        salesman_names: b.salesmen ?? '',
        vehicle_no: b.sb_vehicle_no ?? '',
        remarks: b.sb_remarks ?? '',
        qr_token: token,
        qr_caption: token ? (0, delivery_qr_1.deliveryQrCaption)(token) : '',
        lines_count: lines.length,
        qty: (0, print_text_utils_1.numOf)(qty),
        qty_text: (0, print_text_utils_1.qtyText)(qty),
        weight_kg: (0, print_text_utils_1.numOf)(kg),
        weight_text: (0, print_text_utils_1.qtyText)(kg),
        totals_text: `${(0, print_text_utils_1.countText)(lines.length, 'line')} · ${(0, print_text_utils_1.qtyText)(qty)} pkgs${kg.isZero() ? '' : ` · ${(0, print_text_utils_1.qtyText)(kg)} kg`}`,
        printed_at: printedAt,
        printed_by: printedBy ?? '',
        printed_line: [`Printed ${printedAt}`, printedBy].filter(Boolean).join(' · '),
    };
}
function godownSlipLineRows(lines) {
    return lines.map((l, i) => {
        const kg = (0, delivery_weight_1.lineWeightKg)(l.pendingQty, l.unitKg);
        return {
            sl_no: i + 1,
            line_no: l.lineNo,
            item_code: l.itemCode ?? '',
            item_name: l.itemName,
            unit_name: l.unitName,
            godown_name: l.godownName,
            lot_no: l.lotNo ?? '',
            billed_qty: (0, print_text_utils_1.numOf)(l.billedQty),
            billed_text: (0, print_text_utils_1.qtyText)(l.billedQty),
            given_qty: (0, print_text_utils_1.numOf)(l.givenQty),
            given_text: l.givenQty.isZero() ? '' : (0, print_text_utils_1.qtyText)(l.givenQty),
            qty: (0, print_text_utils_1.numOf)(l.pendingQty),
            qty_text: (0, print_text_utils_1.qtyText)(l.pendingQty),
            weight_kg: (0, print_text_utils_1.numOf)(kg),
            weight_text: kg.isZero() ? '' : (0, print_text_utils_1.qtyText)(kg),
        };
    });
}
function billDeliveryRow(bill) {
    const waiting = !!bill && (bill.sb_delivery_mode === 'PICKUP' || bill.sb_delivery_mode === 'DISPATCH');
    const token = waiting ? (0, delivery_qr_1.encodeDeliveryQr)('BILL', bill.sb_id, bill.sb_acc_year.trim()) : '';
    return {
        delivery_mode: bill?.sb_delivery_mode ?? '',
        delivery_mode_text: bill ? (BILL_MODE_TEXT[bill.sb_delivery_mode] ?? bill.sb_delivery_mode) : '',
        delivery_status: bill?.sb_delivery_status ?? '',
        delivery_qr: token,
        delivery_qr_caption: token ? (0, delivery_qr_1.deliveryQrCaption)(token) : '',
        delivery_qr_label: token ? 'Godown scan' : '',
    };
}
function pickListRows(lines) {
    const sorted = [...lines].sort((a, b) => a.godownName.localeCompare(b.godownName) ||
        a.itemName.localeCompare(b.itemName) ||
        a.unitName.localeCompare(b.unitName) ||
        (a.billDate ?? '').localeCompare(b.billDate ?? '') ||
        (a.billRefno ?? '').localeCompare(b.billRefno ?? '') ||
        a.lineNo - b.lineNo);
    const gd = new Map();
    const it = new Map();
    const itemKey = (l) => `${l.godownId}|${l.itemId}|${l.unitId}`;
    for (const l of sorted) {
        const kg = (0, delivery_weight_1.lineWeightKg)(l.pendingQty, l.unitKg);
        const g = gd.get(l.godownId) ?? { lines: 0, items: new Set(), qty: Z, kg: Z };
        g.lines += 1;
        g.items.add(l.itemId);
        g.qty = g.qty.plus(l.pendingQty);
        g.kg = g.kg.plus(kg);
        gd.set(l.godownId, g);
        const k = itemKey(l);
        const t = it.get(k) ?? { qty: Z, kg: Z, bills: new Set() };
        t.qty = t.qty.plus(l.pendingQty);
        t.kg = t.kg.plus(kg);
        t.bills.add(l.billId);
        it.set(k, t);
    }
    let itemNo = 0;
    let lastItem = '';
    return sorted.map((l, i) => {
        const g = gd.get(l.godownId);
        const t = it.get(itemKey(l));
        if (itemKey(l) !== lastItem) {
            itemNo += 1;
            lastItem = itemKey(l);
        }
        const kg = (0, delivery_weight_1.lineWeightKg)(l.pendingQty, l.unitKg);
        return {
            sl_no: i + 1,
            item_no: itemNo,
            godown_id: l.godownId,
            godown_name: l.godownName,
            godown_text: `${(0, print_text_utils_1.countText)(g.lines, 'line')} · ${(0, print_text_utils_1.countText)(g.items.size, 'item')} · ${(0, print_text_utils_1.qtyText)(g.qty)} pkgs` +
                (g.kg.isZero() ? '' : ` · ${(0, print_text_utils_1.qtyText)(g.kg)} kg`),
            item_key: itemKey(l),
            item_code: l.itemCode ?? '',
            item_name: l.itemName,
            unit_name: l.unitName,
            item_qty: (0, print_text_utils_1.numOf)(t.qty),
            item_qty_text: (0, print_text_utils_1.qtyText)(t.qty),
            item_kg_text: t.kg.isZero() ? '' : (0, print_text_utils_1.qtyText)(t.kg),
            item_bills: t.bills.size,
            item_text: `${(0, print_text_utils_1.qtyText)(t.qty)} ${l.unitName}` +
                (t.kg.isZero() ? '' : ` · ${(0, print_text_utils_1.qtyText)(t.kg)} kg`) +
                ` · ${(0, print_text_utils_1.countText)(t.bills.size, 'bill')}`,
            bill_refno: l.billRefno ?? '',
            bill_date_text: (0, print_text_utils_1.dmyText)(l.billDate),
            cust_name: l.custName ?? '',
            line_no: l.lineNo,
            lot_no: l.lotNo ?? '',
            qty: (0, print_text_utils_1.numOf)(l.pendingQty),
            qty_text: (0, print_text_utils_1.qtyText)(l.pendingQty),
            weight_kg: (0, print_text_utils_1.numOf)(kg),
            weight_text: kg.isZero() ? '' : (0, print_text_utils_1.qtyText)(kg),
        };
    });
}
function pickListHeadRow(rows, asked, refnos, opts) {
    const withLines = new Set(rows.map((r) => r.bill_refno));
    const billsWith = asked.filter((id) => withLines.has(refnos.get(id) ?? ''));
    const nothing = asked.filter((id) => refnos.has(id) && !withLines.has(refnos.get(id) ?? ''));
    const unknown = asked.filter((id) => !refnos.has(id));
    const qty = rows.reduce((a, r) => a.plus((0, print_text_utils_1.decOf)(r.qty)), Z);
    const kg = rows.reduce((a, r) => a.plus((0, print_text_utils_1.decOf)(r.weight_kg)), Z);
    const items = new Set(rows.map((r) => String(r.item_key).split('|')[1])).size;
    const listed = billsWith.map((id) => refnos.get(id) ?? '').filter(Boolean);
    const printedAt = (0, print_text_utils_1.istText)(opts.at);
    return {
        title: 'PICK LIST',
        company_name: opts.companyName,
        branch_name: opts.branchName,
        godown_text: opts.godownName ?? 'All godowns',
        bills_count: billsWith.length,
        bills_text: listed.slice(0, 15).join(', ') + (listed.length > 15 ? ` +${listed.length - 15} more` : ''),
        lines_count: rows.length,
        items_count: items,
        qty: (0, print_text_utils_1.numOf)(qty),
        qty_text: (0, print_text_utils_1.qtyText)(qty),
        weight_kg: (0, print_text_utils_1.numOf)(kg),
        weight_text: (0, print_text_utils_1.qtyText)(kg),
        totals_text: `${(0, print_text_utils_1.countText)(billsWith.length, 'bill')} · ${(0, print_text_utils_1.countText)(items, 'item')} · ${(0, print_text_utils_1.countText)(rows.length, 'line')} · ${(0, print_text_utils_1.qtyText)(qty)} pkgs` +
            (kg.isZero() ? '' : ` · ${(0, print_text_utils_1.qtyText)(kg)} kg`),
        nothing_text: [
            nothing.length > 0
                ? `Nothing left to give on ${nothing.map((id) => refnos.get(id) ?? '').join(', ')}`
                : null,
            unknown.length > 0 ? `${(0, print_text_utils_1.countText)(unknown.length, 'bill')} not found in this branch` : null,
        ]
            .filter(Boolean)
            .join(' · '),
        printed_at: printedAt,
        printed_by: opts.printedBy ?? '',
        printed_line: [`Printed ${printedAt}`, opts.printedBy].filter(Boolean).join(' · '),
    };
}
function pendingRows(rows, amberDays, oldDays) {
    return rows.map((r, i) => {
        const days = r.days_old === null || r.days_old === undefined ? null : Number(r.days_old);
        const band = days === null ? 'NEW' : days > oldDays ? 'OLD' : days > amberDays ? 'AMBER' : 'NEW';
        const kg = (0, print_text_utils_1.decOf)(r.open_kg);
        return {
            sl_no: i + 1,
            row_kind: r.row_kind,
            doc_refno: r.doc_refno ?? '',
            doc_date_text: (0, print_text_utils_1.dmyText)(r.doc_date),
            days_old: days,
            days_text: days === null ? '' : `${days}d`,
            age_band: band,
            is_old: band === 'OLD',
            cust_name: r.cust_name ?? '',
            area_text: [r.area_name, r.city_name].filter(Boolean).join(', '),
            salesman_names: r.salesman_names ?? '',
            mode_text: r.row_kind === 'DC' ? 'Challan' : (BILL_MODE_TEXT[r.delivery_mode ?? ''] ?? r.delivery_mode ?? ''),
            status: r.row_kind === 'DC' ? (r.dc_note ?? 'DC OPEN') : (r.delivery_status ?? ''),
            godown_names: r.godown_names ?? '',
            open_lines: Number(r.open_lines ?? 0),
            open_pkgs: (0, print_text_utils_1.numOf)(r.open_pkgs),
            open_pkgs_text: (0, print_text_utils_1.qtyText)(r.open_pkgs),
            open_kg: (0, print_text_utils_1.numOf)(kg),
            open_kg_text: kg.isZero() ? '' : (0, print_text_utils_1.qtyText)(kg),
            last_given_text: r.last_given_refno
                ? `${r.last_given_refno} · ${(0, print_text_utils_1.istText)(r.last_given_at).slice(0, 10)}`
                : '',
        };
    });
}
function pendingHeadRow(rows, asked, opts) {
    const bills = rows.filter((r) => r.row_kind === 'BILL');
    const dcs = rows.filter((r) => r.row_kind === 'DC');
    const pkgs = rows.reduce((a, r) => a.plus((0, print_text_utils_1.decOf)(r.open_pkgs)), Z);
    const kg = rows.reduce((a, r) => a.plus((0, print_text_utils_1.decOf)(r.open_kg)), Z);
    const lines = rows.reduce((a, r) => a + Number(r.open_lines ?? 0), 0);
    const old = bills.filter((r) => r.is_old).length;
    const printedAt = (0, print_text_utils_1.istText)(opts.at);
    return {
        title: 'PENDING DELIVERIES',
        company_name: opts.companyName,
        branch_name: opts.branchName,
        godown_text: opts.godownName ?? 'All godowns',
        filter_text: opts.filterText ?? '',
        bills_count: bills.length,
        dcs_count: dcs.length,
        lines_count: lines,
        old_count: old,
        pkgs_text: (0, print_text_utils_1.qtyText)(pkgs),
        kg_text: (0, print_text_utils_1.qtyText)(kg),
        totals_text: [
            (0, print_text_utils_1.countText)(bills.length, 'bill'),
            dcs.length > 0 ? (0, print_text_utils_1.countText)(dcs.length, 'challan') : null,
            (0, print_text_utils_1.countText)(lines, 'open line'),
            `${(0, print_text_utils_1.qtyText)(pkgs)} pkgs`,
            kg.isZero() ? null : `${(0, print_text_utils_1.qtyText)(kg)} kg`,
            old > 0 ? `${old} over ${opts.oldDays} days` : null,
        ]
            .filter(Boolean)
            .join(' · '),
        skipped_text: asked > rows.length
            ? `${asked - rows.length} of the ${asked} documents sent had nothing left to give (not listed)`
            : '',
        printed_at: printedAt,
        printed_by: opts.printedBy ?? '',
        printed_line: [`Printed ${printedAt}`, opts.printedBy].filter(Boolean).join(' · '),
    };
}
function text(params, name) {
    const v = params[name];
    if (typeof v === 'number')
        return String(v);
    return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function godownPrompt(params) {
    const g = text(params, 'godown_id');
    if (!g)
        return null;
    if (!print_text_utils_1.UUID.test(g))
        throw new Error(`godown_id: '${g}' is not a godown id.`);
    return g.toLowerCase();
}
let DeliveryPrintSource = class DeliveryPrintSource {
    prisma;
    reader;
    pending;
    salesContext;
    gate = new print_text_utils_1.RenderMemo();
    slip = new print_text_utils_1.RenderMemo();
    pick = new print_text_utils_1.RenderMemo();
    pend = new print_text_utils_1.RenderMemo();
    constructor(prisma, reader, pending, salesContext) {
        this.prisma = prisma;
        this.reader = reader;
        this.pending = pending;
        this.salesContext = salesContext;
    }
    get db() {
        return this.prisma;
    }
    async printRights(userId, menuId, what) {
        const rights = userId && print_text_utils_1.UUID.test(userId) ? await (0, rights_1.loadRights)(this.prisma, userId, menuId) : { ...rights_1.NO_RIGHTS };
        for (const right of ['view', 'print']) {
            if (!rights[right]) {
                throw new Error(`This user may not print ${what} (menu ${menuId}: um_can_${right} is not granted).`);
            }
        }
        return rights;
    }
    async printedBy(userId) {
        if (!userId || !print_text_utils_1.UUID.test(userId))
            return null;
        const [user] = await this.prisma.$queryRaw `
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
        return user?.name ?? null;
    }
    async names(companyId, branchId) {
        const [row] = await this.prisma.$queryRaw `
      SELECT c.comp_name, b.br_name
        FROM public.companys c
        LEFT JOIN public.branch_master b ON b.br_id = ${branchId}::uuid AND b.br_comp_id = c.comp_id
       WHERE c.comp_id = ${companyId}::uuid`;
        return { companyName: row?.comp_name ?? null, branchName: row?.br_name ?? null };
    }
    async godownName(godownId) {
        if (!godownId)
            return null;
        return (await this.reader.godownName(this.db, godownId)) || null;
    }
    async openLines(facts) {
        const n = await this.reader.names(this.db, {
            itemIds: facts.map((f) => f.itemId),
            unitIds: facts.map((f) => f.unitId),
            godownIds: facts.map((f) => f.godownId),
            lotIds: facts.map((f) => f.lotId),
        });
        return {
            named: (f) => ({
                itemCode: n.items.get(f.itemId)?.code ?? null,
                itemName: n.items.get(f.itemId)?.name ?? '',
                unitName: n.units.get(f.unitId) ?? '',
                godownName: n.godowns.get(f.godownId) ?? '',
                lotNo: f.lotId ? (n.lots.get(f.lotId) ?? null) : null,
            }),
        };
    }
    async gatePass(request, code) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, code);
        const { companyId, userId } = request.context;
        return this.gate.get(`${companyId}|${docId}|${accYear}|${userId ?? ''}`, async () => {
            const rights = await this.printRights(userId, delivery_constants_1.DELIVERY_MENU_ID.DELIVERY_NOTE, 'gate passes');
            const h = await this.reader.header(null, { companyId, sdnId: docId, accYear });
            if (!h) {
                throw new Error(`No delivery note ${docId} in this company for ${accYear}.`);
            }
            const payload = (await this.reader.payload(null, { companyId, branchId: h.sdnBranchId, accYear, sdnId: docId }, rights));
            const billKeys = payload.bills.map((b) => ({ billId: b.billId, billAccYear: b.billAccYear }));
            const facts = (await this.pending.linesOfBills(null, billKeys)).filter((f) => f.eligible && f.pendingQty.greaterThan(0));
            const { named } = await this.openLines(facts);
            const open = facts.map((f) => {
                const nm = named(f);
                return {
                    billId: f.billId,
                    billRefno: f.billRefno,
                    billItemId: f.billItemId,
                    lineNo: f.lineNo,
                    itemName: nm.itemName,
                    unitName: nm.unitName,
                    godownId: f.godownId,
                    godownName: nm.godownName,
                    lotNo: nm.lotNo,
                    pendingQty: f.pendingQty,
                };
            });
            const [back] = await this.prisma.$queryRaw `
        SELECT max(e.sde_event_datetime) AS at
          FROM sales.sale_delivery_event e
         WHERE e.sde_src_doc_type = ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE}
           AND e.sde_src_doc_id = ${docId}::uuid
           AND e.sde_kind = 'GOODS_BACK'
           AND e.sde_is_deleted = false`;
            const [{ companyName, branchName }, printedBy] = await Promise.all([
                this.names(companyId, h.sdnBranchId),
                this.printedBy(userId),
            ]);
            const still = stillToComeRows(payload, open);
            return {
                head: gatePassHeadRow(payload, still.length, {
                    companyName,
                    branchName,
                    cameBackAt: back?.at ?? null,
                    printedBy,
                    at: new Date(),
                }),
                lines: gatePassLineRows(payload),
                still,
            };
        });
    }
    async godownSlip(request, code) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, code);
        const { companyId, userId } = request.context;
        const godownId = godownPrompt(request.params);
        return this.slip.get(`${companyId}|${docId}|${accYear}|${godownId ?? ''}|${userId ?? ''}`, async () => {
            const [bill] = await this.prisma.$queryRaw `
        SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_bill_date, b.sb_bill_datetime, b.sb_status,
               b.sb_delivery_mode, b.sb_delivery_status, b.sb_cust_name, b.sb_cust_place, b.sb_cust_phone,
               b.sb_remarks, b.sb_vehicle_no, c.comp_name, br.br_name,
               a.arm_name AS area_name, ct.ctm_name AS city_name,
               (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) FROM public.employee_master em
                 WHERE em.emp_id = ANY(b.sb_salesman_id)) AS salesmen
          FROM sales.sale_bill b
          JOIN public.companys c ON c.comp_id = b.sb_company_id
          LEFT JOIN public.branch_master br ON br.br_id = b.sb_branch_id
          LEFT JOIN sales.customers cu ON cu.cus_id = b.sb_cust_id
          LEFT JOIN sales.area_master a ON a.arm_id = cu.cus_area_id
          LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
         WHERE b.sb_id = ${docId}::uuid
           AND b.sb_acc_year = ${accYear}::bpchar
           AND b.sb_company_id = ${companyId}::uuid
           AND b.sb_is_deleted = false`;
            if (!bill) {
                throw new Error(`No sale bill ${docId} in this company for ${accYear}.`);
            }
            const facts = (await this.pending.linesOfBills(null, [{ billId: docId, billAccYear: accYear }]))
                .filter((f) => f.eligible && f.pendingQty.greaterThan(0))
                .filter((f) => !godownId || f.godownId === godownId)
                .sort((a, b) => a.lineNo - b.lineNo || a.splitNo - b.splitNo);
            const { named } = await this.openLines(facts);
            const lines = facts.map((f) => {
                const nm = named(f);
                return {
                    lineNo: f.lineNo,
                    itemCode: nm.itemCode,
                    itemName: nm.itemName,
                    unitName: nm.unitName,
                    godownId: f.godownId,
                    godownName: nm.godownName,
                    lotNo: nm.lotNo,
                    billedQty: f.billedQty,
                    givenQty: f.givenQty,
                    pendingQty: f.pendingQty,
                    unitKg: f.unitKg,
                };
            });
            const [gName, printedBy] = await Promise.all([this.godownName(godownId), this.printedBy(userId)]);
            return {
                head: godownSlipHeadRow(bill, lines, gName, printedBy, new Date()),
                lines: godownSlipLineRows(lines),
            };
        });
    }
    async billDelivery(request, code) {
        const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, code);
        const [bill] = await this.prisma.$queryRaw `
      SELECT sb_id, sb_acc_year, sb_delivery_mode, sb_delivery_status
        FROM sales.sale_bill
       WHERE sb_id = ${docId}::uuid
         AND sb_acc_year = ${accYear}::bpchar
         AND sb_company_id = ${request.context.companyId}::uuid
         AND sb_is_deleted = false`;
        return billDeliveryRow(bill ?? null);
    }
    async pickList(request) {
        const { companyId, branchId, userId } = request.context;
        const ids = (0, print_text_utils_1.uuidList)(request.params.bill_ids, 'bill_ids');
        const godownId = godownPrompt(request.params);
        return this.pick.get(`${companyId}|${branchId ?? ''}|${ids.join(',')}|${godownId ?? ''}|${userId ?? ''}`, async () => {
            await this.printRights(userId, delivery_constants_1.DELIVERY_MENU_ID.PENDING_DELIVERIES, 'pick lists (Pending Deliveries)');
            if (!branchId)
                throw new Error('The pick list prints for one branch; the render named none.');
            if (ids.length === 0)
                throw new Error('bill_ids: tick at least one bill to print a pick list.');
            const bills = await this.prisma.$queryRaw `
        SELECT sb_id, sb_acc_year, sb_bill_refno
          FROM sales.sale_bill
         WHERE sb_id = ANY(${ids}::uuid[])
           AND sb_company_id = ${companyId}::uuid
           AND sb_branch_id = ${branchId}::uuid
           AND sb_is_deleted = false`;
            const refnos = new Map(bills.map((b) => [b.sb_id, b.sb_bill_refno]));
            const facts = (await this.pending.linesOfBills(null, bills.map((b) => ({ billId: b.sb_id, billAccYear: b.sb_acc_year })))).filter((f) => f.eligible && f.pendingQty.greaterThan(0) && (!godownId || f.godownId === godownId));
            const { named } = await this.openLines(facts);
            const rows = pickListRows(facts.map((f) => {
                const nm = named(f);
                return {
                    godownId: f.godownId,
                    godownName: nm.godownName,
                    itemId: f.itemId,
                    itemCode: nm.itemCode,
                    itemName: nm.itemName,
                    unitId: f.unitId,
                    unitName: nm.unitName,
                    billId: f.billId,
                    billRefno: f.billRefno,
                    billDate: f.billDate,
                    custName: f.custName,
                    lineNo: f.lineNo,
                    lotNo: nm.lotNo,
                    pendingQty: f.pendingQty,
                    unitKg: f.unitKg,
                };
            }));
            const [where, gName, printedBy] = await Promise.all([
                this.names(companyId, branchId),
                this.godownName(godownId),
                this.printedBy(userId),
            ]);
            return {
                head: pickListHeadRow(rows, ids, refnos, {
                    ...where,
                    godownName: gName,
                    printedBy,
                    at: new Date(),
                }),
                lines: rows,
            };
        });
    }
    async pendingList(request) {
        const { companyId, branchId, userId } = request.context;
        const billIds = (0, print_text_utils_1.uuidList)(request.params.bill_ids, 'bill_ids');
        const dcIds = (0, print_text_utils_1.uuidList)(request.params.dc_ids, 'dc_ids');
        const godownId = godownPrompt(request.params);
        const filterText = text(request.params, 'filter_text');
        const key = `${companyId}|${branchId ?? ''}|${billIds.join(',')}|${dcIds.join(',')}|${godownId ?? ''}|${filterText ?? ''}|${userId ?? ''}`;
        return this.pend.get(key, async () => {
            await this.printRights(userId, delivery_constants_1.DELIVERY_MENU_ID.PENDING_DELIVERIES, 'the pending deliveries list');
            if (!branchId)
                throw new Error('The pending list prints for one branch; the render named none.');
            if (billIds.length + dcIds.length === 0) {
                throw new Error('bill_ids: send the bills the list shows (comma separated).');
            }
            const [amberRaw, oldRaw] = await Promise.all([
                this.salesContext.setting(companyId, branchId, delivery_constants_1.DELIVERY_SETTING_KEYS.AMBER_DAYS),
                this.salesContext.setting(companyId, branchId, delivery_constants_1.DELIVERY_SETTING_KEYS.OLD_DAYS),
            ]);
            const amber = Number(amberRaw);
            const old = Number(oldRaw);
            const amberDays = Number.isInteger(amber) && amber > 0 ? amber : delivery_constants_1.DEFAULT_AMBER_DAYS;
            const oldDays = Number.isInteger(old) && old > 0 ? old : delivery_constants_1.DEFAULT_OLD_DAYS;
            const db = await this.pendingDbRows(companyId, branchId, billIds, dcIds, godownId);
            const rows = pendingRows(db, amberDays, oldDays);
            const [where, gName, printedBy] = await Promise.all([
                this.names(companyId, branchId),
                this.godownName(godownId),
                this.printedBy(userId),
            ]);
            return {
                head: pendingHeadRow(rows, billIds.length + dcIds.length, {
                    ...where,
                    godownName: gName,
                    filterText,
                    oldDays,
                    printedBy,
                    at: new Date(),
                }),
                rows,
            };
        });
    }
    pendingDbRows(companyId, branchId, billIds, dcIds, godownId) {
        return this.prisma.$queryRaw `
      WITH pl AS (
        SELECT b.sb_id, b.sb_acc_year, i.sbi_godown_id,
               i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
               ${(0, delivery_pending_sql_1.lineUnitKgSql)()} AS unit_kg,
               (${godownId}::uuid IS NULL OR i.sbi_godown_id = ${godownId}::uuid) AS in_scope
          FROM sales.sale_bill b
          JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
          LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
          LEFT JOIN LATERAL ${(0, delivery_pending_sql_1.lineEventSumsLateral)()} ev ON true
         WHERE b.sb_id = ANY(${billIds}::uuid[])
           AND b.sb_company_id = ${companyId}::uuid
           AND b.sb_branch_id = ${branchId}::uuid
           AND ${(0, delivery_pending_sql_1.eligibleLineWhere)()}
      ),
      ob AS (
        SELECT p.sb_id, p.sb_acc_year,
               count(*) FILTER (WHERE p.in_scope) AS open_lines,
               SUM(p.pending_qty) FILTER (WHERE p.in_scope) AS open_pkgs,
               SUM(p.pending_qty * p.unit_kg) FILTER (WHERE p.in_scope) AS open_kg,
               string_agg(DISTINCT g.gdl_name, ', ') AS godown_names
          FROM pl p
          LEFT JOIN inventory.godown_locations g ON g.gdl_id = p.sbi_godown_id
         WHERE p.pending_qty <> 0
         GROUP BY p.sb_id, p.sb_acc_year
        HAVING count(*) FILTER (WHERE p.in_scope) > 0
      ),
      dl AS (
        SELECT d.sdc_id, d.sdc_acc_year,
               count(*) FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) AS open_lines,
               SUM(di.sdi_open_qty) FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) AS open_pkgs,
               SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0 THEN di.sdi_weight_qty / di.sdi_dc_qty
                                          ELSE COALESCE(u.iuc_uom_weight, 0) END)
                   FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) AS open_kg,
               SUM(di.sdi_dc_qty) AS total_pkgs,
               SUM(di.sdi_billed_qty) AS billed_pkgs,
               string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE di.sdi_open_qty > 0) AS godown_names
          FROM sales.sale_dc d
          JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
          LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
          LEFT JOIN inventory.godown_locations g ON g.gdl_id = di.sdi_godown_id
         WHERE d.sdc_id = ANY(${dcIds}::uuid[])
           AND d.sdc_company_id = ${companyId}::uuid
           AND d.sdc_branch_id = ${branchId}::uuid
           AND d.sdc_is_deleted = false
           AND d.sdc_status = 'POSTED'
           AND di.sdi_is_deleted = false
         GROUP BY d.sdc_id, d.sdc_acc_year
        HAVING count(*) FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) > 0
      ),
      r AS (
        SELECT 'BILL'::text AS row_kind, 0 AS kind_sort,
               array_position(${billIds}::uuid[], b.sb_id) AS pos,
               b.sb_id AS doc_id, b.sb_acc_year AS doc_acc_year, b.sb_bill_refno AS doc_refno,
               b.sb_bill_date AS doc_date, COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
               c.cus_area_id AS area_uuid, b.sb_salesman_id AS salesman_ids,
               b.sb_delivery_mode AS delivery_mode, b.sb_delivery_status AS delivery_status,
               ob.godown_names, ob.open_lines, ob.open_pkgs, ob.open_kg,
               lg.sde_src_refno AS last_given_refno, lg.sde_event_datetime AS last_given_at,
               NULL::text AS dc_note
          FROM ob
          JOIN sales.sale_bill b ON b.sb_id = ob.sb_id AND b.sb_acc_year = ob.sb_acc_year
          LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
          LEFT JOIN LATERAL (SELECT e.sde_src_refno, e.sde_event_datetime
                               FROM sales.sale_delivery_event e
                              WHERE e.sde_bill_id = b.sb_id
                                AND e.sde_bill_acc_year = b.sb_acc_year
                                AND e.sde_kind = 'GIVEN'
                                AND e.sde_is_deleted = false
                                AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                                 WHERE x.sde_reverses_id = e.sde_id
                                                   AND x.sde_kind = 'CANCEL')
                              ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
                              LIMIT 1) lg ON true
        UNION ALL
        SELECT 'DC', 1, array_position(${dcIds}::uuid[], d.sdc_id),
               d.sdc_id, d.sdc_acc_year, d.sdc_dc_refno, d.sdc_dc_date,
               COALESCE(c.cus_name, d.sdc_cust_name), c.cus_area_id, d.sdc_salesman_id,
               'DC', NULL, dl.godown_names, dl.open_lines, dl.open_pkgs, dl.open_kg,
               NULL, NULL,
               CASE WHEN dl.billed_pkgs > 0 THEN 'DC PART-BILLED' ELSE 'DC OPEN' END
                 || ' · open ' || trim_scale(dl.open_pkgs) || ' of ' || trim_scale(dl.total_pkgs)
          FROM dl
          JOIN sales.sale_dc d ON d.sdc_id = dl.sdc_id AND d.sdc_acc_year = dl.sdc_acc_year
          LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
      )
      SELECT r.row_kind, r.doc_id, r.doc_acc_year, r.doc_refno, r.doc_date::text AS doc_date,
             ((now() AT TIME ZONE 'Asia/Kolkata')::date - r.doc_date)::int AS days_old,
             r.cust_name, a.arm_name AS area_name, ct.ctm_name AS city_name,
             (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) FROM public.employee_master em
               WHERE em.emp_id = ANY(r.salesman_ids)) AS salesman_names,
             r.delivery_mode, r.delivery_status, r.godown_names, r.open_lines::int AS open_lines,
             round(r.open_pkgs, 3) AS open_pkgs, round(COALESCE(r.open_kg, 0), 3) AS open_kg,
             r.last_given_refno, r.last_given_at, r.dc_note
        FROM r
        LEFT JOIN sales.area_master a ON a.arm_id = r.area_uuid
        LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
       ORDER BY r.kind_sort, r.pos`;
    }
};
exports.DeliveryPrintSource = DeliveryPrintSource;
exports.DeliveryPrintSource = DeliveryPrintSource = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        delivery_note_read_service_1.DeliveryNoteReadService,
        delivery_pending_service_1.DeliveryPendingService,
        sales_context_service_1.SalesContextService])
], DeliveryPrintSource);
let GatePassHeadProvider = class GatePassHeadProvider {
    source;
    code = 'sales.delivery_note.head';
    label = 'Gate pass / Delivery Note — heading, crew, QR, totals, came back';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.gatePass(request, this.code)).head;
    }
};
exports.GatePassHeadProvider = GatePassHeadProvider;
exports.GatePassHeadProvider = GatePassHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], GatePassHeadProvider);
let GatePassLinesProvider = class GatePassLinesProvider {
    source;
    code = 'sales.delivery_note.lines';
    label = 'Gate pass / Delivery Note — the lines given (no prices)';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.gatePass(request, this.code)).lines.slice(0, request.rowLimit);
    }
};
exports.GatePassLinesProvider = GatePassLinesProvider;
exports.GatePassLinesProvider = GatePassLinesProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], GatePassLinesProvider);
let GatePassStillProvider = class GatePassStillProvider {
    source;
    code = 'sales.delivery_note.still_to_come';
    label = 'Gate pass — still to come on the same bills (every godown)';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.gatePass(request, this.code)).still.slice(0, request.rowLimit);
    }
};
exports.GatePassStillProvider = GatePassStillProvider;
exports.GatePassStillProvider = GatePassStillProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], GatePassStillProvider);
let GodownSlipHeadProvider = class GodownSlipHeadProvider {
    source;
    code = 'sales.bill.godown_slip.head';
    label = 'Godown slip — the bill, customer, godown and the bill QR (no prices)';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.godownSlip(request, this.code)).head;
    }
};
exports.GodownSlipHeadProvider = GodownSlipHeadProvider;
exports.GodownSlipHeadProvider = GodownSlipHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], GodownSlipHeadProvider);
let GodownSlipLinesProvider = class GodownSlipLinesProvider {
    source;
    code = 'sales.bill.godown_slip.lines';
    label = 'Godown slip — the bill lines still to give from the godown';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.godownSlip(request, this.code)).lines.slice(0, request.rowLimit);
    }
};
exports.GodownSlipLinesProvider = GodownSlipLinesProvider;
exports.GodownSlipLinesProvider = GodownSlipLinesProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], GodownSlipLinesProvider);
let BillDeliveryProvider = class BillDeliveryProvider {
    source;
    code = 'sales.bill.delivery';
    label = 'Sale bill — delivery mode and the "Godown scan" QR (Pickup / Dispatch only)';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    resolve(request) {
        return this.source.billDelivery(request, this.code);
    }
};
exports.BillDeliveryProvider = BillDeliveryProvider;
exports.BillDeliveryProvider = BillDeliveryProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], BillDeliveryProvider);
let PickListHeadProvider = class PickListHeadProvider {
    source;
    code = 'sales.delivery.pick_list.head';
    label = 'Pick list — heading and totals of the ticked bills';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.pickList(request)).head;
    }
};
exports.PickListHeadProvider = PickListHeadProvider;
exports.PickListHeadProvider = PickListHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], PickListHeadProvider);
let PickListLinesProvider = class PickListLinesProvider {
    source;
    code = 'sales.delivery.pick_list.lines';
    label = 'Pick list — open lines by godown, then item, with sums';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.pickList(request)).lines.slice(0, request.rowLimit);
    }
};
exports.PickListLinesProvider = PickListLinesProvider;
exports.PickListLinesProvider = PickListLinesProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], PickListLinesProvider);
let PendingListHeadProvider = class PendingListHeadProvider {
    source;
    code = 'sales.delivery.pending.head';
    label = 'Pending deliveries — heading and totals of the bills listed';
    cardinality = 'one';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.pendingList(request)).head;
    }
};
exports.PendingListHeadProvider = PendingListHeadProvider;
exports.PendingListHeadProvider = PendingListHeadProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], PendingListHeadProvider);
let PendingListRowsProvider = class PendingListRowsProvider {
    source;
    code = 'sales.delivery.pending.rows';
    label = 'Pending deliveries — one row per bill (then challan), as the screen lists them';
    cardinality = 'many';
    constructor(source) {
        this.source = source;
    }
    async resolve(request) {
        return (await this.source.pendingList(request)).rows.slice(0, request.rowLimit);
    }
};
exports.PendingListRowsProvider = PendingListRowsProvider;
exports.PendingListRowsProvider = PendingListRowsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [DeliveryPrintSource])
], PendingListRowsProvider);
exports.DELIVERY_PRINT_PROVIDERS = [
    GatePassHeadProvider,
    GatePassLinesProvider,
    GatePassStillProvider,
    GodownSlipHeadProvider,
    GodownSlipLinesProvider,
    BillDeliveryProvider,
    PickListHeadProvider,
    PickListLinesProvider,
    PendingListHeadProvider,
    PendingListRowsProvider,
];
//# sourceMappingURL=delivery.providers.js.map