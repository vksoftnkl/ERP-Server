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
exports.PurchaseLookupController = exports.PurchaseLookupService = exports.ItemContextQueryDto = exports.SupplierContextQueryDto = void 0;
exports.msmeDueDays = msmeDueDays;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
const purchase_order_1 = require("../order/purchase-order");
const purchase_bill_from_1 = require("../common/purchase-bill-from");
class SupplierContextQueryDto {
    companyId;
    branchId;
    supplierId;
    onDate;
}
exports.SupplierContextQueryDto = SupplierContextQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierContextQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierContextQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierContextQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Goods received on (YYYY-MM-DD): the MSME pay-by date and licence checks run from it. Default today.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SupplierContextQueryDto.prototype, "onDate", void 0);
class ItemContextQueryDto {
    companyId;
    branchId;
    itemId;
    supplierId;
    uomId;
    onDate;
}
exports.ItemContextQueryDto = ItemContextQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ItemContextQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ItemContextQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ItemContextQueryDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The bill\'s supplier: its PO rate and its own code for the item.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ItemContextQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The line\'s unit (item_unit_conversion.iuc_id): prices in it. Default the base unit.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ItemContextQueryDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Prices effective on (YYYY-MM-DD). Default today.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ItemContextQueryDto.prototype, "onDate", void 0);
const MSME_DUE_CATEGORIES = new Set(['MICRO', 'SMALL']);
const MSME_DUE_ACTIVITIES = new Set(['MANUFACTURER', 'MANUFACTURING', 'SERVICE', 'SERVICES']);
const MSME_NO_AGREEMENT_DAYS = 15;
const MSME_MAX_DAYS = 45;
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
function msmeDueDays(category, activity, agreement, agreedDays) {
    if (!category || !MSME_DUE_CATEGORIES.has(category.trim().toUpperCase()))
        return null;
    if (!activity || !MSME_DUE_ACTIVITIES.has(activity.trim().toUpperCase()))
        return null;
    if (!agreement)
        return MSME_NO_AGREEMENT_DAYS;
    return Math.min(agreedDays && agreedDays > 0 ? agreedDays : MSME_MAX_DAYS, MSME_MAX_DAYS);
}
let PurchaseLookupService = class PurchaseLookupService {
    prisma;
    orders;
    constructor(prisma, orders) {
        this.prisma = prisma;
        this.orders = orders;
    }
    async supplierContext(q) {
        const onDate = q.onDate?.slice(0, 10) ?? today();
        const [s] = await this.prisma.$queryRaw `
      SELECT s.sup_id, s.sup_name, s.sup_gst_no, s.sup_gst_type, s.sup_state_code, s.sup_state_name, s.sup_credit_days, s.sup_cash_disc_perc,
             s.sup_notes, COALESCE(s.sup_show_notes_on_entry, false) AS show_notes, COALESCE(s.sup_is_import, false) AS is_import,
             COALESCE(NULLIF(s.sup_msme_category, ''), NULLIF(l.led_msme_type, '')) AS msme_category, s.sup_msme_activity,
             s.sup_msme_agreement, s.sup_msme_agreed_days, l.led_udyam_no,
             s.sup_drug_liscence_no, s.sup_drug_licence_expiry, s.sup_fssai_no, s.sup_fssai_valid_to,
             s.sup_default_godown_id, g.gdl_name AS default_godown_name
        FROM purchase.suppliers s
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = s.sup_id
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = s.sup_default_godown_id
       WHERE s.sup_id = ${q.supplierId}::uuid AND NOT s.sup_is_deleted`;
        if (!s)
            (0, purchase_errors_1.purNotFound)(`Supplier ${q.supplierId} not found`);
        const [bal] = await this.prisma.$queryRaw `
      SELECT SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'CR') AS cr,
             SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'DR') AS dr,
             COUNT(*) FILTER (WHERE abl_dr_cr = 'CR') AS bills,
             COUNT(*) FILTER (WHERE abl_dr_cr = 'CR' AND abl_due_date < ${onDate}::date) AS overdue,
             MIN(abl_due_date) FILTER (WHERE abl_dr_cr = 'CR') AS oldest_due
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.supplierId}::uuid
         AND abl_is_active AND NOT abl_is_deleted AND abl_pending_amount > 0`;
        const [held] = await this.prisma.$queryRaw `
      SELECT COUNT(*) AS n FROM purchase.pur_invoice
       WHERE pi_company_id = ${q.companyId}::uuid AND pi_supplier_id = ${q.supplierId}::uuid AND pi_status = 'POSTED'
         AND NOT pi_is_deleted AND pi_payment_hold`;
        const pending = await this.orders.pendingLines({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId });
        const pos = new Map();
        for (const r of pending) {
            const id = String(r.poId);
            const cur = pos.get(id) ?? { poId: id, accYear: String(r.accYear), refno: String(r.refno), docDate: day(r.docDate), lines: 0 };
            cur.lines += 1;
            pos.set(id, cur);
        }
        const category = s.msme_category?.trim() || null;
        const activity = s.sup_msme_activity?.trim() || null;
        const dueDays = msmeDueDays(category, activity, s.sup_msme_agreement, s.sup_msme_agreed_days);
        const creditDays = s.sup_credit_days ?? null;
        const warnings = [];
        if (dueDays != null && creditDays != null && creditDays > dueDays)
            warnings.push({ code: 'MSME_DUE_BEFORE_CREDIT', message: `MSME: pay within ${dueDays} days of receipt (credit days ${creditDays} do not apply).` });
        const drugExp = day(s.sup_drug_licence_expiry), fssaiTo = day(s.sup_fssai_valid_to);
        if (drugExp && drugExp < onDate)
            warnings.push({ code: 'DRUG_LICENCE_EXPIRED', message: `Drug licence ${s.sup_drug_liscence_no ?? ''} expired on ${drugExp}.`.replace('  ', ' ') });
        if (fssaiTo && fssaiTo < onDate)
            warnings.push({ code: 'FSSAI_EXPIRED', message: `FSSAI licence ${s.sup_fssai_no ?? ''} expired on ${fssaiTo}.`.replace('  ', ' ') });
        const cr = (0, purchase_doc_helpers_1.D)(bal?.cr ?? 0), dr = (0, purchase_doc_helpers_1.D)(bal?.dr ?? 0);
        const billFrom = (await (0, purchase_bill_from_1.supplierBillFrom)(this.prisma, q.supplierId)).map((b) => ({
            addrId: b.addr_id, gstin: b.gstin, stateCode: b.state_code, stateName: b.state_name, name: b.name, addr: b.addr, place: b.place, pin: b.pin,
            isDefault: b.is_default, source: b.source
        }));
        return (0, purchase_doc_helpers_1.jsonSafe)({
            supplierId: s.sup_id, name: s.sup_name,
            gstNo: s.sup_gst_no ?? null, gstType: s.sup_gst_type ?? null, stateCode: s.sup_state_code ?? null, stateName: s.sup_state_name ?? null,
            creditDays, cashDiscPct: s.sup_cash_disc_perc ?? null,
            notes: s.sup_notes?.trim() || null, showNotesOnEntry: s.show_notes, isImport: s.is_import,
            defaultGodownId: s.sup_default_godown_id ?? null, defaultGodownName: s.default_godown_name ?? null,
            msme: category ? { category, activity, udyamNo: s.led_udyam_no ?? null, writtenAgreement: !!s.sup_msme_agreement,
                agreedDays: s.sup_msme_agreed_days ?? null, dueDays, payBy: dueDays != null ? addDays(onDate, dueDays) : null } : null,
            licences: { drugLicenceNo: s.sup_drug_liscence_no ?? null, drugLicenceExpiry: drugExp, fssaiNo: s.sup_fssai_no ?? null, fssaiValidTo: fssaiTo },
            billFrom,
            pendingPos: [...pos.values()],
            outstanding: { payable: cr, debits: dr, balance: cr.minus(dr), bills: Number(bal?.bills ?? 0), overdueBills: Number(bal?.overdue ?? 0),
                oldestDue: day(bal?.oldest_due), billsOnHold: Number(held?.n ?? 0) },
            warnings,
        });
    }
    async itemContext(q) {
        const onDate = q.onDate?.slice(0, 10) ?? today();
        const [item] = await this.prisma.$queryRaw `
      SELECT im.item_name_en AS item_name, b.iuc_id AS base_iuc, bu.unit_name AS base_unit
        FROM inventory.item_master im
        LEFT JOIN LATERAL (SELECT iuc_id, iuc_unit_id FROM inventory.item_unit_conversion
                            WHERE iuc_item_id = im.item_id AND iuc_is_base_unit AND NOT iuc_is_deleted ORDER BY iuc_unit_slno LIMIT 1) b ON true
        LEFT JOIN inventory.item_unit_master bu ON bu.unit_id = b.iuc_unit_id
       WHERE im.item_id = ${q.itemId}::uuid`;
        if (!item)
            (0, purchase_errors_1.purNotFound)(`Item ${q.itemId} not found`);
        const uomId = q.uomId ?? item.base_iuc;
        const last = await this.prisma.$queryRaw `
      SELECT pi.pi_doc_date AS "docDate", pi.pi_refno AS "refno", s.sup_name AS "supplierName", pi.pi_supplier_id AS "supplierId",
             pii.pii_rate AS "rate", pii.pii_disc_pct AS "discPct", u.unit_name AS "unitName",
             pii.pii_landed_cost_wot / NULLIF(pii.pii_to_base_factor, 0) AS "baseCostWot"
        FROM purchase.pur_invoice_item pii
        JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
        JOIN purchase.suppliers s ON s.sup_id = pi.pi_supplier_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = pii.pii_uom_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE pi.pi_company_id = ${q.companyId}::uuid AND pii.pii_item_id = ${q.itemId}::uuid
         AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
       ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC
       LIMIT 3`;
        let poRate = null;
        let supplierItem = null;
        if (q.supplierId) {
            const pending = await this.orders.pendingLines({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId });
            const p = pending.find((r) => r.itemId === q.itemId);
            if (p) {
                const net = (0, purchase_doc_helpers_1.D)(p.rate).times((0, purchase_doc_helpers_1.D)(1).minus((0, purchase_doc_helpers_1.D)(p.discPct).div(100))).times((0, purchase_doc_helpers_1.D)(1).minus((0, purchase_doc_helpers_1.D)(p.schPct).div(100)));
                poRate = { poId: p.poId, poiId: p.poiId, accYear: p.accYear, discPct: p.discPct, schPct: p.schPct, refno: p.refno, rate: p.rate, netRate: net.toDecimalPlaces(4), unitName: p.unitName, pendingQty: p.pendingQty };
            }
            const [psi] = await this.prisma.$queryRaw `
        SELECT psi_supplier_item_code AS "code", psi_supplier_barcode AS "barcode", psi_moq AS "moq", psi_lead_days AS "leadDays",
               psi_is_preferred AS "preferred", psi_pack_qty AS "packQty",
               psi_scheme_buy_qty AS "schemeBuyQty", psi_scheme_free_qty AS "schemeFreeQty"
          FROM purchase.pur_supplier_item
         WHERE psi_supplier_id = ${q.supplierId}::uuid AND psi_item_id = ${q.itemId}::uuid AND psi_is_active AND NOT psi_is_deleted
           AND (psi_company_id IS NULL OR psi_company_id = ${q.companyId}::uuid)
         ORDER BY psi_company_id NULLS LAST LIMIT 1`;
            supplierItem = psi ?? null;
        }
        const [stock] = await this.prisma.$queryRaw `
      SELECT SUM(sbl_on_hand_qty) FILTER (WHERE sbl_bucket = 'SALEABLE') AS saleable,
             SUM(sbl_on_hand_qty) FILTER (WHERE sbl_bucket = 'DAMAGED') AS damaged
        FROM stock.stock_balance
       WHERE sbl_company_id = ${q.companyId}::uuid AND sbl_branch_id = ${q.branchId}::uuid AND sbl_item_id = ${q.itemId}::uuid
         AND NOT sbl_is_deleted`;
        const [price] = uomId ? await this.prisma.$queryRaw `
      SELECT ipm_sales_price_a AS "sellA", ipm_sales_price_b AS "sellB", ipm_sales_price_c AS "sellC", ipm_sales_price_d AS "sellD",
             ipm_bucket_mrp AS "mrp", ipm_cost_wot AS "costWot", ipm_effective_from AS "effectiveFrom"
        FROM inventory.item_price_master
       WHERE ipm_item_id = ${q.itemId}::uuid AND ipm_uc_unit_id = ${uomId}::uuid AND ipm_is_active AND NOT ipm_is_deleted
         AND (ipm_company_id IS NULL OR ipm_company_id = ${q.companyId}::uuid)
         AND (ipm_branch_id IS NULL OR ipm_branch_id = ${q.branchId}::uuid)
         AND (ipm_effective_from IS NULL OR ipm_effective_from::date <= ${onDate}::date)
         AND (ipm_effective_to IS NULL OR ipm_effective_to::date >= ${onDate}::date)
       ORDER BY (ipm_branch_id IS NOT NULL) DESC, ipm_godown_id NULLS FIRST, ipm_effective_from DESC NULLS LAST, ipm_bucket_mrp DESC NULLS LAST
       LIMIT 1` : [];
        return (0, purchase_doc_helpers_1.jsonSafe)({
            itemId: q.itemId, itemName: item.item_name, baseUnit: item.base_unit,
            lastPurchases: last.map((r) => ({ ...r, docDate: day(r.docDate) })),
            poRate,
            stock: { saleable: (0, purchase_doc_helpers_1.D)(stock?.saleable ?? 0), damaged: (0, purchase_doc_helpers_1.D)(stock?.damaged ?? 0), unitName: item.base_unit },
            prices: price ? { ...price, effectiveFrom: day(price.effectiveFrom) } : null,
            supplierItem,
        });
    }
};
exports.PurchaseLookupService = PurchaseLookupService;
exports.PurchaseLookupService = PurchaseLookupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, purchase_order_1.PurchaseOrderService])
], PurchaseLookupService);
let PurchaseLookupController = class PurchaseLookupController {
    service;
    constructor(service) {
        this.service = service;
    }
    async supplierContext(q) {
        return { success: true, message: 'Supplier context', data: await this.service.supplierContext(q) };
    }
    async itemContext(q) {
        return { success: true, message: 'Item context', data: await this.service.itemContext(q) };
    }
};
exports.PurchaseLookupController = PurchaseLookupController;
__decorate([
    (0, common_1.Get)('supplier-context'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The supplier chips on an entry screen: GST, MSME pay-by, note, pending POs, outstanding, licence expiry (B9).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SupplierContextQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseLookupController.prototype, "supplierContext", null);
__decorate([
    (0, common_1.Get)('item-context'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The item strip on an entry screen: last purchases (all suppliers), PO rate, stock, selling prices, supplier code and scheme buy N get M (B9, ENT-07).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ItemContextQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseLookupController.prototype, "itemContext", null);
exports.PurchaseLookupController = PurchaseLookupController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Lookups'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/lookup'),
    __metadata("design:paramtypes", [PurchaseLookupService])
], PurchaseLookupController);
//# sourceMappingURL=purchase-lookup.js.map