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
var DeliveryStockCorrectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryStockCorrectionService = exports.DN_RELOT_RULES = exports.DN_TRANSFER_RULES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const stock_posting_service_1 = require("../../stocks/posting/stock-posting.service");
const stock_voucher_source_1 = require("../../stocks/posting/stock-voucher.source");
const stock_adjustment_rules_1 = require("../../stocks/stock-adjustment/stock-adjustment.rules");
const stock_voucher_numbering_helper_1 = require("../../stocks/stock-voucher/stock-voucher-numbering.helper");
const stock_voucher_types_1 = require("../../stocks/stock-voucher/types/stock-voucher.types");
const stock_error_codes_1 = require("../../stocks/types/stock-error-codes");
const delivery_constants_1 = require("./core/delivery.constants");
const delivery_errors_1 = require("./delivery.errors");
exports.DN_TRANSFER_RULES = {
    voucherType: 'TRANSFER_OUT',
    typeCode: 'TRF',
    displayName: 'Delivery note godown correction',
    requiresToGodown: true,
    requiresFromGodown: true,
    isInward: false,
    ledgerTxnTypes: ['TRANSFER_OUT'],
    quantityMode: 'QTY',
    requiresLot: true,
    zeroesLineCost: true,
    defaultRateSource: 'AVG_COST',
    allowsRepeatHolding: true,
    allowsCount: false,
    allowsToBranch: false,
    allowsLoading: false,
    postShape: 'TRANSFER_OUT',
    auditScreenName: 'Delivery Note',
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.STOCK_TRANSFER,
    refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_IN', 'REPACK_IN', 'REPACK_OUT'],
};
exports.DN_RELOT_RULES = {
    ...stock_adjustment_rules_1.STOCK_ADJUSTMENT_RULES.ADJUSTMENT,
    displayName: 'Delivery note lot swap',
    blockNegative: false,
    auditScreenName: 'Delivery Note',
};
let DeliveryStockCorrectionService = DeliveryStockCorrectionService_1 = class DeliveryStockCorrectionService {
    stockPosting;
    constructor(stockPosting) {
        this.stockPosting = stockPosting;
    }
    static needs(l) {
        return {
            move: l.givingGodownId !== l.billGodownId,
            swap: !!l.givenLotId && !!l.billLotId && l.givenLotId !== l.billLotId,
        };
    }
    async post(tx, doc, lines, actor, opts) {
        const active = lines.filter((l) => l.qty.greaterThan(0));
        const moves = active.filter((l) => DeliveryStockCorrectionService_1.needs(l).move);
        const swaps = active.filter((l) => DeliveryStockCorrectionService_1.needs(l).swap);
        if (moves.length === 0 && swaps.length === 0) {
            return [];
        }
        const units = await this.units(tx, active.map((l) => l.iucId));
        const reasons = await this.reasonIds(tx);
        const out = [];
        const transfer = async () => {
            const groups = new Map();
            for (const l of moves) {
                const from = opts.undo ? l.billGodownId : l.givingGodownId;
                const to = opts.undo ? l.givingGodownId : l.billGodownId;
                const k = `${from}|${to}`;
                groups.set(k, [...(groups.get(k) ?? []), l]);
            }
            for (const [k, group] of groups) {
                const [from, to] = k.split('|');
                const missingLot = group.find((l) => !l.givenLotId);
                if (missingLot) {
                    (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_LOT_INVALID, `Line ${missingLot.lineNo}: a godown move needs the lot given; none is known for this line`, `lines[${missingLot.lineNo - 1}].lotId`, { n: missingLot.lineNo, lot: '', item: '', godown: '' }, missingLot.lineNo);
                }
                const svh = await this.writeShadow(tx, doc, actor, {
                    rules: exports.DN_TRANSFER_RULES,
                    fromGodownId: from,
                    toGodownId: to,
                    reasonId: reasons.godown,
                    remarks: `${opts.undo ? 'Goods back: ' : ''}${doc.refno} given from another godown`,
                    lines: group.map((l) => ({
                        l,
                        godownId: from,
                        lotId: l.givenLotId,
                        reasonId: null,
                        direction: null,
                    })),
                    units,
                });
                await this.postShadow(tx, doc, svh.svhId, exports.DN_TRANSFER_RULES, actor);
                out.push({
                    kind: 'GODOWN_MOVE',
                    svhId: svh.svhId,
                    svhRefno: svh.refno,
                    lineNos: group.map((l) => l.lineNo),
                    ...(opts.undo ? { undo: true } : {}),
                });
            }
        };
        const relot = async () => {
            const groups = new Map();
            for (const l of swaps) {
                groups.set(l.billGodownId, [...(groups.get(l.billGodownId) ?? []), l]);
            }
            for (const [godown, group] of groups) {
                const pair = group.flatMap((l) => {
                    const outLot = opts.undo ? l.billLotId : l.givenLotId;
                    const inLot = opts.undo ? l.givenLotId : l.billLotId;
                    return [
                        { l, godownId: godown, lotId: outLot, reasonId: reasons.relotOut, direction: -1 },
                        { l, godownId: godown, lotId: inLot, reasonId: reasons.relotIn, direction: 1 },
                    ];
                });
                const svh = await this.writeShadow(tx, doc, actor, {
                    rules: exports.DN_RELOT_RULES,
                    fromGodownId: godown,
                    toGodownId: null,
                    reasonId: null,
                    remarks: `${opts.undo ? 'Goods back: ' : ''}${doc.refno} given from another lot`,
                    lines: pair,
                    units,
                });
                await this.postShadow(tx, doc, svh.svhId, exports.DN_RELOT_RULES, actor);
                out.push({
                    kind: 'LOT_SWAP',
                    svhId: svh.svhId,
                    svhRefno: svh.refno,
                    lineNos: group.map((l) => l.lineNo),
                    ...(opts.undo ? { undo: true } : {}),
                });
            }
        };
        if (opts.undo) {
            await relot();
            await transfer();
        }
        else {
            await transfer();
            await relot();
        }
        return out;
    }
    async cancelAll(tx, q, actor, reason, cancelledOn) {
        const shadows = await tx.$queryRaw `
      SELECT svh_id, svh_acc_year, svh_voucher_type
        FROM stock.stock_voucher
       WHERE svh_link_src_module   = 'SALES'
         AND svh_link_src_doc_type = ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE}
         AND svh_link_src_doc_id   = ${q.sdnId}::uuid
         AND svh_status            = 'POSTED'
         AND svh_is_deleted        = false
       ORDER BY svh_created_on DESC, svh_slno DESC`;
        let n = 0;
        for (const s of shadows) {
            const rules = s.svh_voucher_type === 'TRANSFER_OUT' ? exports.DN_TRANSFER_RULES : exports.DN_RELOT_RULES;
            try {
                n += await this.stockPosting.cancel(tx, new stock_voucher_source_1.StockVoucherSource({
                    svhId: s.svh_id,
                    accYear: s.svh_acc_year.trim(),
                    companyId: q.companyId,
                    branchId: q.branchId,
                    rules,
                }), {
                    actor,
                    reason,
                    cancelledOn,
                    ledgerSource: { srcModule: 'SALES', srcDocType: delivery_constants_1.DELIVERY_NOTE_DOC_TYPE },
                });
            }
            catch (error) {
                this.mapEngineRefusal(error);
            }
        }
        return n;
    }
    async postShadow(tx, doc, svhId, rules, actor) {
        try {
            await this.stockPosting.post(tx, new stock_voucher_source_1.StockVoucherSource({
                svhId,
                accYear: doc.shadowAccYear,
                companyId: doc.companyId,
                branchId: doc.branchId,
                rules,
            }), {
                actor,
                postedOn: doc.docDatetime,
                ledgerSource: {
                    srcModule: 'SALES',
                    srcDocType: delivery_constants_1.DELIVERY_NOTE_DOC_TYPE,
                    srcRefno: doc.refno,
                    partyId: null,
                },
            });
        }
        catch (error) {
            this.mapEngineRefusal(error);
        }
    }
    mapEngineRefusal(error) {
        if (error instanceof common_1.ConflictException || error instanceof common_1.UnprocessableEntityException) {
            const body = error.getResponse();
            const codes = (body?.errors ?? []).map((e) => e.code);
            const text = (body?.errors ?? []).map((e) => e.message).filter(Boolean).join('; ') ||
                body?.message ||
                'the stock engine refused the correction';
            if (codes.includes(stock_error_codes_1.StockErrorCode.GODOWN_FROZEN)) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GODOWN_FROZEN, text, 'sdnGodownId', { godown: '', from: '', to: '' });
            }
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_STOCK_NEGATIVE, text, 'lines', { n: '', qty: '', unit: '', lot: '', godown: '' });
        }
        throw error;
    }
    async reasonIds(tx) {
        const rows = await tx.$queryRaw `
      SELECT srm_id, srm_code FROM stock.stock_reason_master
       WHERE srm_company_id IS NULL AND srm_is_deleted = false
         AND srm_code IN (${stock_voucher_types_1.RELOT_REASON_CODES.out}, ${stock_voucher_types_1.RELOT_REASON_CODES.in}, ${delivery_constants_1.DELIVERY_GODOWN_REASON_CODE})`;
        const by = new Map(rows.map((r) => [r.srm_code, r.srm_id]));
        const relotOut = by.get(stock_voucher_types_1.RELOT_REASON_CODES.out);
        const relotIn = by.get(stock_voucher_types_1.RELOT_REASON_CODES.in);
        const godown = by.get(delivery_constants_1.DELIVERY_GODOWN_REASON_CODE);
        if (!relotOut || !relotIn || !godown) {
            throw new Error('Delivery corrections need the system stock reasons RELOT_OUT, RELOT_IN and DELIVERY_GODOWN (stock_reason_master, company NULL)');
        }
        return { relotOut, relotIn, godown };
    }
    async units(tx, iucIds) {
        const ids = [...new Set(iucIds)];
        const rows = await tx.$queryRaw `
      SELECT iuc.iuc_id, COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN LATERAL (
          SELECT b.iuc_id FROM inventory.item_unit_conversion b
           WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit = true
             AND b.iuc_is_deleted = false
           ORDER BY b.iuc_unit_slno LIMIT 1
        ) base ON true
       WHERE iuc.iuc_id = ANY(${ids}::uuid[])`;
        return new Map(rows.map((r) => [r.iuc_id, r]));
    }
    async writeShadow(tx, doc, actor, v) {
        const slno = await (0, stock_voucher_numbering_helper_1.nextStockVoucherSlno)(tx, {
            companyId: doc.companyId,
            branchId: doc.branchId,
            accYear: doc.shadowAccYear,
            voucherType: v.rules.voucherType,
            deviceId: doc.deviceId,
        });
        const [seq] = await tx.$queryRaw `
      SELECT count(*)::int + 1 AS n FROM stock.stock_voucher
       WHERE svh_link_src_doc_type = ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE}
         AND svh_link_src_doc_id = ${doc.sdnId}::uuid`;
        const refno = `${doc.refno}/C${seq?.n ?? 1}`;
        const author = actor === '00000000-0000-0000-0000-000000000000' ? null : actor;
        const total = v.lines.reduce((a, x) => a.plus(x.l.qty), new client_1.Prisma.Decimal(0));
        const [header] = await tx.$queryRaw `
      INSERT INTO stock.stock_voucher (
        svh_company_id, svh_branch_id, svh_tenant_id, svh_acc_year, svh_device_id,
        svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
        svh_from_godown_id, svh_to_godown_id, svh_reason_id,
        svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
        svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by
      ) VALUES (
        ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId}::uuid, ${doc.shadowAccYear}::bpchar,
        ${doc.deviceId}::uuid,
        ${v.rules.voucherType}, ${slno}::bigint, ${refno}, ${doc.refno},
        ${doc.docDate}::date, ${doc.docDatetime},
        ${v.fromGodownId}::uuid, ${v.toGodownId}::uuid, ${v.reasonId}::uuid,
        'SALES', ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE}, ${doc.sdnId}::uuid, ${doc.noteAccYear}::bpchar,
        ${v.lines.length}::int, ${total}::numeric,
        'DRAFT', 'AVG_COST', ${v.remarks.slice(0, 250)}, ${doc.docDatetime}, ${author}
      )
      RETURNING svh_id`;
        const svhId = header.svh_id;
        const values = v.lines.map((x, i) => {
            const u = v.units.get(x.l.iucId);
            if (!u) {
                throw new Error(`Delivery correction: unit conversion ${x.l.iucId} not found`);
            }
            const base = x.l.qty.times(x.l.factor).toDecimalPlaces(6);
            return client_1.Prisma.sql `(
        ${svhId}::uuid, ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId}::uuid,
        ${doc.shadowAccYear}::bpchar, ${i + 1}::int, 1,
        ${x.l.itemId}::uuid, ${u.iuc_id}::uuid, ${u.base_iuc_id}::uuid, ${x.l.factor}::numeric,
        ${x.godownId}::uuid, ${x.lotId}::uuid, ${x.l.bucket},
        ${x.l.qty}::numeric, ${base}::numeric, 0, 0, 0, 0, 0, 0,
        ${x.reasonId}::uuid, ${x.direction}::smallint,
        ${`Delivery note line ${x.l.lineNo}`},
        ${doc.docDatetime}, ${author}
      )`;
        });
        await tx.$executeRaw `
      INSERT INTO stock.stock_voucher_item (
        svi_voucher_id, svi_company_id, svi_branch_id, svi_tenant_id,
        svi_acc_year, svi_line_no, svi_split_no,
        svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
        svi_godown_id, svi_lot_id, svi_bucket,
        svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty, svi_weight_qty,
        svi_cost_rate, svi_cost_rate_wot, svi_tax_perc,
        svi_reason_id, svi_direction, svi_remarks,
        svi_created_on, svi_created_by
      ) VALUES ${client_1.Prisma.join(values)}`;
        return { svhId, refno };
    }
};
exports.DeliveryStockCorrectionService = DeliveryStockCorrectionService;
exports.DeliveryStockCorrectionService = DeliveryStockCorrectionService = DeliveryStockCorrectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stock_posting_service_1.StockPostingService])
], DeliveryStockCorrectionService);
//# sourceMappingURL=delivery-stock-correction.service.js.map