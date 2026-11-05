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
exports.ItemInwardHistoryService = exports.INWARD_PRICE_TXN_TYPES = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_voucher_posting_helper_1 = require("../stock-voucher/stock-voucher-posting.helper");
exports.INWARD_PRICE_TXN_TYPES = ['OPENING', 'PURCHASE'];
const DEFAULT_LIMIT = 10;
let ItemInwardHistoryService = class ItemInwardHistoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(q) {
        return this.prisma.$queryRaw `
      SELECT to_char(sml.sml_doc_date, 'YYYY-MM-DD')                 AS date,
             sml.sml_txn_type                                         AS "txnType",
             sml.sml_src_refno                                        AS refno,
             sup.sup_id::text                                         AS "supplierId",
             sup.sup_name                                             AS "supplierName",
             sml.sml_qty::float8                                      AS qty,
             sml.sml_free_qty::float8                                 AS "freeQty",
             um.unit_name                                             AS "unitName",
             sml.sml_base_qty::float8                                 AS "baseQty",
             sml.sml_cost_rate_wot::float8                            AS "costWot",
             CASE WHEN sml.sml_cost_rate_wot > 0
                  THEN round((sml.sml_cost_rate / sml.sml_cost_rate_wot - 1) * 100, 2)::float8
             END                                                      AS "taxPerc",
             sml.sml_cost_rate::float8                                AS cost,
             sml.sml_mrp::float8                                      AS mrp,
             sml.sml_batch_no                                         AS "batchNo"
        FROM stock.stock_ledger sml
        LEFT JOIN stock.stock_lot slt                ON slt.slt_id = sml.sml_lot_id
        LEFT JOIN purchase.suppliers sup             ON sup.sup_id = COALESCE(sml.sml_party_id, slt.slt_supplier_id)
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sml.sml_uom_id
        LEFT JOIN inventory.item_unit_master um      ON um.unit_id = iuc.iuc_unit_id
       WHERE sml.sml_company_id = ${q.companyId}::uuid
         AND sml.sml_branch_id  = ${q.branchId}::uuid
         AND sml.sml_item_id    = ${q.itemId}::uuid
         AND sml.sml_direction  = 1
         AND sml.sml_txn_type   IN (${client_1.Prisma.join([...exports.INWARD_PRICE_TXN_TYPES])})
         AND ${(0, stock_voucher_posting_helper_1.unreversedLedgerRow)()}
       ORDER BY sml.sml_doc_date DESC, sml.sml_doc_datetime DESC NULLS LAST, sml.sml_id DESC
       LIMIT ${q.limit ?? DEFAULT_LIMIT}`;
    }
};
exports.ItemInwardHistoryService = ItemInwardHistoryService;
exports.ItemInwardHistoryService = ItemInwardHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemInwardHistoryService);
//# sourceMappingURL=item-inward-history.service.js.map