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
exports.PurchaseSisterController = exports.PurchaseSisterService = exports.SisterBillLinesQueryDto = exports.SisterBillListQueryDto = exports.SISTER = void 0;
exports.recordSisterPull = recordSisterPull;
exports.assertSaleBillNotPulled = assertSaleBillNotPulled;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.SISTER = {
    ALREADY_PULLED: 'SISTER_BILL_ALREADY_PULLED',
    ITEM_NOT_SHARED: 'ITEM_NOT_SHARED',
    NOT_A_SISTER_BILL: 'SISTER_BILL_INVALID',
    SUPPLIER_MISMATCH: 'SISTER_SUPPLIER_MISMATCH',
    SALE_BILL_PULLED: 'SALE_BILL_PULLED_BY_SISTER',
};
class SisterBillListQueryDto {
    companyId;
    branchId;
}
exports.SisterBillListQueryDto = SisterBillListQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SisterBillListQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SisterBillListQueryDto.prototype, "branchId", void 0);
class SisterBillLinesQueryDto extends SisterBillListQueryDto {
    sbId;
    accYear;
}
exports.SisterBillLinesQueryDto = SisterBillLinesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SisterBillLinesQueryDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], SisterBillLinesQueryDto.prototype, "accYear", void 0);
const pan = (gstin) => (gstin && gstin.length >= 12 ? gstin.slice(2, 12).toUpperCase() : null);
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
async function ourCompany(db, companyId) {
    const [c] = await db.$queryRaw `
    SELECT comp_id, comp_name, comp_gstin_no FROM public.companys WHERE comp_id = ${companyId}::uuid AND NOT comp_is_deleted`;
    if (!c)
        (0, purchase_errors_1.purNotFound)(`Company ${companyId} not found`);
    return c;
}
async function supplierOfSister(db, companyId, sisterGstin) {
    if (!sisterGstin)
        return null;
    const [s] = await db.$queryRaw `
    SELECT sup_id, sup_name, sup_gst_no FROM purchase.suppliers
     WHERE NOT sup_is_deleted AND sup_is_active AND (sup_company_id IS NULL OR sup_company_id = ${companyId}::uuid)
       AND (upper(sup_gst_no) = upper(${sisterGstin}) OR substr(upper(sup_gst_no), 3, 10) = ${pan(sisterGstin)})
     ORDER BY (upper(sup_gst_no) = upper(${sisterGstin})) DESC, sup_name LIMIT 1`;
    return s ?? null;
}
async function pullsOf(db, sbId, exceptPiId) {
    return db.$queryRaw `
    SELECT DISTINCT pi.pi_id, pi.pi_refno, c.comp_name
      FROM purchase.pur_invoice_item pii
      JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
      JOIN public.companys c ON c.comp_id = pi.pi_company_id
     WHERE pii.pii_src_doc_type = 'SALE_BILL' AND pii.pii_src_doc_id = ${sbId}::uuid AND NOT pii.pii_is_deleted
       AND NOT pi.pi_is_deleted AND pi.pi_status <> 'CANCELLED'
       AND (${exceptPiId}::uuid IS NULL OR pi.pi_id <> ${exceptPiId}::uuid)`;
}
async function unsharedItems(db, companyId, itemIds) {
    if (!itemIds.length)
        return [];
    return db.$queryRaw `
    SELECT item_id, item_name_en AS item_name FROM inventory.item_master
     WHERE item_id = ANY(${itemIds}::uuid[]) AND item_company_id IS NOT NULL AND item_company_id <> ${companyId}::uuid`;
}
let PurchaseSisterService = class PurchaseSisterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get db() { return this.prisma; }
    async list(q) {
        const us = await ourCompany(this.db, q.companyId);
        const ourPan = pan(us.comp_gstin_no);
        if (!us.comp_gstin_no)
            return [];
        const bills = await this.prisma.$queryRaw `
      SELECT sb.sb_id, sb.sb_acc_year, sb.sb_bill_refno, sb.sb_bill_date, sb.sb_bill_amt, sb.sb_tot_items, sb.sb_cust_gstin,
             sb.sb_company_id, c.comp_name, c.comp_gstin_no
        FROM sales.sale_bill sb
        JOIN public.companys c ON c.comp_id = sb.sb_company_id
       WHERE sb.sb_status = 'POSTED' AND NOT sb.sb_is_deleted AND sb.sb_company_id <> ${q.companyId}::uuid
         AND (upper(sb.sb_cust_gstin) = upper(${us.comp_gstin_no}) OR substr(upper(sb.sb_cust_gstin), 3, 10) = ${ourPan})
       ORDER BY sb.sb_bill_date DESC, sb.sb_bill_refno DESC
       LIMIT 200`;
        const out = [];
        for (const b of bills) {
            const pulled = await pullsOf(this.db, String(b.sb_id), null);
            const supplier = await supplierOfSister(this.db, q.companyId, b.comp_gstin_no);
            const items = await this.prisma.$queryRaw `
        SELECT DISTINCT sbi_item_id AS item_id FROM sales.sale_bill_item
         WHERE sbi_bill_id = ${b.sb_id}::uuid AND sbi_acc_year = ${b.sb_acc_year}::bpchar AND NOT sbi_is_deleted`;
            const unshared = await unsharedItems(this.db, q.companyId, items.map((i) => i.item_id));
            const blocked = pulled.length ? `Already pulled into ${pulled[0].pi_refno}`
                : !supplier ? `${b.comp_name} (${b.comp_gstin_no}) is not a supplier here yet`
                    : unshared.length ? `Items not shared with this company: ${unshared.map((u) => u.item_name).join(', ')}` : null;
            out.push({
                sbId: b.sb_id, accYear: b.sb_acc_year, refno: b.sb_bill_refno, billDate: day(b.sb_bill_date), amount: b.sb_bill_amt, items: b.sb_tot_items,
                sisterCompanyId: b.sb_company_id, sisterCompanyName: b.comp_name, sisterGstin: b.comp_gstin_no,
                supplierId: supplier?.sup_id ?? null, supplierName: supplier?.sup_name ?? null, blocked,
            });
        }
        return (0, purchase_doc_helpers_1.jsonSafe)(out);
    }
    async lines(q) {
        const all = await this.list(q);
        const b = all.find((x) => x.sbId === q.sbId);
        if (!b)
            (0, purchase_errors_1.purNotFound)(`Sale bill ${q.sbId} is not a sister company's bill raised on this company`);
        const rows = await this.prisma.$queryRaw `
      SELECT sbi.sbi_id, sbi.sbi_line_no, sbi.sbi_item_id, im.item_name_en AS item_name, sbi.sbi_item_unit_id, u.unit_name,
             sbi.sbi_bill_qty, sbi.sbi_is_free, sbi.sbi_taxable_amt, sbi.sbi_tax_id, sbi.sbi_tax_perc, sbi.sbi_cess_perc, sbi.sbi_max_price,
             sbi.sbi_batch_no, sbi.sbi_expiry_date, sbi.sbi_hsn_code
        FROM sales.sale_bill_item sbi
        JOIN inventory.item_master im ON im.item_id = sbi.sbi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sbi.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE sbi.sbi_bill_id = ${q.sbId}::uuid AND sbi.sbi_acc_year = ${q.accYear}::bpchar AND NOT sbi.sbi_is_deleted
       ORDER BY sbi.sbi_line_no, sbi.sbi_split_no`;
        const lines = [];
        for (const r of rows) {
            const qty = (0, purchase_doc_helpers_1.D)(r.sbi_bill_qty);
            if (r.sbi_is_free) {
                const paid = lines.find((l) => l.itemId === r.sbi_item_id && l.uomId === r.sbi_item_unit_id);
                if (paid) {
                    paid.freeQty = (0, purchase_doc_helpers_1.D)(paid.freeQty).plus(qty);
                    continue;
                }
            }
            lines.push({
                sisterSaleItemId: r.sbi_id, sisterSaleItemAccYear: q.accYear, saleLineNo: r.sbi_line_no,
                itemId: r.sbi_item_id, itemName: r.item_name, uomId: r.sbi_item_unit_id, unitName: r.unit_name, hsnCode: r.sbi_hsn_code,
                billedQty: r.sbi_is_free ? (0, purchase_doc_helpers_1.D)(0) : qty, freeQty: r.sbi_is_free ? qty : (0, purchase_doc_helpers_1.D)(0),
                rate: r.sbi_is_free || qty.isZero() ? (0, purchase_doc_helpers_1.D)(0) : (0, purchase_doc_helpers_1.D)(r.sbi_taxable_amt).div(qty).toDecimalPlaces(4),
                taxId: r.sbi_tax_id, gstPct: r.sbi_tax_perc, cessPct: r.sbi_cess_perc, mrp: r.sbi_max_price,
                batchNo: r.sbi_batch_no, expiryDate: day(r.sbi_expiry_date),
            });
        }
        return (0, purchase_doc_helpers_1.jsonSafe)({ bill: b, lines });
    }
};
exports.PurchaseSisterService = PurchaseSisterService;
exports.PurchaseSisterService = PurchaseSisterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PurchaseSisterService);
async function recordSisterPull(tx, a, lines) {
    const named = lines.filter((l) => l.sisterSaleItemId);
    if (!named.length)
        return;
    const sale = await tx.$queryRaw `
    SELECT sbi.sbi_id, sbi.sbi_line_no, sbi.sbi_item_id, sb.sb_id, sb.sb_acc_year, sb.sb_bill_refno, sb.sb_company_id, sb.sb_status, sb.sb_cust_gstin, c.comp_gstin_no
      FROM sales.sale_bill_item sbi
      JOIN sales.sale_bill sb ON sb.sb_id = sbi.sbi_bill_id AND sb.sb_acc_year = sbi.sbi_acc_year
      JOIN public.companys c ON c.comp_id = sb.sb_company_id
     WHERE sbi.sbi_id = ANY(${named.map((l) => l.sisterSaleItemId)}::uuid[]) AND NOT sbi.sbi_is_deleted`;
    const bySbi = new Map(sale.map((s) => [s.sbi_id, s]));
    const bills = new Set(sale.map((s) => s.sb_id));
    if (bills.size !== 1 || sale.length !== new Set(named.map((l) => l.sisterSaleItemId)).size)
        (0, purchase_errors_1.purRefuse)('A purchase pulls the lines of ONE sister sale bill, and every line must be found on it.', exports.SISTER.NOT_A_SISTER_BILL, 'lines.sisterSaleItemId');
    const sb = sale[0];
    const us = await ourCompany(tx, a.companyId);
    if (sb.sb_status !== 'POSTED' || sb.sb_company_id === a.companyId
        || !(sb.sb_cust_gstin && us.comp_gstin_no && (sb.sb_cust_gstin.toUpperCase() === us.comp_gstin_no.toUpperCase() || pan(sb.sb_cust_gstin) === pan(us.comp_gstin_no))))
        (0, purchase_errors_1.purRefuse)(`${sb.sb_bill_refno} is not a posted sister company sale bill raised on this company.`, exports.SISTER.NOT_A_SISTER_BILL, 'lines.sisterSaleItemId');
    const pulled = await pullsOf(tx, sb.sb_id, a.piId);
    if (pulled.length)
        (0, purchase_errors_1.purRefuse)(`${sb.sb_bill_refno} is already in purchase ${pulled[0].pi_refno} (${pulled[0].comp_name}).`, exports.SISTER.ALREADY_PULLED, 'lines.sisterSaleItemId', 409);
    const supplier = await supplierOfSister(tx, a.companyId, sb.comp_gstin_no);
    if (!supplier || supplier.sup_id !== a.supplierId)
        (0, purchase_errors_1.purRefuse)(`The supplier must be the sister company as a supplier (GSTIN ${sb.comp_gstin_no ?? '—'}).`, exports.SISTER.SUPPLIER_MISMATCH, 'header.supplierId');
    const unshared = await unsharedItems(tx, a.companyId, [...new Set(named.map((l) => l.itemId))]);
    if (unshared.length)
        (0, purchase_errors_1.purRefuse)(`Items not shared with this company: ${unshared.map((u) => u.item_name).join(', ')}.`, exports.SISTER.ITEM_NOT_SHARED, 'lines.itemId');
    for (const l of named) {
        const s = bySbi.get(l.sisterSaleItemId);
        if (s.sbi_item_id !== l.itemId)
            (0, purchase_errors_1.purRefuse)(`Line ${l.lineNo}: the item is not the sale line's.`, exports.SISTER.NOT_A_SISTER_BILL, `lines.${l.lineNo - 1}.itemId`);
        await tx.$executeRaw `
      UPDATE purchase.pur_invoice_item
         SET pii_src_doc_type = 'SALE_BILL', pii_src_doc_id = ${s.sb_id}::uuid, pii_src_doc_year = ${s.sb_acc_year}::bpchar,
             pii_src_item_id = ${s.sbi_id}::uuid, pii_src_doc_line_no = ${s.sbi_line_no}, pii_src_doc_refno = ${s.sb_bill_refno}
       WHERE pii_pi_id = ${a.piId}::uuid AND pii_acc_year = ${a.accYear}::bpchar AND pii_line_no = ${l.lineNo} AND NOT pii_is_deleted`;
    }
    await tx.$executeRaw `
    UPDATE purchase.pur_invoice SET pi_source_kind = 'SISTER_SALE', pi_sister_company_id = ${sb.sb_company_id}::uuid
     WHERE pi_id = ${a.piId}::uuid AND pi_acc_year = ${a.accYear}::bpchar`;
}
async function assertSaleBillNotPulled(db, sbId) {
    const pulled = await pullsOf(db, sbId, null);
    if (pulled.length)
        (0, purchase_errors_1.purRefuse)(`This bill is in ${pulled[0].comp_name}'s purchase ${pulled[0].pi_refno} — cancel that purchase first.`, exports.SISTER.SALE_BILL_PULLED, 'sbId', 409);
}
let PurchaseSisterController = class PurchaseSisterController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(q) {
        return { success: true, message: 'Sister company bills', data: await this.service.list(q) };
    }
    async lines(q) {
        return { success: true, message: 'Sister bill lines', data: await this.service.lines(q) };
    }
};
exports.PurchaseSisterController = PurchaseSisterController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'DOC-08: posted sale bills of sister companies raised on this company, with what would stop a pull.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SisterBillListQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseSisterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'DOC-08: one sister sale bill in the purchase line shape (the line keeps sisterSaleItemId).' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SisterBillLinesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseSisterController.prototype, "lines", null);
exports.PurchaseSisterController = PurchaseSisterController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Sister company bills'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/sister-bills'),
    __metadata("design:paramtypes", [PurchaseSisterService])
], PurchaseSisterController);
//# sourceMappingURL=purchase-sister.js.map