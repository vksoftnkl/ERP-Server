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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseReorderController = exports.PurchaseReorderService = exports.CreateReorderPosDto = exports.ReorderRowDto = exports.ReorderQueryDto = exports.REORDER_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
const purchase_order_1 = require("../order/purchase-order");
exports.REORDER_MENU_ID = 296;
class ReorderQueryDto {
    companyId;
    branchId;
    supplierId;
    belowOnly;
}
exports.ReorderQueryDto = ReorderQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReorderQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReorderQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Only the items this supplier is the suggested one for.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReorderQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'true (default): only items at / below their level. false: every reorder row.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReorderQueryDto.prototype, "belowOnly", void 0);
class ReorderRowDto {
    itemId;
    uomId;
    qty;
    supplierId;
    rate;
}
exports.ReorderRowDto = ReorderRowDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReorderRowDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReorderRowDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.000001),
    __metadata("design:type", Number)
], ReorderRowDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ReorderRowDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ReorderRowDto.prototype, "rate", void 0);
class CreateReorderPosDto {
    companyId;
    branchId;
    accYear;
    deviceId;
    docDate;
    godownId;
    rows;
}
exports.CreateReorderPosDto = CreateReorderPosDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReorderPosDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReorderPosDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], CreateReorderPosDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReorderPosDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateReorderPosDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReorderPosDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ReorderRowDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReorderRowDto),
    __metadata("design:type", Array)
], CreateReorderPosDto.prototype, "rows", void 0);
let PurchaseReorderService = class PurchaseReorderService {
    prisma;
    orders;
    constructor(prisma, orders) {
        this.prisma = prisma;
        this.orders = orders;
    }
    async suggestions(q) {
        const belowOnly = q.belowOnly !== false && String(q.belowOnly) !== 'false';
        const rows = await this.prisma.$queryRaw `
      WITH used AS (
        SELECT gri.gri_src_item_id AS id, SUM((gri.gri_received_qty + gri.gri_damaged_qty) * gri.gri_to_base_factor) AS q
          FROM purchase.pur_grn_item gri JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
         WHERE gri.gri_src_doc_type = 'PURCHASE_ORDER' AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted AND g.grn_status <> 'CANCELLED' GROUP BY 1
        UNION ALL
        SELECT pii.pii_src_item_id, SUM(pii.pii_billed_qty * pii.pii_to_base_factor)
          FROM purchase.pur_invoice_item pii JOIN purchase.pur_invoice p ON p.pi_id = pii.pii_pi_id AND p.pi_acc_year = pii.pii_acc_year
         WHERE pii.pii_src_doc_type = 'PURCHASE_ORDER' AND NOT pii.pii_is_deleted AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED' GROUP BY 1),
      on_order AS (
        SELECT poi.poi_item_id AS item_id,
               SUM(GREATEST(poi.poi_qty * poi.poi_to_base_factor - COALESCE((SELECT SUM(q) FROM used WHERE used.id = poi.poi_id), 0)
                            - poi.poi_short_closed_qty * poi.poi_to_base_factor, 0)) AS base_qty
          FROM purchase.pur_order po
          JOIN purchase.pur_order_item poi ON poi.poi_po_id = po.po_id AND poi.poi_acc_year = po.po_acc_year AND NOT poi.poi_is_deleted
         WHERE po.po_company_id = ${q.companyId}::uuid AND po.po_branch_id = ${q.branchId}::uuid AND po.po_status = 'POSTED' AND NOT po.po_is_deleted
           AND po.po_approval_status <> 'REJECTED'
         GROUP BY 1),
      ro AS (
        SELECT DISTINCT ON (ir.ir_item_id, COALESCE(ir.ir_godown_id::text, ''))
               ir.ir_id, ir.ir_item_id, ir.ir_uc_unit_id, ir.ir_godown_id, ir.ir_reorder_type,
               COALESCE(ir.ir_min_level, 0) AS min_level, COALESCE(ir.ir_max_level, 0) AS max_level,
               COALESCE(ir.ir_reorder_level, 0) AS reorder_level, COALESCE(ir.ir_reorder_qty, 0) AS reorder_qty,
               COALESCE(ir.ir_lead_time_days, 0) AS lead_days
          FROM inventory.item_reorders ir
         WHERE ir.ir_branch_id = ${q.branchId}::uuid AND ir.ir_is_active AND NOT ir.ir_is_deleted
           AND lower(COALESCE(ir.ir_reorder_type, '')) <> 'production'
         ORDER BY ir.ir_item_id, COALESCE(ir.ir_godown_id::text, ''), ir.ir_modified_on DESC NULLS LAST),
      base AS (
        SELECT ro.*, im.item_name_en AS item_name, im.item_code, iuc.iuc_to_base_factor AS factor, um.unit_name,
               COALESCE((SELECT SUM(sbl.sbl_on_hand_qty) FROM stock.stock_balance sbl
                          WHERE sbl.sbl_company_id = ${q.companyId}::uuid AND sbl.sbl_branch_id = ${q.branchId}::uuid AND sbl.sbl_item_id = ro.ir_item_id
                            AND sbl.sbl_bucket = 'SALEABLE' AND NOT sbl.sbl_is_deleted
                            AND (ro.ir_godown_id IS NULL OR sbl.sbl_godown_id = ro.ir_godown_id)), 0) AS on_hand_base,
               COALESCE((SELECT base_qty FROM on_order WHERE on_order.item_id = ro.ir_item_id), 0) AS on_order_base,
               pref.psi_supplier_id AS pref_supplier_id, pref.psi_moq AS moq, pref.psi_buy_uom_id AS moq_uom_id, pref.psi_supplier_item_code AS supplier_code,
               lastb.supplier_id AS last_supplier_id, lastb.rate AS last_rate, lastb.uom_id AS last_uom_id, lastb.doc_date AS last_date
          FROM ro
          JOIN inventory.item_master im ON im.item_id = ro.ir_item_id
          JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = ro.ir_uc_unit_id
          JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
          LEFT JOIN LATERAL (
            SELECT psi.psi_supplier_id, psi.psi_moq, psi.psi_buy_uom_id, psi.psi_supplier_item_code
              FROM purchase.pur_supplier_item psi
             WHERE psi.psi_item_id = ro.ir_item_id AND psi.psi_is_active AND NOT psi.psi_is_deleted AND psi.psi_is_preferred
               AND (psi.psi_company_id IS NULL OR psi.psi_company_id = ${q.companyId}::uuid)
             ORDER BY psi.psi_company_id NULLS LAST LIMIT 1) pref ON true
          LEFT JOIN LATERAL (
            SELECT pi.pi_supplier_id AS supplier_id, pii.pii_rate AS rate, pii.pii_uom_id AS uom_id, pi.pi_doc_date AS doc_date
              FROM purchase.pur_invoice_item pii
              JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
             WHERE pi.pi_company_id = ${q.companyId}::uuid AND pii.pii_item_id = ro.ir_item_id AND pi.pi_status = 'POSTED'
               AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
             ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC LIMIT 1) lastb ON true)
      SELECT b.*, COALESCE(b.pref_supplier_id, b.last_supplier_id) AS supplier_id,
             CASE WHEN b.pref_supplier_id IS NOT NULL THEN 'PREFERRED' WHEN b.last_supplier_id IS NOT NULL THEN 'LAST_BILL' END AS supplier_source,
             s.sup_name AS supplier_name, g.gdl_name AS godown_name,
             (SELECT pii.pii_rate FROM purchase.pur_invoice_item pii
                JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
               WHERE pi.pi_company_id = ${q.companyId}::uuid AND pii.pii_item_id = b.ir_item_id AND pii.pii_uom_id = b.ir_uc_unit_id
                 AND pi.pi_supplier_id = COALESCE(b.pref_supplier_id, b.last_supplier_id) AND pi.pi_status = 'POSTED'
                 AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
               ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC LIMIT 1) AS supplier_rate
        FROM base b
        LEFT JOIN purchase.suppliers s ON s.sup_id = COALESCE(b.pref_supplier_id, b.last_supplier_id)
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = b.ir_godown_id
       ORDER BY s.sup_name NULLS LAST, b.item_name`;
        const out = [];
        for (const r of rows) {
            const factor = (0, purchase_doc_helpers_1.D)(r.factor);
            const f = factor.isZero() ? (0, purchase_doc_helpers_1.D)(1) : factor;
            const onHand = (0, purchase_doc_helpers_1.D)(r.on_hand_base).div(f), onOrder = (0, purchase_doc_helpers_1.D)(r.on_order_base).div(f);
            const cover = onHand.plus(onOrder);
            const level = (0, purchase_doc_helpers_1.D)(r.reorder_level), min = (0, purchase_doc_helpers_1.D)(r.min_level), max = (0, purchase_doc_helpers_1.D)(r.max_level);
            const trigger = level.greaterThan(0) ? level : min;
            const below = trigger.greaterThan(0) && cover.lessThanOrEqualTo(trigger);
            if (belowOnly && !below)
                continue;
            let qty = (0, purchase_doc_helpers_1.D)(r.reorder_qty);
            if (!qty.greaterThan(0))
                qty = max.greaterThan(cover) ? max.minus(cover) : trigger.minus(cover);
            if (qty.isNegative())
                qty = (0, purchase_doc_helpers_1.D)(0);
            qty = qty.toDecimalPlaces(0, client_1.Prisma.Decimal.ROUND_UP);
            const moq = (0, purchase_doc_helpers_1.D)(r.moq ?? 0);
            if (moq.greaterThan(0) && r.moq_uom_id === r.ir_uc_unit_id && qty.greaterThan(0) && qty.lessThan(moq))
                qty = moq;
            const supplierId = r.supplier_id ?? null;
            if (q.supplierId && supplierId !== q.supplierId)
                continue;
            const rate = r.supplier_rate ?? (r.last_uom_id === r.ir_uc_unit_id ? r.last_rate : null);
            out.push({
                reorderId: r.ir_id, itemId: r.ir_item_id, itemName: r.item_name, itemCode: r.item_code, uomId: r.ir_uc_unit_id, unitName: r.unit_name,
                godownId: r.ir_godown_id ?? null, godownName: r.godown_name ?? null, reorderType: r.ir_reorder_type,
                onHand: onHand.toDecimalPlaces(3), onOrder: onOrder.toDecimalPlaces(3), cover: cover.toDecimalPlaces(3),
                reorderLevel: level, minLevel: min, maxLevel: max, reorderQty: (0, purchase_doc_helpers_1.D)(r.reorder_qty), leadDays: r.lead_days,
                below, suggestedQty: qty, supplierId, supplierName: r.supplier_name ?? null, supplierSource: r.supplier_source ?? null,
                supplierCode: r.pref_supplier_id ? (r.supplier_code ?? null) : null, rate: rate ?? null, lastPurchaseDate: r.last_date ?? null,
            });
        }
        return (0, purchase_doc_helpers_1.jsonSafe)(out);
    }
    async createPos(dto) {
        const bySupplier = new Map();
        for (const r of dto.rows)
            bySupplier.set(r.supplierId, [...(bySupplier.get(r.supplierId) ?? []), r]);
        const made = [];
        for (const [supplierId, rows] of bySupplier) {
            const lines = new Map();
            for (const r of rows) {
                const k = `${r.itemId}|${r.uomId}`;
                const cur = lines.get(k);
                if (cur)
                    cur.qty += r.qty;
                else
                    lines.set(k, { itemId: r.itemId, uomId: r.uomId, qty: r.qty, rate: r.rate ?? 0 });
            }
            const save = {
                header: { companyId: dto.companyId, branchId: dto.branchId, accYear: dto.accYear, deviceId: dto.deviceId, supplierId,
                    docDate: dto.docDate ?? new Date().toISOString().slice(0, 10), godownId: dto.godownId, remarks: 'From Reorder' },
                lines: [...lines.values()].map((l, i) => ({ lineNo: i + 1, itemId: l.itemId, uomId: l.uomId, qty: l.qty, rate: l.rate })),
            };
            const po = await this.orders.save(save);
            made.push({ poId: po.header.poId, accYear: po.header.poAccYear, refno: po.header.poRefno, supplierId, supplierName: po.header.supplierName,
                lines: po.lines.length, value: po.header.poNetAmt });
        }
        return (0, purchase_doc_helpers_1.jsonSafe)(made);
    }
};
exports.PurchaseReorderService = PurchaseReorderService;
exports.PurchaseReorderService = PurchaseReorderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, purchase_order_1.PurchaseOrderService])
], PurchaseReorderService);
let PurchaseReorderController = class PurchaseReorderController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: purchase_order_1.PURCHASE_ORDER_MENU_ID, right, codePrefix: 'PO', action });
    }
    async suggestions(q) {
        await this.right('view', 'read the reorder list');
        return { success: true, message: 'Reorder suggestions', data: await this.service.suggestions(q) };
    }
    async createPos(dto) {
        await this.right('create', 'make purchase orders from the reorder list');
        if (dto.rows.some((r) => !r.supplierId))
            (0, purchase_errors_1.purRefuse)('Every ticked row needs a supplier.', 'PUR_SUPPLIER_REQUIRED', 'rows');
        const data = await this.service.createPos(dto);
        return { success: true, message: `${data.length} purchase order${data.length === 1 ? '' : 's'} made as drafts`, data };
    }
};
exports.PurchaseReorderController = PurchaseReorderController;
__decorate([
    (0, common_1.Get)('suggestions'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Items at / below their reorder level here, with stock, on order, the suggested qty and supplier (DOC-02).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ReorderQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseReorderController.prototype, "suggestions", null);
__decorate([
    (0, common_1.Post)('create-pos'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Ticked reorder rows → one draft PO per supplier.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateReorderPosDto]),
    __metadata("design:returntype", Promise)
], PurchaseReorderController.prototype, "createPos", null);
exports.PurchaseReorderController = PurchaseReorderController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Reorder'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/reorder'),
    __metadata("design:paramtypes", [PurchaseReorderService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseReorderController);
//# sourceMappingURL=purchase-reorder.js.map