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
exports.LotByBatchService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_error_codes_1 = require("../types/stock-error-codes");
let LotByBatchService = class LotByBatchService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async find(q) {
        const rows = await this.prisma.$queryRaw `
      SELECT slt.slt_id::text                      AS "lotId",
             slt.slt_item_id::text                 AS "itemId",
             itm.item_code                         AS "itemCode",
             itm.item_name_en                      AS "itemName",
             slt.slt_base_uom_id::text             AS "baseUomId",
             um.unit_name                          AS "baseUnitName",
             slt.slt_batch_no                      AS "batchNo",
             slt.slt_mrp::float8                   AS mrp,
             slt.slt_sale_price::float8            AS "salePrice",
             slt.slt_status                        AS status,
             sbd.sbd_size_id::text                 AS "sizeId",
             isz.isz_name                          AS "sizeName",
             sbd.sbd_colour_id::text               AS "colourId",
             icl.icl_name                          AS "colourName",
             sbd.sbd_model                         AS model,
             COALESCE(held.on_hand, 0)::float8     AS "onHandQty",
             COALESCE(held.godowns, '[]'::jsonb)   AS godowns
        FROM stock.stock_lot slt
        JOIN inventory.item_master itm
          ON itm.item_id = slt.slt_item_id AND itm.item_is_deleted = false
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = slt.slt_base_uom_id
        LEFT JOIN inventory.item_unit_master um      ON um.unit_id = iuc.iuc_unit_id
        -- Addendum 2 E3.1: keyed by the batch (stored folded, as slt_key_batch).
        LEFT JOIN stock.stock_batch_detail sbd
               ON sbd.sbd_company_id = slt.slt_company_id
              AND sbd.sbd_batch_no   = slt.slt_key_batch
              AND sbd.sbd_item_id    = slt.slt_item_id
              AND sbd.sbd_is_deleted = false
        LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
        LEFT JOIN LATERAL (
          SELECT sum(sbl.sbl_on_hand_qty) AS on_hand,
                 jsonb_agg(jsonb_build_object(
                   'godownId',     sbl.sbl_godown_id,
                   'godownName',   gdl.gdl_name,
                   'onHandQty',    sbl.sbl_on_hand_qty,
                   'availableQty', sbl.sbl_available_qty) ORDER BY gdl.gdl_name) AS godowns
            FROM stock.stock_balance sbl
            LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = sbl.sbl_godown_id
           WHERE sbl.sbl_company_id = slt.slt_company_id
             AND sbl.sbl_branch_id  = ${q.branchId}::uuid
             AND sbl.sbl_lot_id     = slt.slt_id
             AND sbl.sbl_bucket     = 'SALEABLE'
             AND sbl.sbl_is_deleted = false
             AND sbl.sbl_on_hand_qty <> 0
        ) held ON true
       WHERE slt.slt_company_id = ${q.companyId}::uuid
         AND slt.slt_key_batch  = upper(btrim(${q.batchNo}))
         AND slt.slt_is_deleted = false
         ${q.includeEmpty ? client_1.Prisma.empty : client_1.Prisma.sql `AND COALESCE(held.on_hand, 0) > 0`}
       ORDER BY itm.item_name_en, slt.slt_mrp NULLS FIRST, slt.slt_sale_price NULLS FIRST,
                slt.slt_first_inward_date, slt.slt_id
    `;
        if (rows.length === 0) {
            const message = `No stock with batch ${q.batchNo.trim().toUpperCase()}`;
            (0, module_service_utils_1.throwStockNotFound)(message, 'batchNo', message, stock_error_codes_1.StockErrorCode.BATCH_NOT_FOUND);
        }
        return rows;
    }
};
exports.LotByBatchService = LotByBatchService;
exports.LotByBatchService = LotByBatchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LotByBatchService);
//# sourceMappingURL=lot-by-batch.service.js.map