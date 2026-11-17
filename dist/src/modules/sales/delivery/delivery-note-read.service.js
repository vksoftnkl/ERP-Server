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
exports.DeliveryNoteReadService = void 0;
exports.holdingKey = holdingKey;
exports.istClock = istClock;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const delivery_constants_1 = require("./core/delivery.constants");
const delivery_pending_service_1 = require("./core/delivery-pending.service");
const delivery_qr_1 = require("./core/delivery-qr");
const delivery_weight_1 = require("./core/delivery-weight");
const delivery_errors_1 = require("./delivery.errors");
const delivery_note_rules_1 = require("./delivery-note.rules");
const Z = new client_1.Prisma.Decimal(0);
const q3 = (d) => d.toDecimalPlaces(3).toString();
let DeliveryNoteReadService = class DeliveryNoteReadService {
    prisma;
    pending;
    transportBand;
    constructor(prisma, pending, transportBand) {
        this.prisma = prisma;
        this.pending = pending;
        this.transportBand = transportBand;
    }
    c(client) {
        return client ?? this.prisma;
    }
    async header(client, keys) {
        return this.c(client).saleDeliveryNote.findFirst({
            where: {
                sdnId: keys.sdnId,
                sdnCompanyId: keys.companyId,
                ...(keys.branchId ? { sdnBranchId: keys.branchId } : {}),
                ...(keys.accYear ? { sdnAccYear: keys.accYear } : {}),
                sdnIsDeleted: false,
            },
        });
    }
    async payload(client, keys, rights) {
        const c = this.c(client);
        const h = await this.header(c, keys);
        if (!h) {
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_FOUND, `No delivery note ${keys.sdnId} in this branch and year`, 'sdnId');
        }
        const items = await c.saleDeliveryNoteItem.findMany({
            where: { sdniNoteId: h.sdnId, sdniAccYear: h.sdnAccYear, sdniIsDeleted: false },
            orderBy: { sdniLineNo: 'asc' },
        });
        const facts = await this.pending.linesByKeys(c, items.map((i) => ({ billItemId: i.sdniBillItemId, billAccYear: i.sdniBillAccYear })));
        const factsById = new Map(facts.map((f) => [f.billItemId, f]));
        const events = await this.noteEvents(c, h.sdnId);
        const names = await this.names(c, {
            itemIds: items.map((i) => i.sdniItemId),
            unitIds: items.map((i) => i.sdniItemUnitId),
            godownIds: [h.sdnGodownId, ...items.map((i) => i.sdniBillGodownId)],
            lotIds: items.flatMap((i) => [i.sdniLotId, i.sdniBillLotId]),
        });
        const shelves = await this.shelvesBase(c, h.sdnCompanyId, h.sdnBranchId, items.map((i) => ({ godownId: i.sdniGodownId, itemId: i.sdniItemId, lotId: i.sdniLotId, bucket: i.sdniBucket })));
        const lastGiven = await this.lastGiven(c, items.map((i) => i.sdniBillItemId));
        const posted = h.sdnStatus !== 'DRAFT';
        const lines = items.map((i) => {
            const f = factsById.get(i.sdniBillItemId);
            const mine = events.get(i.sdniId);
            const givenMine = mine?.given ?? Z;
            const back = mine?.back ?? Z;
            const givenAll = f?.givenQty ?? Z;
            const factor = (0, delivery_pending_service_1.dec)(i.sdniToBaseFactor);
            const shelf = shelves.get(holdingKey(i.sdniGodownId, i.sdniItemId, i.sdniLotId, i.sdniBucket)) ?? Z;
            const qty = (0, delivery_pending_service_1.dec)(i.sdniQty);
            return {
                sdniId: i.sdniId,
                lineNo: i.sdniLineNo,
                billId: i.sdniBillId,
                billAccYear: i.sdniBillAccYear.trim(),
                billRefno: i.sdniBillRefno,
                billItemId: i.sdniBillItemId,
                billLineNo: i.sdniBillLineNo,
                itemId: i.sdniItemId,
                itemCode: names.items.get(i.sdniItemId)?.code ?? null,
                itemName: names.items.get(i.sdniItemId)?.name ?? '',
                unitId: i.sdniItemUnitId,
                unitName: names.units.get(i.sdniItemUnitId) ?? '',
                toBaseFactor: factor.toString(),
                billGodownId: i.sdniBillGodownId,
                billGodownName: names.godowns.get(i.sdniBillGodownId) ?? '',
                godownId: i.sdniGodownId,
                godownName: names.godowns.get(i.sdniGodownId) ?? '',
                billLotId: i.sdniBillLotId,
                billLotNo: i.sdniBillLotId ? (names.lots.get(i.sdniBillLotId) ?? null) : null,
                lotId: i.sdniLotId,
                lotNo: i.sdniLotId ? (names.lots.get(i.sdniLotId) ?? null) : null,
                bucket: i.sdniBucket,
                billedQty: q3(f?.billedQty ?? Z),
                givenBeforeQty: q3(posted ? givenAll.minus(givenMine).plus(back).plus(mine?.cancelled ?? Z) : givenAll),
                pendingQty: q3(f?.pendingQty ?? Z),
                qty: q3(qty),
                baseQty: (0, delivery_pending_service_1.dec)(i.sdniBaseQty).toDecimalPlaces(6).toString(),
                unitKg: f ? (0, delivery_weight_1.unitKgText)(f.unitKg) : (0, delivery_weight_1.unitKgText)(qty.isZero() ? Z : (0, delivery_pending_service_1.dec)(i.sdniWeightKg).dividedBy(qty)),
                weightKg: q3(f ? (0, delivery_weight_1.lineWeightKg)(qty, f.unitKg) : (0, delivery_pending_service_1.dec)(i.sdniWeightKg)),
                scannedQty: q3((0, delivery_pending_service_1.dec)(i.sdniScannedQty)),
                goodsBackQty: q3(back),
                lotSwap: !!i.sdniLotId && !!i.sdniBillLotId && i.sdniLotId !== i.sdniBillLotId,
                otherGodown: i.sdniGodownId !== i.sdniBillGodownId,
                otherGodownOk: i.sdniOtherGodownOk,
                shelfQty: q3(factor.isZero() ? shelf : shelf.dividedBy(factor)),
                barcodes: barcodesOf(names, i.sdniItemId, i.sdniItemUnitId),
                lastGiven: lastGiven.get(i.sdniBillItemId) ?? null,
                lastGoodsBack: mine?.lastBack ?? null,
                remarks: i.sdniRemarks,
            };
        });
        const billKeys = uniqBills(items.map((i) => ({ billId: i.sdniBillId, billAccYear: i.sdniBillAccYear.trim() })));
        const elsewhere = await this.elsewhere(c, billKeys, h.sdnGodownId, new Set(items.map((i) => i.sdniBillItemId)));
        const bills = await this.billsView(c, billKeys, items.map((i) => i.sdniBillId), elsewhere);
        const transport = await this.transportBand.read({ docType: 'DELIVERY_NOTE', docId: h.sdnId, accYear: h.sdnAccYear }, c);
        const people = await this.people(c, [
            h.sdnDriverId,
            h.sdnSupervisorId,
            ...(h.sdnLoadmanId ?? []),
        ]);
        const users = await this.userNames(c, [h.sdnPostedBy, h.sdnCancelledBy, h.sdnCreatedBy]);
        const vehicle = h.sdnVehicleId
            ? await c.$queryRaw `
          SELECT veh_vehicle_no, veh_capacity_kg FROM public.vehicle_master WHERE veh_id = ${h.sdnVehicleId}::uuid`
            : [];
        const capacity = h.sdnVehicleCapacityKg !== null && h.sdnStatus !== 'DRAFT'
            ? (0, delivery_pending_service_1.dec)(h.sdnVehicleCapacityKg)
            : vehicle[0]?.veh_capacity_kg
                ? (0, delivery_pending_service_1.dec)(vehicle[0].veh_capacity_kg)
                : null;
        const totals = totalsOfViews(lines, posted);
        const load = (0, delivery_note_rules_1.noteLoad)({ capacityKg: capacity }, totals);
        const goodsBackPkgs = lines.reduce((a, l) => a.plus(new client_1.Prisma.Decimal(l.goodsBackQty)), Z);
        const year = h.sdnAccYear.trim();
        return {
            note: {
                sdnId: h.sdnId,
                sdnAccYear: year,
                sdnRefno: h.sdnRefno,
                sdnSlno: h.sdnSlno.toString(),
                deviceCode: h.sdnRefno.split('/')[2] ?? null,
                sdnDeviceId: h.sdnDeviceId,
                sdnDate: (0, delivery_pending_service_1.ymd)(h.sdnDate),
                sdnDatetime: h.sdnDatetime.toISOString(),
                sdnStatus: h.sdnStatus,
                sdnRevisionNo: h.sdnRevisionNo,
                sdnGodownId: h.sdnGodownId,
                godownName: names.godowns.get(h.sdnGodownId) ?? '',
                sdnMode: h.sdnMode,
                sdnVehicleId: h.sdnVehicleId,
                sdnVehicleNo: h.sdnVehicleNo ?? vehicle[0]?.veh_vehicle_no ?? null,
                vehicleCapacityKg: capacity ? q3(capacity) : null,
                sdnDriverId: h.sdnDriverId,
                driverName: h.sdnDriverId ? (people.get(h.sdnDriverId) ?? null) : null,
                sdnLoadmanIds: h.sdnLoadmanId ?? [],
                loadmanNames: (h.sdnLoadmanId ?? []).map((id) => people.get(id) ?? ''),
                sdnSupervisorId: h.sdnSupervisorId,
                supervisorName: h.sdnSupervisorId ? (people.get(h.sdnSupervisorId) ?? null) : null,
                sdnCollectedBy: h.sdnCollectedBy,
                sdnCollectorPhone: h.sdnCollectorPhone,
                transport: {
                    transporterId: transport?.transporterId ?? null,
                    transporterName: transport?.transporterName ?? null,
                    lrNo: transport?.lrNo ?? null,
                    lrDate: transport?.lrDate ?? null,
                },
                sdnRemarks: h.sdnRemarks,
                sdnOverrides: h.sdnOverrides,
                sdnPrintCount: h.sdnPrintCount,
                createdOn: h.sdnCreatedOn.toISOString(),
                createdBy: users.get(h.sdnCreatedBy) ?? h.sdnCreatedBy,
                postedOn: h.sdnPostedOn?.toISOString() ?? null,
                postedBy: h.sdnPostedBy ? (users.get(h.sdnPostedBy) ?? h.sdnPostedBy) : null,
                cancelledOn: h.sdnCancelledOn?.toISOString() ?? null,
                cancelledBy: h.sdnCancelledBy ? (users.get(h.sdnCancelledBy) ?? h.sdnCancelledBy) : null,
                cancelReason: h.sdnCancelReason,
                goodsBackPkgs: q3(goodsBackPkgs),
                qrToken: (0, delivery_qr_1.encodeDeliveryQr)('NOTE', h.sdnId, year),
            },
            bills,
            lines,
            elsewhere,
            totals,
            load,
            rights,
        };
    }
    async scan(q) {
        const c = this.c();
        const raw = q.code.trim();
        let billKey = null;
        if ((0, delivery_qr_1.looksLikeDeliveryQr)(raw)) {
            const qr = (0, delivery_qr_1.decodeDeliveryQr)(raw);
            if (!qr) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_SCAN_UNKNOWN, `${raw} is not a readable bill or gate-pass QR`, 'code', { branch: '' });
            }
            if (qr.kind === 'NOTE') {
                const n = await c.saleDeliveryNote.findFirst({
                    where: { sdnId: qr.id, sdnAccYear: qr.accYear, sdnCompanyId: q.companyId, sdnBranchId: q.branchId, sdnIsDeleted: false },
                    select: { sdnId: true, sdnAccYear: true, sdnRefno: true },
                });
                if (!n) {
                    (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_SCAN_UNKNOWN, `${raw} is not a gate pass of this branch`, 'code', { branch: '' });
                }
                return {
                    kind: 'NOTE',
                    bill: null,
                    bills: [],
                    lines: [],
                    elsewhere: [],
                    note: { sdnId: n.sdnId, sdnAccYear: n.sdnAccYear.trim(), sdnRefno: n.sdnRefno },
                };
            }
            billKey = { billId: qr.id, billAccYear: qr.accYear };
        }
        const bill = billKey
            ? await c.$queryRaw `
          SELECT sb_id, sb_acc_year, sb_bill_refno, sb_cust_name, sb_delivery_mode, sb_branch_id
            FROM sales.sale_bill
           WHERE sb_id = ${billKey.billId}::uuid AND sb_acc_year = ${billKey.billAccYear}::bpchar
             AND sb_company_id = ${q.companyId}::uuid AND sb_is_deleted = false AND sb_status = 'POSTED'`
            : await c.$queryRaw `
          SELECT sb_id, sb_acc_year, sb_bill_refno, sb_cust_name, sb_delivery_mode, sb_branch_id
            FROM sales.sale_bill
           WHERE sb_company_id = ${q.companyId}::uuid AND sb_branch_id = ${q.branchId}::uuid
             AND upper(sb_bill_refno) = upper(${raw}) AND sb_is_deleted = false AND sb_status = 'POSTED'
           ORDER BY sb_acc_year DESC LIMIT 1`;
        const b = bill[0];
        if (!b || b.sb_branch_id !== q.branchId) {
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_SCAN_UNKNOWN, `${raw} is not a posted bill or gate pass of this branch`, 'code', {
                branch: '',
            });
        }
        const key = { billId: b.sb_id, billAccYear: b.sb_acc_year.trim() };
        const open = await this.openLines(c, q.companyId, q.branchId, q.godownId, [key]);
        if (open.lines.length === 0) {
            if (open.elsewhere.length > 0) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_SCAN_NO_OPEN_HERE, `${b.sb_bill_refno} has no open lines in this godown`, 'code', {
                    bill: b.sb_bill_refno ?? '',
                    godown: await this.godownName(c, q.godownId),
                    godowns: [...new Set(open.elsewhere.map((e) => e.godownName))].join(', '),
                });
            }
            const [last] = await c.$queryRaw `
        SELECT e.sde_src_refno AS refno, MAX(e.sde_event_datetime) AS at
          FROM sales.sale_delivery_event e
         WHERE e.sde_bill_id = ${key.billId}::uuid AND e.sde_bill_acc_year = ${key.billAccYear}::bpchar
           AND e.sde_kind IN ('GIVEN', 'CLEANUP')
         GROUP BY e.sde_src_refno ORDER BY MAX(e.sde_event_datetime) DESC LIMIT 1`;
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_NOTHING_OPEN, `${b.sb_bill_refno} has nothing left to give`, 'code', {
                bill: b.sb_bill_refno ?? '',
                dn: last?.refno ?? '',
                date: last?.at ? last.at.toISOString().slice(0, 10) : '',
            });
        }
        return {
            kind: 'BILL',
            bill: {
                billId: b.sb_id,
                billAccYear: key.billAccYear,
                billRefno: b.sb_bill_refno,
                custName: b.sb_cust_name,
                mode: b.sb_delivery_mode,
            },
            bills: open.bills,
            lines: open.lines,
            elsewhere: open.elsewhere,
            note: null,
        };
    }
    async openLines(client, companyId, branchId, godownId, bills) {
        const c = this.c(client);
        const asked = uniqBills(bills);
        const mine = (await this.pending.linesOfBills(c, asked)).filter((f) => f.companyId === companyId && f.branchId === branchId);
        const facts = mine.filter((f) => f.eligible && f.pendingQty.greaterThan(0));
        const here = facts.filter((f) => f.godownId === godownId);
        const away = facts.filter((f) => f.godownId !== godownId);
        const names = await this.names(c, {
            itemIds: facts.map((f) => f.itemId),
            unitIds: facts.map((f) => f.unitId),
            godownIds: [godownId, ...facts.map((f) => f.godownId)],
            lotIds: facts.map((f) => f.lotId),
        });
        const shelves = await this.shelvesBase(c, companyId, branchId, here.map((f) => ({ godownId, itemId: f.itemId, lotId: f.lotId, bucket: f.bucket })));
        const lastGiven = await this.lastGiven(c, here.map((f) => f.billItemId));
        const lines = here.map((f, i) => lineFromFacts(f, i + 1, godownId, names, shelves, lastGiven));
        const elsewhere = away.map((f) => elsewhereOf(f, names));
        const known = new Set(mine.map((f) => `${f.billId}|${f.billAccYear}`));
        const billsView = await this.billsView(c, asked.filter((k) => known.has(`${k.billId}|${k.billAccYear}`)), lines.map((l) => l.billId), elsewhere);
        return { bills: billsView, lines, elsewhere };
    }
    async lots(q) {
        const c = this.c();
        const bucket = q.bucket ?? 'SALEABLE';
        const rows = await c.$queryRaw `
      SELECT s.sbl_lot_id AS lot_id, l.slt_batch_no AS lot_no, l.slt_expiry_date AS expiry,
             SUM(s.sbl_on_hand_qty) AS owned
        FROM stock.stock_balance s
        LEFT JOIN stock.stock_lot l ON l.slt_id = s.sbl_lot_id
       WHERE s.sbl_company_id = ${q.companyId}::uuid AND s.sbl_branch_id = ${q.branchId}::uuid
         AND s.sbl_godown_id = ${q.godownId}::uuid AND s.sbl_item_id = ${q.itemId}::uuid
         AND s.sbl_bucket = ${bucket} AND s.sbl_is_deleted = false
       GROUP BY s.sbl_lot_id, l.slt_batch_no, l.slt_expiry_date`;
        const bnd = await this.pending.bndByHolding(c, {
            companyId: q.companyId,
            branchId: q.branchId,
            godownIds: [q.godownId],
            itemIds: [q.itemId],
            bucket,
        });
        const bndByLot = new Map(bnd.map((b) => [b.lotId ?? '', b.bndBase]));
        const seen = new Set();
        const lots = rows.map((r) => {
            seen.add(r.lot_id);
            const owned = (0, delivery_pending_service_1.dec)(r.owned);
            const nd = bndByLot.get(r.lot_id) ?? Z;
            return {
                lotId: r.lot_id,
                lotNo: r.lot_no,
                expiryDate: (0, delivery_pending_service_1.ymd)(r.expiry),
                owned: q3(owned),
                notDelivered: q3(nd),
                physical: q3(owned.plus(nd)),
            };
        });
        for (const b of bnd) {
            if (b.lotId && !seen.has(b.lotId)) {
                lots.push({
                    lotId: b.lotId,
                    lotNo: null,
                    expiryDate: null,
                    owned: '0',
                    notDelivered: q3(b.bndBase),
                    physical: q3(b.bndBase),
                });
            }
        }
        lots.sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
        return { lots, unit: 'BASE' };
    }
    async shelvesBase(c, companyId, branchId, holdings) {
        const out = new Map();
        if (holdings.length === 0) {
            return out;
        }
        const godowns = [...new Set(holdings.map((h) => h.godownId))];
        const items = [...new Set(holdings.map((h) => h.itemId))];
        const owned = await c.$queryRaw `
      SELECT sbl_godown_id AS godown_id, sbl_item_id AS item_id, sbl_lot_id AS lot_id,
             sbl_bucket AS bucket, SUM(sbl_on_hand_qty) AS qty
        FROM stock.stock_balance
       WHERE sbl_company_id = ${companyId}::uuid AND sbl_branch_id = ${branchId}::uuid
         AND sbl_godown_id = ANY(${godowns}::uuid[]) AND sbl_item_id = ANY(${items}::uuid[])
         AND sbl_is_deleted = false
       GROUP BY sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket`;
        for (const r of owned) {
            out.set(holdingKey(r.godown_id, r.item_id, r.lot_id, r.bucket), (0, delivery_pending_service_1.dec)(r.qty));
        }
        const bnd = await this.pending.bndByHolding(c, { companyId, branchId, godownIds: godowns, itemIds: items });
        for (const b of bnd) {
            const k = holdingKey(b.godownId, b.itemId, b.lotId, b.bucket);
            out.set(k, (out.get(k) ?? Z).plus(b.bndBase));
        }
        return out;
    }
    async lotsKnown(c, companyId, branchId, asks) {
        if (asks.length === 0) {
            return new Set();
        }
        const rows = await c.$queryRaw `
      SELECT DISTINCT sbl_godown_id AS godown_id, sbl_item_id AS item_id, sbl_lot_id AS lot_id
        FROM stock.stock_balance
       WHERE sbl_company_id = ${companyId}::uuid AND sbl_branch_id = ${branchId}::uuid
         AND sbl_godown_id = ANY(${[...new Set(asks.map((a) => a.godownId))]}::uuid[])
         AND sbl_item_id = ANY(${[...new Set(asks.map((a) => a.itemId))]}::uuid[])
         AND sbl_lot_id = ANY(${[...new Set(asks.map((a) => a.lotId))]}::uuid[])
         AND sbl_is_deleted = false`;
        return new Set(rows.map((r) => `${r.godown_id}|${r.item_id}|${r.lot_id}`));
    }
    async godownName(c, id) {
        const [r] = await c.$queryRaw `
      SELECT gdl_name FROM inventory.godown_locations WHERE gdl_id = ${id}::uuid`;
        return r?.gdl_name ?? '';
    }
    async names(c, q) {
        const items = [...new Set(q.itemIds)];
        const units = [...new Set(q.unitIds)];
        const godowns = [...new Set(q.godownIds.filter((x) => !!x))];
        const lots = [...new Set(q.lotIds.filter((x) => !!x))];
        const [ir, ur, gr, lr, er] = await Promise.all([
            items.length
                ? c.$queryRaw `
            SELECT item_id, item_code, item_name_en, item_default_barcode FROM inventory.item_master
             WHERE item_id = ANY(${items}::uuid[])`
                : Promise.resolve([]),
            units.length
                ? c.$queryRaw `
            SELECT u.iuc_id, um.unit_name FROM inventory.item_unit_conversion u
              LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
             WHERE u.iuc_id = ANY(${units}::uuid[])`
                : Promise.resolve([]),
            godowns.length
                ? c.$queryRaw `
            SELECT gdl_id, gdl_name FROM inventory.godown_locations WHERE gdl_id = ANY(${godowns}::uuid[])`
                : Promise.resolve([]),
            lots.length
                ? c.$queryRaw `
            SELECT slt_id, slt_batch_no FROM stock.stock_lot WHERE slt_id = ANY(${lots}::uuid[])`
                : Promise.resolve([]),
            items.length
                ? c.$queryRaw `
            SELECT ean_item_id, ean_uc_unit_id, ean_code FROM inventory.item_ean_codes
             WHERE ean_item_id = ANY(${items}::uuid[]) AND ean_is_deleted = false
               AND COALESCE(ean_is_active, true) = true`
                : Promise.resolve([]),
        ]);
        const eans = new Map();
        for (const e of er) {
            const k = `${e.ean_item_id}|${e.ean_uc_unit_id ?? ''}`;
            eans.set(k, [...(eans.get(k) ?? []), e.ean_code]);
        }
        return {
            items: new Map(ir.map((r) => [r.item_id, { code: r.item_code, name: r.item_name_en ?? '', barcode: r.item_default_barcode }])),
            units: new Map(ur.map((r) => [r.iuc_id, r.unit_name ?? ''])),
            godowns: new Map(gr.map((r) => [r.gdl_id, r.gdl_name ?? ''])),
            lots: new Map(lr.map((r) => [r.slt_id, r.slt_batch_no])),
            eans,
        };
    }
    async noteEvents(c, sdnId) {
        const rows = await c.$queryRaw `
      SELECT e.sde_src_line_id, e.sde_kind, e.sde_out_qty, e.sde_event_datetime, e.sde_created_by,
             e.sde_reason, COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name) AS by_name
        FROM sales.sale_delivery_event e
        LEFT JOIN public.user_master u ON u.usr_id::text = e.sde_created_by
       WHERE e.sde_src_doc_type = ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE} AND e.sde_src_doc_id = ${sdnId}::uuid
       ORDER BY e.sde_event_datetime`;
        const out = new Map();
        for (const r of rows) {
            const cur = out.get(r.sde_src_line_id) ?? { given: Z, back: Z, cancelled: Z, lastBack: null };
            const q = (0, delivery_pending_service_1.dec)(r.sde_out_qty);
            if (r.sde_kind === 'GIVEN') {
                cur.given = cur.given.plus(q);
            }
            else if (r.sde_kind === 'GOODS_BACK') {
                cur.back = cur.back.minus(q);
                cur.lastBack = {
                    at: istClock(r.sde_event_datetime),
                    by: r.by_name ?? r.sde_created_by,
                    reason: r.sde_reason,
                };
            }
            else if (r.sde_kind === 'CANCEL') {
                cur.cancelled = cur.cancelled.minus(q);
            }
            out.set(r.sde_src_line_id, cur);
        }
        return out;
    }
    async lastGiven(c, billItemIds) {
        const out = new Map();
        if (billItemIds.length === 0) {
            return out;
        }
        const rows = await c.$queryRaw `
      SELECT DISTINCT ON (e.sde_bill_item_id) e.sde_bill_item_id, e.sde_src_refno AS refno,
             e.sde_event_datetime AS at, e.sde_created_by AS created_by,
             COALESCE(NULLIF(u.usr_display_name, ''), u.usr_login_name) AS by_name
        FROM sales.sale_delivery_event e
        LEFT JOIN public.user_master u ON u.usr_id::text = e.sde_created_by
       WHERE e.sde_bill_item_id = ANY(${[...new Set(billItemIds)]}::uuid[])
         AND e.sde_kind IN ('GIVEN', 'CLEANUP') AND e.sde_is_deleted = false
         AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                          WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'CANCEL')
       ORDER BY e.sde_bill_item_id, e.sde_event_datetime DESC`;
        for (const r of rows) {
            out.set(r.sde_bill_item_id, {
                refno: r.refno ?? 'go-live',
                date: istClock(r.at),
                by: r.by_name ?? r.created_by,
            });
        }
        return out;
    }
    async elsewhere(c, bills, godownId, onNote) {
        const facts = (await this.pending.linesOfBills(c, bills)).filter((f) => f.eligible && f.pendingQty.greaterThan(0) && f.godownId !== godownId && !onNote.has(f.billItemId));
        if (facts.length === 0) {
            return [];
        }
        const names = await this.names(c, {
            itemIds: facts.map((f) => f.itemId),
            unitIds: facts.map((f) => f.unitId),
            godownIds: facts.map((f) => f.godownId),
            lotIds: facts.map((f) => f.lotId),
        });
        return facts.map((f) => elsewhereOf(f, names));
    }
    async billsView(c, bills, lineBillIds, elsewhere) {
        if (bills.length === 0) {
            return [];
        }
        const rows = await c.$queryRaw `
      SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_bill_date, b.sb_cust_id, b.sb_cust_name,
             a.arm_name, ct.ctm_name, b.sb_delivery_mode, b.sb_delivery_status,
             (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) FROM public.employee_master em
               WHERE em.emp_id = ANY(b.sb_salesman_id)) AS salesmen
        FROM sales.sale_bill b
        LEFT JOIN sales.customers cu ON cu.cus_id = b.sb_cust_id
        LEFT JOIN sales.area_master a ON a.arm_id = cu.cus_area_id
        LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
       WHERE b.sb_id = ANY(${bills.map((b) => b.billId)}::uuid[])`;
        const here = new Map();
        for (const id of lineBillIds) {
            here.set(id, (here.get(id) ?? 0) + 1);
        }
        const away = new Map();
        for (const e of elsewhere) {
            away.set(e.billId, (away.get(e.billId) ?? 0) + 1);
        }
        const order = new Map(bills.map((b, i) => [b.billId, i]));
        return rows
            .sort((a, b) => (order.get(a.sb_id) ?? 0) - (order.get(b.sb_id) ?? 0))
            .map((r) => ({
            billId: r.sb_id,
            billAccYear: r.sb_acc_year.trim(),
            billRefno: r.sb_bill_refno,
            billDate: (0, delivery_pending_service_1.ymd)(r.sb_bill_date),
            custId: r.sb_cust_id,
            custName: r.sb_cust_name,
            areaName: r.arm_name,
            cityName: r.ctm_name,
            mode: r.sb_delivery_mode,
            salesmanNames: r.salesmen ?? '',
            statusNow: r.sb_delivery_status,
            linesHere: here.get(r.sb_id) ?? 0,
            linesElsewhere: away.get(r.sb_id) ?? 0,
        }));
    }
    async people(c, ids) {
        const list = [...new Set(ids.filter((x) => !!x))];
        if (list.length === 0) {
            return new Map();
        }
        const rows = await c.$queryRaw `
      SELECT emp_id, emp_name FROM public.employee_master WHERE emp_id = ANY(${list}::uuid[])`;
        return new Map(rows.map((r) => [r.emp_id, r.emp_name ?? '']));
    }
    async userNames(c, ids) {
        const list = [...new Set(ids.filter((x) => !!x && UUID.test(x)))];
        if (list.length === 0) {
            return new Map();
        }
        const rows = await c.$queryRaw `
      SELECT usr_id, COALESCE(NULLIF(usr_display_name, ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ANY(${list}::uuid[])`;
        return new Map(rows.map((r) => [r.usr_id, r.name ?? '']));
    }
};
exports.DeliveryNoteReadService = DeliveryNoteReadService;
exports.DeliveryNoteReadService = DeliveryNoteReadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        delivery_pending_service_1.DeliveryPendingService,
        transport_band_service_1.TransportBandService])
], DeliveryNoteReadService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function holdingKey(godownId, itemId, lotId, bucket) {
    return `${godownId}|${itemId}|${lotId ?? ''}|${bucket}`;
}
function uniqBills(bills) {
    const m = new Map();
    for (const b of bills) {
        m.set(`${b.billId}|${b.billAccYear.trim()}`, { billId: b.billId, billAccYear: b.billAccYear.trim() });
    }
    return [...m.values()];
}
function barcodesOf(names, itemId, unitId) {
    const list = [...(names.eans.get(`${itemId}|${unitId}`) ?? [])];
    const def = names.items.get(itemId)?.barcode;
    if (def && !list.includes(def)) {
        list.push(def);
    }
    return list;
}
function lineFromFacts(f, lineNo, godownId, names, shelves, lastGiven) {
    const shelf = shelves.get(holdingKey(godownId, f.itemId, f.lotId, f.bucket)) ?? Z;
    return {
        sdniId: null,
        lineNo,
        billId: f.billId,
        billAccYear: f.billAccYear,
        billRefno: f.billRefno,
        billItemId: f.billItemId,
        billLineNo: f.lineNo,
        itemId: f.itemId,
        itemCode: names.items.get(f.itemId)?.code ?? null,
        itemName: names.items.get(f.itemId)?.name ?? '',
        unitId: f.unitId,
        unitName: names.units.get(f.unitId) ?? '',
        toBaseFactor: f.factor.toString(),
        billGodownId: f.godownId,
        billGodownName: names.godowns.get(f.godownId) ?? '',
        godownId,
        godownName: names.godowns.get(godownId) ?? '',
        billLotId: f.lotId,
        billLotNo: f.lotId ? (names.lots.get(f.lotId) ?? null) : null,
        lotId: f.lotId,
        lotNo: f.lotId ? (names.lots.get(f.lotId) ?? null) : null,
        bucket: f.bucket,
        billedQty: q3(f.billedQty),
        givenBeforeQty: q3(f.givenQty),
        pendingQty: q3(f.pendingQty),
        qty: '0',
        baseQty: '0',
        unitKg: (0, delivery_weight_1.unitKgText)(f.unitKg),
        weightKg: q3((0, delivery_weight_1.lineWeightKg)(Z, f.unitKg)),
        scannedQty: '0',
        goodsBackQty: '0',
        lotSwap: false,
        otherGodown: f.godownId !== godownId,
        otherGodownOk: false,
        shelfQty: q3(f.factor.isZero() ? shelf : shelf.dividedBy(f.factor)),
        barcodes: barcodesOf(names, f.itemId, f.unitId),
        lastGiven: lastGiven.get(f.billItemId) ?? null,
        lastGoodsBack: null,
        remarks: null,
    };
}
function elsewhereOf(f, names) {
    return {
        billId: f.billId,
        billRefno: f.billRefno,
        billItemId: f.billItemId,
        itemName: names.items.get(f.itemId)?.name ?? '',
        godownName: names.godowns.get(f.godownId) ?? '',
        lotNo: f.lotId ? (names.lots.get(f.lotId) ?? null) : null,
        unitName: names.units.get(f.unitId) ?? '',
        unitKg: (0, delivery_weight_1.unitKgText)(f.unitKg),
        billedQty: q3(f.billedQty),
        pendingQty: q3(f.pendingQty),
    };
}
function totalsOfViews(lines, posted) {
    const given = lines.filter((l) => new client_1.Prisma.Decimal(l.qty).greaterThan(0));
    const net = (l) => posted ? new client_1.Prisma.Decimal(l.qty).minus(new client_1.Prisma.Decimal(l.goodsBackQty)) : new client_1.Prisma.Decimal(l.qty);
    const qty = given.reduce((a, l) => a.plus(net(l)), Z);
    const bags = given.filter((l) => /^bag/i.test(l.unitName.trim())).reduce((a, l) => a.plus(net(l)), Z);
    const kg = given.reduce((a, l) => a.plus(new client_1.Prisma.Decimal(l.weightKg)), Z);
    return {
        lines: given.length,
        qty: q3(qty),
        bags: q3(bags),
        weightKg: q3(kg),
        bills: new Set(given.map((l) => l.billId)).size,
    };
}
function istClock(at) {
    const ist = new Date(at.getTime() + 330 * 60_000);
    const dd = String(ist.getUTCDate()).padStart(2, '0');
    const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
    let h = ist.getUTCHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 === 0 ? 12 : h % 12;
    const mi = String(ist.getUTCMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${ist.getUTCFullYear()} ${String(h).padStart(2, '0')}:${mi} ${ampm}`;
}
//# sourceMappingURL=delivery-note-read.service.js.map