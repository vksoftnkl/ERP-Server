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
exports.SalesStockService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const stock_posting_service_1 = require("../../stocks/posting/stock-posting.service");
const stock_voucher_source_1 = require("../../stocks/posting/stock-voucher.source");
const sales_errors_1 = require("./sales.errors");
const posting_types_1 = require("./types/posting.types");
const sales_doc_utils_1 = require("./sales-doc.utils");
let SalesStockService = class SalesStockService {
    prisma;
    stockPosting;
    constructor(prisma, stockPosting) {
        this.prisma = prisma;
        this.stockPosting = stockPosting;
    }
    async post(tx, doc, actor, postedOn) {
        const lines = doc.lines.filter((l) => !l.isService && (0, sales_doc_utils_1.round4)(l.qty + (l.freeQty ?? 0)) > 0);
        if (lines.length === 0) {
            return {
                svhId: null,
                rowsPosted: 0,
                costByLine: new Map(),
                lotByLine: new Map(),
                cogsTotal: 0,
            };
        }
        const units = await this.units(tx, lines.map((l) => l.itemUnitId));
        const rules = this.rules(doc);
        const svhId = await this.writeShadow(tx, doc, lines, units, rules, actor, postedOn);
        try {
            const rowsPosted = await this.stockPosting.post(tx, new stock_voucher_source_1.StockVoucherSource({
                svhId,
                accYear: doc.accYear,
                companyId: doc.companyId,
                branchId: doc.branchId,
                rules,
            }), {
                actor,
                postedOn,
                ledgerSource: {
                    srcModule: 'SALES',
                    srcDocType: doc.docType,
                    srcRefno: doc.refno,
                    partyId: doc.partyId ?? null,
                },
            });
            const [sum] = await tx.$queryRaw `
        SELECT SUM(sml_qty + sml_free_qty) AS qty, COUNT(*) AS rows
          FROM stock.stock_ledger
         WHERE sml_src_doc_id = ${svhId}::uuid AND sml_acc_year = ${doc.accYear}::bpchar
           AND sml_is_reversal = false AND sml_is_deleted = false`;
            const expected = (0, sales_doc_utils_1.round4)(lines.reduce((s, l) => s + l.qty + (l.freeQty ?? 0), 0));
            const got = (0, sales_doc_utils_1.round4)(Number(sum?.qty ?? 0));
            if (Math.abs(expected - got) > 0.0005) {
                throw new Error(`${posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH}: ${doc.docType} ${doc.refno} moved ${got} against ${expected} on its lines`);
            }
            const costs = await tx.$queryRaw `
        SELECT svi.svi_line_no, svi.svi_lot_id, SUM(sml.sml_cost_value) AS cost
          FROM stock.stock_voucher_item svi
          LEFT JOIN stock.stock_ledger sml
                 ON sml.sml_src_doc_id = svi.svi_voucher_id
                AND sml.sml_acc_year   = svi.svi_acc_year
                AND sml.sml_line_no    = svi.svi_line_no
                AND sml.sml_split_no   = svi.svi_split_no
                AND sml.sml_is_reversal = false
                AND sml.sml_is_deleted = false
         WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${doc.accYear}::bpchar
         GROUP BY svi.svi_line_no, svi.svi_lot_id`;
            const byLineNo = new Map(lines.map((l) => [l.lineNo, l]));
            const costByLine = new Map();
            const lotByLine = new Map();
            let total = 0;
            for (const r of costs) {
                const line = byLineNo.get(r.svi_line_no);
                if (!line) {
                    continue;
                }
                const cost = (0, sales_doc_utils_1.round2)(Number(r.cost ?? 0));
                costByLine.set(line.lineId, cost);
                lotByLine.set(line.lineId, r.svi_lot_id);
                total += cost;
            }
            return { svhId, rowsPosted, costByLine, lotByLine, cogsTotal: (0, sales_doc_utils_1.round2)(total) };
        }
        catch (error) {
            if (error instanceof common_2.ConflictException) {
                const body = error.getResponse();
                const detail = body?.errors?.map((e) => e.message).join('; ') ||
                    body?.message ||
                    'stock would go negative';
                (0, sales_errors_1.throwSalesRefused)(detail, posting_types_1.SALES_ERROR_CODES.STOCK_NEGATIVE, 'items');
            }
            throw error;
        }
    }
    async cancel(tx, doc, actor, reason, cancelledOn) {
        const shadows = await tx.$queryRaw `
      SELECT svh_id
        FROM stock.stock_voucher
       WHERE svh_link_src_module   = 'SALES'
         AND svh_link_src_doc_type = ${doc.docType}
         AND svh_link_src_doc_id   = ${doc.docId}::uuid
         AND svh_acc_year          = ${doc.accYear}::bpchar
         AND svh_status            = 'POSTED'
         AND svh_is_deleted        = false`;
        let reversed = 0;
        for (const s of shadows) {
            reversed += await this.stockPosting.cancel(tx, new stock_voucher_source_1.StockVoucherSource({
                svhId: s.svh_id,
                accYear: doc.accYear,
                companyId: doc.companyId,
                branchId: doc.branchId,
                rules: this.rules(doc),
            }), { actor, reason, cancelledOn });
        }
        return reversed;
    }
    rules(doc) {
        const inward = doc.direction === 'IN';
        return {
            voucherType: inward ? 'RECEIPT' : 'ISSUE',
            typeCode: doc.docType,
            displayName: DISPLAY_NAME[doc.docType],
            requiresToGodown: inward,
            requiresFromGodown: !inward,
            isInward: inward,
            ledgerTxnTypes: [doc.txnType],
            quantityMode: 'QTY',
            defaultRateSource: 'AVG_COST',
            allowsCount: false,
            allowsToBranch: false,
            postFunction: 'stock.fn_svh_post',
            auditScreenName: DISPLAY_NAME[doc.docType],
            statusDocType: STATUS_DOC_TYPE[doc.docType],
        };
    }
    async units(tx, iucIds) {
        const ids = [...new Set(iucIds)];
        const rows = await tx.$queryRaw `
      SELECT iuc_id, iuc_unit_id, iuc_base_unit_id, iuc_to_base_factor
        FROM inventory.item_unit_conversion
       WHERE iuc_id = ANY(${ids}::uuid[])`;
        const by = new Map(rows.map((r) => [r.iuc_id, r]));
        const missing = ids.filter((id) => !by.has(id));
        if (missing.length > 0) {
            (0, sales_errors_1.throwSalesRefused)(`Unit conversion not found for ${missing.length === 1 ? 'a line' : `${missing.length} lines`}: ${missing.join(', ')}`, posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'items');
        }
        return by;
    }
    async writeShadow(tx, doc, lines, units, rules, actor, now) {
        const deviceId = doc.deviceId?.trim() || 'SERVER';
        const [slno] = await tx.$queryRaw `
      SELECT COALESCE(MAX(svh_slno), 0) + 1 AS next
        FROM stock.stock_voucher
       WHERE svh_acc_year = ${doc.accYear}::bpchar AND svh_company_id = ${doc.companyId}::uuid
         AND svh_branch_id = ${doc.branchId}::uuid AND svh_voucher_type = ${rules.voucherType}
         AND svh_device_id = ${deviceId}`;
        const refno = `${doc.docType}/${doc.refno}/r${doc.revision}`;
        const godowns = [...new Set(lines.map((l) => l.godownId))];
        const inward = doc.direction === 'IN';
        const [header] = await tx.$queryRaw `
      INSERT INTO stock.stock_voucher (
        svh_company_id, svh_branch_id, svh_tenant_id, svh_acc_year, svh_device_id, svh_session_id,
        svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
        svh_from_godown_id, svh_to_godown_id, svh_party_ref,
        svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
        svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by
      ) VALUES (
        ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId ?? null}::uuid, ${doc.accYear}::bpchar,
        ${deviceId}, ${doc.sessionId ?? null}::uuid,
        ${rules.voucherType}, ${Number(slno?.next ?? 1)}::bigint, ${refno}, ${doc.refno},
        ${doc.docDate}::date, ${doc.docDatetime},
        ${inward ? null : godowns[0]}::uuid, ${inward ? godowns[0] : null}::uuid,
        ${doc.partyId ?? null},
        'SALES', ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::bpchar,
        ${lines.length}::int, ${(0, sales_doc_utils_1.round4)(lines.reduce((s, l) => s + l.qty + (l.freeQty ?? 0), 0))}::numeric,
        'DRAFT', 'AVG_COST', ${doc.remarks ?? `${DISPLAY_NAME[doc.docType]} ${doc.refno}`},
        ${now}, ${actor === '00000000-0000-0000-0000-000000000000' ? null : actor}
      )
      RETURNING svh_id`;
        const svhId = header.svh_id;
        const values = lines.map((l) => {
            const u = units.get(l.itemUnitId);
            const factor = l.toBaseFactor && l.toBaseFactor > 0 ? l.toBaseFactor : Number(u.iuc_to_base_factor) || 1;
            const qty = (0, sales_doc_utils_1.round4)(l.qty);
            const free = (0, sales_doc_utils_1.round4)(l.freeQty ?? 0);
            return client_1.Prisma.sql `(
        ${svhId}::uuid, ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId ?? null}::uuid,
        ${doc.accYear}::bpchar, ${l.lineNo}::int, 1,
        ${l.itemId}::uuid, ${u.iuc_unit_id}::uuid, ${u.iuc_base_unit_id}::uuid, ${factor}::numeric,
        ${l.godownId}::uuid, ${l.lotId ?? null}::uuid, ${l.bucket ?? 'SALEABLE'},
        ${l.batchNo ?? null}, ${l.batchDate ?? null}::date, ${l.expiryDate ?? null}::date,
        ${l.mrp ?? null}::numeric, ${l.rate ?? null}::numeric, ${l.serialNo ?? null},
        ${qty}::numeric, ${(0, sales_doc_utils_1.round4)(qty * factor)}::numeric, ${free}::numeric, ${(0, sales_doc_utils_1.round4)(free * factor)}::numeric,
        ${l.weightQty ?? 0}::numeric,
        ${l.costRate ?? 0}::numeric, ${l.costRate ?? 0}::numeric, ${l.taxPerc ?? 0}::numeric,
        ${now}, ${actor === '00000000-0000-0000-0000-000000000000' ? null : actor}
      )`;
        });
        await tx.$executeRaw `
      INSERT INTO stock.stock_voucher_item (
        svi_voucher_id, svi_company_id, svi_branch_id, svi_tenant_id,
        svi_acc_year, svi_line_no, svi_split_no,
        svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
        svi_godown_id, svi_lot_id, svi_bucket,
        svi_batch_no, svi_mfg_date, svi_expiry_date,
        svi_mrp, svi_sale_price, svi_serial_no,
        svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty,
        svi_weight_qty,
        svi_cost_rate, svi_cost_rate_wot, svi_tax_perc,
        svi_created_on, svi_created_by
      ) VALUES ${client_1.Prisma.join(values)}`;
        return svhId;
    }
};
exports.SalesStockService = SalesStockService;
exports.SalesStockService = SalesStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_posting_service_1.StockPostingService])
], SalesStockService);
const DISPLAY_NAME = {
    SALE_BILL: 'Sale bill',
    DELIVERY_CHALLAN: 'Delivery challan',
    SALE_RETURN: 'Sale return',
    DC_RETURN: 'Delivery challan return',
};
const STATUS_DOC_TYPE = {
    SALE_BILL: txn_status_log_helper_1.TxnStatusDocType.SALE_BILL,
    DELIVERY_CHALLAN: txn_status_log_helper_1.TxnStatusDocType.DELIVERY_CHALLAN,
    SALE_RETURN: txn_status_log_helper_1.TxnStatusDocType.SALE_RETURN,
    DC_RETURN: txn_status_log_helper_1.TxnStatusDocType.OTHER,
};
//# sourceMappingURL=sales-stock.service.js.map