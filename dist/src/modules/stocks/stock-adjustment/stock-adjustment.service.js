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
exports.StockAdjustmentService = void 0;
exports.adjustmentIsoDate = isoDate;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const stock_voucher_service_1 = require("../stock-voucher/stock-voucher.service");
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
const stock_voucher_types_1 = require("../stock-voucher/types/stock-voucher.types");
const stock_adjustment_rules_1 = require("./stock-adjustment.rules");
let StockAdjustmentService = class StockAdjustmentService {
    prisma;
    stockVoucherService;
    requestContextService;
    appSettings;
    constructor(prisma, stockVoucherService, requestContextService, appSettings) {
        this.prisma = prisma;
        this.stockVoucherService = stockVoucherService;
        this.requestContextService = requestContextService;
        this.appSettings = appSettings;
    }
    async save(dto) {
        const kind = dto.header.voucherType;
        const rules = stock_adjustment_rules_1.STOCK_ADJUSTMENT_RULES[kind];
        const linkModule = dto.header.linkSrcModule?.trim() || null;
        if (linkModule && linkModule !== stock_voucher_types_1.STOCK_SRC_MODULE) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be saved`, [
                {
                    field: 'header.linkSrcModule',
                    message: `An adjustment is the stock module's own document: linkSrcModule may be ${stock_voucher_types_1.STOCK_SRC_MODULE} or empty, not ${linkModule}. A ${linkModule} document moves its stock through its own module.`,
                },
            ]);
        }
        const header = {
            kind,
            companyId: dto.header.companyId,
            branchId: dto.header.branchId,
            docDate: dto.header.docDate,
            fromGodownId: dto.header.fromGodownId ?? null,
            toGodownId: dto.header.toGodownId ?? null,
            reasonId: dto.header.reasonId ?? null,
            remarks: dto.header.remarks ?? null,
        };
        const lines = dto.lines.map((line, index) => {
            const baseQty = Number(line.baseQty ?? 0);
            const qty = Number(line.qty ?? 0);
            const sign = qty < 0 || baseQty < 0 ? -1 : qty > 0 || baseQty > 0 ? 1 : 0;
            return {
                index,
                lineNo: line.lineNo,
                sviId: null,
                itemId: line.itemId,
                itemName: null,
                godownId: line.godownId,
                lotId: line.lotId ?? null,
                bucket: line.bucket ?? 'SALEABLE',
                toBucket: line.toBucket ?? null,
                keyedNegative: sign < 0,
                baseQty: Math.abs(baseQty),
                freeBaseQty: Math.abs(Number(line.freeBaseQty ?? 0)) + Math.abs(Number(line.freeQty ?? 0)),
                sign,
                reasonId: line.reasonId ?? header.reasonId,
                remarks: line.remarks?.trim() || header.remarks?.trim() || null,
                baseUomId: line.baseUomId,
                identity: {
                    batchNo: line.batchNo ?? null,
                    mrp: line.mrp === null || line.mrp === undefined ? null : String(line.mrp),
                    salePrice: line.salePrice === null || line.salePrice === undefined ? null : String(line.salePrice),
                    expiryDate: line.expiryDate ? line.expiryDate.slice(0, 10) : null,
                    serialNo: line.serialNo ?? null,
                    supplierId: line.supplierId ?? null,
                },
            };
        });
        const reasons = await this.loadReasons(header.companyId, lines);
        const verdict = await this.check(header, lines, reasons);
        this.refuse(rules, `This ${rules.displayName.toLowerCase()} cannot be saved`, verdict, lines);
        const relot = lines.some((line) => this.isRelot(reasons, line));
        const carried = relot || kind === stock_adjustment_rules_1.BUCKET_MOVE_KIND;
        const mapped = {
            header: {
                ...dto.header,
                voucherType: rules.voucherType,
                rateSource: carried ? 'AVG_COST' : (dto.header.rateSource ?? undefined),
            },
            lines: dto.lines.map((line, index) => this.toSharedLine(kind, line, lines[index], reasons)),
        };
        return this.stockVoucherService.save(rules, mapped);
    }
    toSharedLine(kind, line, view, reasons) {
        const direction = this.directionOf(view, reasons);
        const outward = direction < 0;
        return {
            lineNo: line.lineNo,
            itemId: line.itemId,
            uomId: line.uomId,
            baseUomId: line.baseUomId,
            toBaseFactor: line.toBaseFactor,
            qty: Math.abs(Number(line.qty)),
            baseQty: Math.abs(Number(line.baseQty)),
            freeQty: 0,
            freeBaseQty: 0,
            godownId: line.godownId,
            lotId: line.lotId ?? null,
            bucket: line.bucket ?? 'SALEABLE',
            toBucket: kind === stock_adjustment_rules_1.BUCKET_MOVE_KIND ? (line.toBucket ?? null) : null,
            barcode: line.barcode ?? null,
            batchNo: line.batchNo ?? null,
            mfgDate: line.mfgDate ?? null,
            expiryDate: line.expiryDate ?? null,
            mrp: line.mrp ?? null,
            salePrice: line.salePrice ?? null,
            serialNo: line.serialNo ?? null,
            supplierId: line.supplierId ?? null,
            costRate: outward || this.isRelot(reasons, view) ? 0 : (line.costRate ?? 0),
            costRateWot: outward || this.isRelot(reasons, view) ? 0 : (line.costRateWot ?? 0),
            taxPerc: line.taxPerc ?? 0,
            reasonId: line.reasonId ?? null,
            remarks: line.remarks ?? null,
            direction: kind === stock_adjustment_rules_1.BUCKET_MOVE_KIND ? -1 : kind === 'ADJUSTMENT' ? direction : null,
        };
    }
    async getOne(svhId, accYear, companyId, branchId) {
        const { rules, docKind } = await this.kindOf(svhId, accYear, companyId, branchId);
        const payload = await this.stockVoucherService.getById(rules, svhId, accYear, companyId, branchId);
        return { ...payload, kind: docKind };
    }
    async validate(svhId, accYear, companyId, branchId) {
        const { rules, header } = await this.kindOf(svhId, accYear, companyId, branchId);
        const shared = await this.stockVoucherService.validate(rules, svhId, accYear, companyId, branchId);
        const lines = await this.loadLines(svhId, accYear, header);
        const reasons = await this.loadReasons(companyId, lines);
        const verdict = await this.check(header, lines, reasons);
        const byLineNo = new Map();
        for (const [index, message] of verdict) {
            byLineNo.set(lines[index].lineNo, message);
        }
        return shared.map((row) => ({ ...row, problem: byLineNo.get(row.lineNo) ?? row.problem }));
    }
    async post(args) {
        const { rules, header, docKind } = await this.kindOf(args.svhId, args.accYear, args.companyId, args.branchId);
        const lines = await this.loadLines(args.svhId, args.accYear, header);
        const reasons = await this.loadReasons(args.companyId, lines);
        const verdict = await this.check(header, lines, reasons);
        this.refuse(rules, `This ${rules.displayName.toLowerCase()} cannot be posted`, verdict, lines);
        return this.stockVoucherService.post(rules, args.svhId, args.accYear, args.companyId, args.branchId, args.userId, docKind === 'RELOT' ? (tx) => this.assertRelotLandsElsewhere(tx, rules, args.svhId, args.accYear) : undefined);
    }
    async cancel(args) {
        const { rules } = await this.kindOf(args.svhId, args.accYear, args.companyId, args.branchId);
        return this.stockVoucherService.cancel(rules, args.svhId, args.accYear, args.reason, args.companyId, args.branchId, args.userId);
    }
    async remove(svhId, accYear, companyId, branchId, userId) {
        const { rules } = await this.kindOf(svhId, accYear, companyId, branchId);
        return this.stockVoucherService.softDelete(rules, svhId, accYear, companyId, branchId, userId);
    }
    async pickStock(query) {
        const search = query.search?.trim() ? `%${query.search.trim()}%` : null;
        const rows = await this.prisma.$queryRaw `
      SELECT b.sbl_id, b.sbl_item_id, itm.item_code, itm.item_name_en AS item_name,
             b.sbl_godown_id, b.sbl_lot_id, b.sbl_bucket,
             slt.slt_batch_no, slt.slt_mfg_date, slt.slt_expiry_date, slt.slt_mrp, slt.slt_sale_price, slt.slt_serial_no,
             slt.slt_supplier_id, sup.sup_name,
             b.sbl_base_uom_id, unt.unit_name,
             b.sbl_on_hand_qty, b.sbl_reserved_qty, b.sbl_available_qty,
             b.sbl_avg_cost_rate, b.sbl_stock_value, b.sbl_first_in_date
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        JOIN inventory.item_master itm ON itm.item_id = b.sbl_item_id
        LEFT JOIN purchase.suppliers sup ON sup.sup_id = slt.slt_supplier_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbl_base_uom_id
        LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
       WHERE b.sbl_company_id = ${query.companyId}::uuid
         AND b.sbl_branch_id  = ${query.branchId}::uuid
         AND b.sbl_godown_id  = ${query.godownId}::uuid
         AND b.sbl_is_deleted = false
         AND b.sbl_available_qty > 0
         AND (${query.itemId ?? null}::uuid IS NULL OR b.sbl_item_id = ${query.itemId ?? null}::uuid)
         AND (${query.bucket ?? null}::text IS NULL OR b.sbl_bucket = ${query.bucket ?? null}::text)
         AND (${search}::text IS NULL
              OR itm.item_name_en ILIKE ${search}::text
              OR itm.item_code ILIKE ${search}::text
              OR slt.slt_batch_no ILIKE ${search}::text)
       ORDER BY itm.item_name_en, slt.slt_expiry_date NULLS LAST, b.sbl_first_in_date NULLS LAST, slt.slt_batch_no,
                b.sbl_bucket
       LIMIT ${query.limit ?? 200}
    `;
        return rows.map((r) => ({
            sblId: r.sbl_id,
            itemId: r.sbl_item_id,
            itemCode: r.item_code,
            itemName: r.item_name,
            godownId: r.sbl_godown_id,
            lotId: r.sbl_lot_id,
            bucket: r.sbl_bucket,
            batchNo: r.slt_batch_no,
            mfgDate: isoDate(r.slt_mfg_date),
            expiryDate: isoDate(r.slt_expiry_date),
            mrp: r.slt_mrp === null ? null : Number(r.slt_mrp),
            salePrice: r.slt_sale_price === null ? null : Number(r.slt_sale_price),
            serialNo: r.slt_serial_no,
            supplierId: r.slt_supplier_id,
            supplierName: r.sup_name,
            baseUomId: r.sbl_base_uom_id,
            unitName: r.unit_name,
            onHandQty: Number(r.sbl_on_hand_qty ?? 0),
            reservedQty: Number(r.sbl_reserved_qty),
            availableQty: Number(r.sbl_available_qty ?? 0),
            avgCostRate: Number(r.sbl_avg_cost_rate),
            stockValue: Number(r.sbl_stock_value),
            firstInDate: isoDate(r.sbl_first_in_date),
        }));
    }
    async check(header, lines, reasons) {
        const out = new Map();
        const say = (line, message) => {
            if (!out.has(line.index)) {
                out.set(line.index, `Line ${line.lineNo}: ${message}`);
            }
        };
        const kind = header.kind;
        const docGodown = this.documentGodown(header);
        for (const line of lines) {
            if (docGodown && line.godownId !== docGodown) {
                say(line, 'sits in a different godown from the document. One adjustment, one godown.');
            }
            if (line.freeBaseQty > 0) {
                say(line, 'carries a free quantity. An adjustment has no free goods: state the quantity.');
            }
            if (line.baseQty <= 0) {
                say(line, 'has no quantity.');
            }
        }
        const moving = kind === stock_adjustment_rules_1.BUCKET_MOVE_KIND;
        for (const line of lines) {
            if (!moving) {
                if (line.toBucket) {
                    say(line, `names a bucket to move to (${line.toBucket}), but this is a ${stock_adjustment_rules_1.STOCK_ADJUSTMENT_RULES[kind].displayName.toLowerCase()}. A document is all moves or none: key the move as Move stock.`);
                }
                continue;
            }
            if (line.keyedNegative) {
                say(line, 'moves a negative quantity. State the quantity moved; the buckets say which way it goes.');
            }
            else if (!line.toBucket) {
                say(line, `names no bucket to move to. A move takes the stock out of ${line.bucket} and into another bucket — name it (toBucket). A document is all moves or none.`);
            }
            else if (line.toBucket === line.bucket) {
                say(line, `moves stock from ${line.bucket} into ${line.bucket}. Pick a different bucket.`);
            }
            else if (!line.lotId) {
                say(line, 'names no lot. A move is about one lot — the lot is what names the supplier the stock goes back to. Pick it from the balance.');
            }
        }
        for (const line of lines) {
            const reason = line.reasonId ? reasons.get(line.reasonId) : undefined;
            if (!line.reasonId) {
                say(line, 'names no reason, and the header names none either. Every adjustment line says why.');
                continue;
            }
            if (!reason) {
                say(line, `names a reason (${line.reasonId}) this company cannot see.`);
                continue;
            }
            if (!reason.srm_is_active) {
                say(line, `cites ${reason.srm_code} (${reason.srm_name}), which is inactive.`);
                continue;
            }
            if (moving) {
                if (!this.allowsMove(reason)) {
                    say(line, `cites ${reason.srm_code} (${reason.srm_name}), which is not a stock-move reason. Cite MOVE_DAMAGED, MOVE_SALEABLE or a reason of your own that allows BUCKET_OUT / BUCKET_IN.`);
                }
                else if (reason.srm_require_remarks && !line.remarks) {
                    say(line, `cites ${reason.srm_code} (${reason.srm_name}), which requires a remark saying what happened.`);
                }
                continue;
            }
            if (this.onlyMove(reason)) {
                say(line, `cites ${reason.srm_code} (${reason.srm_name}), a stock-move reason. Key it as Move stock and name the bucket the stock moves to.`);
                continue;
            }
            if (kind !== 'ADJUSTMENT' && reason.srm_direction === 'IN') {
                say(line, `cites ${reason.srm_code} (${reason.srm_name}), which brings stock IN. A ${stock_adjustment_rules_1.STOCK_ADJUSTMENT_RULES[kind].displayName.toLowerCase()} only takes stock out.`);
                continue;
            }
            if (reason.srm_direction === 'IN' && line.sign < 0) {
                say(line, `cites ${reason.srm_code} (${reason.srm_name}), which brings stock IN, with a negative quantity.`);
                continue;
            }
            if (reason.srm_direction === 'BOTH' && kind === 'ADJUSTMENT' && line.sign === 0) {
                say(line, `cites ${reason.srm_code} (${reason.srm_name}), whose direction is BOTH: the quantity must be signed (+ in, − out).`);
                continue;
            }
            if (reason.srm_require_remarks && !line.remarks) {
                say(line, `cites ${reason.srm_code} (${reason.srm_name}), which requires a remark saying what happened.`);
                continue;
            }
        }
        const lotIds = [...new Set(lines.map((l) => l.lotId).filter((id) => !!id))];
        const lots = await this.loadLots(lotIds);
        const wanted = new Map();
        for (const line of lines) {
            if (line.lotId && this.directionOf(line, reasons) < 0) {
                const key = `${line.lotId}|${line.godownId}|${line.bucket}`;
                wanted.set(key, (wanted.get(key) ?? 0) + line.baseQty);
            }
        }
        const available = await this.loadAvailable(header.companyId, header.branchId, [...wanted.keys()]);
        const graceDays = kind === 'EXPIRY_WRITEOFF' ? await this.expiryGraceDays(header.companyId, header.branchId) : 0;
        const cutoff = addDays(header.docDate, graceDays);
        const shortReported = new Set();
        for (const line of lines) {
            if (out.has(line.index)) {
                continue;
            }
            const direction = this.directionOf(line, reasons);
            if (kind === 'EXPIRY_WRITEOFF' && !line.lotId) {
                say(line, 'names no lot. An expiry write-off is about one lot and its expiry date — pick it from the balance.');
                continue;
            }
            if (!line.lotId) {
                continue;
            }
            const lot = lots.get(line.lotId);
            if (!lot) {
                say(line, 'names a lot that does not exist. Pick the holding from the balance.');
                continue;
            }
            if (lot.slt_item_id !== line.itemId) {
                say(line, 'names a lot that belongs to a different item.');
                continue;
            }
            if (kind === 'EXPIRY_WRITEOFF') {
                if (!lot.slt_expiry_date) {
                    say(line, `lot ${lot.slt_batch_no ?? line.lotId} has no expiry date. Use a damage write-off.`);
                    continue;
                }
                const expiry = isoDate(lot.slt_expiry_date);
                if (expiry > cutoff) {
                    say(line, `lot ${lot.slt_batch_no ?? line.lotId} expires on ${expiry}, after ${cutoff}${graceDays ? ` (document date + ${graceDays} days' grace)` : ''}. Not expired yet: use a damage write-off.`);
                    continue;
                }
            }
            if (direction < 0) {
                const key = `${line.lotId}|${line.godownId}|${line.bucket}`;
                const have = available.get(key) ?? 0;
                const asked = wanted.get(key) ?? 0;
                if (asked > have && !shortReported.has(key)) {
                    shortReported.add(key);
                    say(line, `${moving ? 'moves' : 'takes'} ${asked} but this godown holds ${have} of ${lot.slt_batch_no ? `batch ${lot.slt_batch_no}` : 'that lot'} in the ${line.bucket} bucket. ${moving ? 'Moving stock you do not have is a data error.' : 'Writing off stock you do not have is a data error, not a sale.'}`);
                }
            }
        }
        if (kind === 'ADJUSTMENT') {
            const relotLines = lines.filter((l) => this.isRelot(reasons, l));
            if (relotLines.length) {
                const perItem = new Map();
                for (const line of relotLines) {
                    const code = reasons.get(line.reasonId)?.srm_code;
                    const bucket = perItem.get(line.itemId) ?? { out: 0, in: 0, outLots: new Set(), inLots: new Set(), uoms: new Set(), first: line };
                    bucket.uoms.add(line.baseUomId);
                    if (code === stock_adjustment_rules_1.RELOT_OUT_CODE) {
                        bucket.out += line.baseQty;
                        if (!line.lotId) {
                            say(line, 'is the OUT half of a re-lot and must name the lot it leaves.');
                        }
                        else {
                            bucket.outLots.add(line.lotId);
                        }
                    }
                    else {
                        bucket.in += line.baseQty;
                        if (line.lotId) {
                            bucket.inLots.add(line.lotId);
                        }
                    }
                    perItem.set(line.itemId, bucket);
                }
                for (const [, pair] of perItem) {
                    const line = pair.first;
                    if (Math.abs(pair.out - pair.in) > 0.000001) {
                        say(line, `re-lot does not balance for this item: ${pair.out} out of the old lot against ${pair.in} into the new one. A half on its own is shrinkage — cite PILFERAGE or DAMAGE instead.`);
                    }
                    else if ([...pair.inLots].some((id) => pair.outLots.has(id))) {
                        say(line, 're-lot moves stock from a lot into the same lot. The IN half states the CORRECT identity.');
                    }
                    else if (pair.uoms.size > 1) {
                        say(line, 're-lot halves are keyed in different base units.');
                    }
                }
                const lotlessIn = relotLines.filter((l) => !l.lotId && !out.has(l.index) && reasons.get(l.reasonId)?.srm_code === stock_adjustment_rules_1.RELOT_IN_CODE);
                const resolved = await this.resolveInwardLots(header, lotlessIn);
                for (const line of lotlessIn) {
                    const landsOn = resolved.get(line.index)?.lotId;
                    if (!landsOn || !perItem.get(line.itemId)?.outLots.has(landsOn)) {
                        continue;
                    }
                    const tracked = resolved.get(line.index)?.tracked ?? [];
                    say(line, tracked.length === 0
                        ? 're-lots an item that tracks no lot identity (no batch, expiry, MRP, sale price, serial or supplier): all of its stock in a bucket is one lot, so the IN half lands back on the lot the OUT half leaves. There is nothing to re-lot — change the item\'s tracking policy first if it should carry an identity.'
                        : `re-lot lands back on the lot the OUT half leaves: this item tracks ${tracked.join(', ')}, and the IN half states the same ${tracked.length === 1 ? 'value' : 'values'} as that lot. State the CORRECT identity.`);
                }
            }
        }
        return out;
    }
    async resolveInwardLots(header, lines) {
        if (lines.length === 0) {
            return new Map();
        }
        const stated = JSON.stringify(lines.map((l) => ({
            idx: l.index,
            item_id: l.itemId,
            batch_no: l.identity.batchNo,
            mrp: l.identity.mrp,
            sale_price: l.identity.salePrice,
            expiry_date: l.identity.expiryDate,
            serial_no: l.identity.serialNo,
            supplier_id: l.identity.supplierId,
        })));
        const rows = await this.prisma.$queryRaw `
      WITH line AS (
        SELECT u.idx                         AS svi_id,
               u.item_id                     AS svi_item_id,
               ${header.companyId}::uuid     AS svh_company_id,
               ${header.branchId}::uuid      AS svh_branch_id,
               ${header.docDate}::date       AS svh_doc_date,
               u.batch_no                    AS svi_batch_no,
               u.mrp                         AS svi_mrp,
               u.sale_price                  AS svi_sale_price,
               u.expiry_date                 AS svi_expiry_date,
               u.serial_no                   AS svi_serial_no,
               u.supplier_id                 AS svi_supplier_id
          FROM jsonb_to_recordset(${stated}::jsonb)
               AS u(idx int, item_id uuid, batch_no text, mrp numeric, sale_price numeric,
                    expiry_date date, serial_no text, supplier_id uuid)
      ),
      ${(0, stock_voucher_posting_helper_1.effectivePolicyCte)()},
      keyed AS (
        SELECT line.svi_id, line.svi_item_id, line.svh_company_id,
               policy.track_batch, policy.track_mrp, policy.track_sale_price,
               policy.track_expiry, policy.track_serial, policy.track_supplier,
               ${(0, stock_voucher_posting_helper_1.lotIdentityKeyColumns)()}
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
      )
      SELECT k.svi_id AS idx, slt.slt_id AS lot_id,
             k.track_batch, k.track_mrp, k.track_sale_price, k.track_expiry, k.track_serial, k.track_supplier
        FROM keyed k
        LEFT JOIN stock.stock_lot slt
          ON slt.slt_company_id   = k.svh_company_id
         AND slt.slt_item_id      = k.svi_item_id
         AND slt.slt_key_batch    = k.key_batch
         AND slt.slt_key_mrp      = k.key_mrp
         AND slt.slt_key_sp       = k.key_sp
         AND slt.slt_key_expiry   = k.key_expiry
         AND slt.slt_key_serial   = k.key_serial
         AND slt.slt_key_supplier = k.key_supplier
         AND slt.slt_is_deleted   = false
    `;
        return new Map(rows.map((r) => [
            Number(r.idx),
            {
                lotId: r.lot_id,
                tracked: [
                    r.track_batch && 'batch',
                    r.track_expiry && 'expiry',
                    r.track_mrp && 'MRP',
                    r.track_sale_price && 'sale price',
                    r.track_serial && 'serial',
                    r.track_supplier && 'supplier',
                ].filter((t) => !!t),
            },
        ]));
    }
    async assertRelotLandsElsewhere(tx, rules, svhId, accYear) {
        const same = await tx.$queryRaw `
      WITH relot AS (
        SELECT i.svi_line_no, i.svi_item_id, i.svi_lot_id, rm.srm_code
          FROM stock.stock_voucher_item i
          JOIN stock.stock_voucher h
            ON h.svh_id = i.svi_voucher_id AND h.svh_acc_year = i.svi_acc_year
          JOIN stock.stock_reason_master rm
            ON rm.srm_id = COALESCE(i.svi_reason_id, h.svh_reason_id)
         WHERE i.svi_voucher_id = ${svhId}::uuid AND i.svi_acc_year = ${accYear}::bpchar
           AND i.svi_is_deleted = false
           AND rm.srm_code IN (${stock_adjustment_rules_1.RELOT_OUT_CODE}, ${stock_adjustment_rules_1.RELOT_IN_CODE})
      )
      SELECT DISTINCT ON (i_in.svi_line_no)
             i_in.svi_line_no AS in_line_no, o.svi_line_no AS out_line_no, itm.item_name_en AS item_name
        FROM relot i_in
        JOIN relot o
          ON o.svi_item_id = i_in.svi_item_id
         AND o.svi_lot_id  = i_in.svi_lot_id
         AND o.srm_code    = ${stock_adjustment_rules_1.RELOT_OUT_CODE}
        JOIN inventory.item_master itm ON itm.item_id = i_in.svi_item_id
       WHERE i_in.srm_code = ${stock_adjustment_rules_1.RELOT_IN_CODE}
       ORDER BY i_in.svi_line_no, o.svi_line_no
    `;
        if (same.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, same.map((r) => ({
                field: `lines.${r.in_line_no}`,
                message: `Line ${r.in_line_no} (${r.item_name}): the IN half of the re-lot resolved to the lot line ${r.out_line_no} takes the stock out of — the pair would move it from a lot into the same lot. State the CORRECT identity.`,
            })));
        }
    }
    directionOf(line, reasons) {
        if (line.toBucket) {
            return -1;
        }
        const reason = line.reasonId ? reasons.get(line.reasonId) : undefined;
        if (reason?.srm_direction === 'IN') {
            return 1;
        }
        if (reason?.srm_direction === 'OUT') {
            return -1;
        }
        if (line.sign !== 0) {
            return line.sign;
        }
        return -1;
    }
    allowsMove(reason) {
        return (reason.srm_allowed_txn_types ?? []).some((t) => stock_adjustment_rules_1.BUCKET_MOVE_TXN_TYPES.includes(t));
    }
    onlyMove(reason) {
        const allowed = reason.srm_allowed_txn_types ?? [];
        return allowed.length > 0 && allowed.every((t) => stock_adjustment_rules_1.BUCKET_MOVE_TXN_TYPES.includes(t));
    }
    isRelot(reasons, line) {
        const code = line.reasonId ? reasons.get(line.reasonId)?.srm_code : undefined;
        return code === stock_adjustment_rules_1.RELOT_OUT_CODE || code === stock_adjustment_rules_1.RELOT_IN_CODE;
    }
    documentGodown(header) {
        const { fromGodownId, toGodownId, kind } = header;
        if (kind === stock_adjustment_rules_1.BUCKET_MOVE_KIND && toGodownId && toGodownId !== fromGodownId) {
            (0, module_service_utils_1.throwStockUnprocessable)('This stock move cannot be saved', [
                { field: 'toGodownId', message: 'A move changes the bucket, not the godown: name the godown once, in fromGodownId. Moving stock between godowns is a transfer.' },
            ]);
        }
        if (kind === 'ADJUSTMENT') {
            if (!fromGodownId && !toGodownId) {
                (0, module_service_utils_1.throwStockUnprocessable)('This stock adjustment cannot be saved', [
                    { field: 'fromGodownId', message: 'An adjustment names the godown it adjusts: fromGodownId (outward, or a sheet with both signs) or toGodownId (inward).' },
                ]);
            }
            if (fromGodownId && toGodownId && fromGodownId !== toGodownId) {
                (0, module_service_utils_1.throwStockUnprocessable)('This stock adjustment cannot be saved', [
                    { field: 'toGodownId', message: 'One adjustment, one godown. A sheet with both signs names it once, in fromGodownId; moving stock between godowns is a transfer.' },
                ]);
            }
            return fromGodownId ?? toGodownId;
        }
        return fromGodownId;
    }
    refuse(rules, title, verdict, lines) {
        if (verdict.size === 0) {
            return;
        }
        (0, module_service_utils_1.throwStockUnprocessable)(title, [...verdict.entries()]
            .sort(([a], [b]) => a - b)
            .map(([index, message]) => ({ field: `lines.${index}`, message: `${message}${lines[index].itemName ? ` (${lines[index].itemName})` : ''}` })));
    }
    async kindOf(svhId, accYear, companyId, branchId) {
        const [row] = await this.prisma.$queryRaw `
      SELECT h.svh_voucher_type, h.svh_doc_date, h.svh_from_godown_id, h.svh_to_godown_id, h.svh_reason_id, h.svh_remarks,
             h.svh_refno, h.svh_link_src_module, h.svh_link_src_doc_type,
             (h.svh_voucher_type = 'ADJUSTMENT' AND EXISTS (
                SELECT 1 FROM stock.stock_voucher_item i
                 WHERE i.svi_voucher_id = h.svh_id AND i.svi_acc_year = h.svh_acc_year
                   AND i.svi_is_deleted = false AND i.svi_to_bucket IS NOT NULL))                AS is_move,
             (h.svh_voucher_type = 'ADJUSTMENT' AND EXISTS (
                SELECT 1 FROM stock.stock_voucher_item i
                  JOIN stock.stock_reason_master rm ON rm.srm_id = COALESCE(i.svi_reason_id, h.svh_reason_id)
                 WHERE i.svi_voucher_id = h.svh_id AND i.svi_acc_year = h.svh_acc_year
                   AND i.svi_is_deleted = false
                   AND rm.srm_code IN (${stock_adjustment_rules_1.RELOT_OUT_CODE}, ${stock_adjustment_rules_1.RELOT_IN_CODE})))                     AS is_relot
        FROM stock.stock_voucher h
       WHERE h.svh_id = ${svhId}::uuid AND h.svh_acc_year = ${accYear}::bpchar
         AND h.svh_company_id = ${companyId}::uuid AND h.svh_branch_id = ${branchId}::uuid
    `;
        if (!row || !(0, stock_adjustment_rules_1.isStockAdjustmentKind)(row.svh_voucher_type)) {
            (0, module_service_utils_1.throwStockNotFound)('Stock adjustment not found', 'svhId', `No adjustment, issue, damage or expiry write-off ${svhId} in ${accYear} for this company and branch.`);
        }
        if (row.svh_link_src_module && row.svh_link_src_module !== stock_voucher_types_1.STOCK_SRC_MODULE) {
            (0, module_service_utils_1.throwStockNotFound)('Stock adjustment not found', 'svhId', `${row.svh_refno ?? svhId} is the stock movement of a ${row.svh_link_src_module} ${row.svh_link_src_doc_type ?? 'document'}, not an adjustment. It is posted and cancelled with that document.`);
        }
        const kind = row.is_move ? stock_adjustment_rules_1.BUCKET_MOVE_KIND : row.svh_voucher_type;
        return {
            rules: stock_adjustment_rules_1.STOCK_ADJUSTMENT_RULES[kind],
            docKind: row.is_move ? stock_adjustment_rules_1.BUCKET_MOVE_KIND : row.is_relot ? 'RELOT' : row.svh_voucher_type,
            header: {
                kind,
                companyId,
                branchId,
                docDate: isoDate(row.svh_doc_date),
                fromGodownId: row.svh_from_godown_id,
                toGodownId: row.svh_to_godown_id,
                reasonId: row.svh_reason_id,
                remarks: row.svh_remarks,
            },
        };
    }
    async loadLines(svhId, accYear, header) {
        const rows = await this.prisma.$queryRaw `
      SELECT svi.svi_id, svi.svi_line_no, svi.svi_item_id, itm.item_name_en AS item_name,
             svi.svi_godown_id, svi.svi_lot_id, svi.svi_bucket, svi.svi_to_bucket, svi.svi_base_qty, svi.svi_free_base_qty,
             svi.svi_direction, svi.svi_reason_id, svi.svi_remarks, svi.svi_base_uom_id,
             svi.svi_batch_no, svi.svi_mrp, svi.svi_sale_price, svi.svi_expiry_date, svi.svi_serial_no, svi.svi_supplier_id
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm ON itm.item_id = svi.svi_item_id
       WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;
        return rows.map((r, index) => ({
            index,
            lineNo: r.svi_line_no,
            sviId: r.svi_id,
            itemId: r.svi_item_id,
            itemName: r.item_name,
            godownId: r.svi_godown_id,
            lotId: r.svi_lot_id,
            bucket: r.svi_bucket,
            toBucket: r.svi_to_bucket,
            keyedNegative: false,
            baseQty: Number(r.svi_base_qty),
            freeBaseQty: Number(r.svi_free_base_qty),
            sign: r.svi_direction === null ? 0 : Number(r.svi_direction) > 0 ? 1 : -1,
            reasonId: r.svi_reason_id ?? header.reasonId,
            remarks: r.svi_remarks?.trim() || header.remarks?.trim() || null,
            baseUomId: r.svi_base_uom_id,
            identity: {
                batchNo: r.svi_batch_no,
                mrp: r.svi_mrp === null ? null : r.svi_mrp.toString(),
                salePrice: r.svi_sale_price === null ? null : r.svi_sale_price.toString(),
                expiryDate: isoDate(r.svi_expiry_date),
                serialNo: r.svi_serial_no,
                supplierId: r.svi_supplier_id,
            },
        }));
    }
    async loadReasons(companyId, lines) {
        const ids = [...new Set(lines.map((l) => l.reasonId).filter((id) => !!id))];
        if (ids.length === 0) {
            return new Map();
        }
        const rows = await this.prisma.$queryRaw `
      SELECT srm_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types, srm_is_active, srm_require_remarks
        FROM stock.stock_reason_master
       WHERE srm_id = ANY(${ids}::uuid[])
         AND srm_is_deleted = false
         AND (srm_company_id IS NULL OR srm_company_id = ${companyId}::uuid)
    `;
        return new Map(rows.map((r) => [r.srm_id, r]));
    }
    async loadLots(lotIds) {
        if (lotIds.length === 0) {
            return new Map();
        }
        const rows = await this.prisma.$queryRaw `
      SELECT slt_id, slt_item_id, slt_expiry_date, slt_base_uom_id, slt_batch_no
        FROM stock.stock_lot WHERE slt_id = ANY(${lotIds}::uuid[]) AND slt_is_deleted = false
    `;
        return new Map(rows.map((r) => [r.slt_id, r]));
    }
    async loadAvailable(companyId, branchId, keys) {
        if (keys.length === 0) {
            return new Map();
        }
        const lotIds = [...new Set(keys.map((k) => k.split('|')[0]))];
        const rows = await this.prisma.$queryRaw `
      SELECT sbl_lot_id, sbl_godown_id, sbl_bucket, sbl_available_qty
        FROM stock.stock_balance
       WHERE sbl_company_id = ${companyId}::uuid AND sbl_branch_id = ${branchId}::uuid
         AND sbl_lot_id = ANY(${lotIds}::uuid[]) AND sbl_is_deleted = false
    `;
        return new Map(rows.map((r) => [`${r.sbl_lot_id}|${r.sbl_godown_id}|${r.sbl_bucket}`, Number(r.sbl_available_qty ?? 0)]));
    }
    async expiryGraceDays(companyId, branchId) {
        const effective = await this.appSettings.resolveEffective({ companyId, branchId, deviceId: null, userId: null });
        const raw = effective.find((i) => i.asdKey === stock_adjustment_rules_1.EXPIRY_GRACE_SETTING_KEY)?.value;
        const days = Number.parseInt(raw ?? '0', 10);
        return Number.isFinite(days) && days > 0 ? days : 0;
    }
};
exports.StockAdjustmentService = StockAdjustmentService;
exports.StockAdjustmentService = StockAdjustmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_voucher_service_1.StockVoucherService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService])
], StockAdjustmentService);
function isoDate(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function addDays(isoDay, days) {
    const d = new Date(`${isoDay}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=stock-adjustment.service.js.map