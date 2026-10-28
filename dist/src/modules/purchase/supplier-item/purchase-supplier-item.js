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
exports.PurchaseSupplierItemController = exports.PurchaseSupplierItemService = exports.SupplierItemActiveDto = exports.SupplierItemRefDto = exports.SaveSupplierItemDto = exports.SUPPLIER_ITEM_MENU_ID = void 0;
exports.supplierItemId = supplierItemId;
exports.recordSupplierItems = recordSupplierItems;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.SUPPLIER_ITEM_MENU_ID = 295;
const PSI_NAMESPACE = '6f1d2c3b-4a59-4e78-8b90-a1b2c3d4e5f6';
function supplierItemId(companyId, supplierId, itemId) {
    const hash = (0, node_crypto_1.createHash)('sha1')
        .update(Buffer.from(PSI_NAMESPACE.replace(/-/g, ''), 'hex'))
        .update(`${(companyId ?? '').toLowerCase()}|${supplierId.toLowerCase()}|${itemId.toLowerCase()}`, 'utf8')
        .digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const h = hash.subarray(0, 16).toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
async function recordSupplierItems(tx, companyId, supplierId, lines, actor) {
    const seen = new Set();
    for (const l of lines) {
        if (seen.has(l.itemId))
            continue;
        seen.add(l.itemId);
        await tx.$executeRaw `
      INSERT INTO purchase.pur_supplier_item (psi_id, psi_company_id, psi_supplier_id, psi_item_id, psi_buy_uom_id, psi_pack_qty, psi_source, psi_created_by)
      VALUES (${supplierItemId(companyId, supplierId, l.itemId)}::uuid, ${companyId}::uuid, ${supplierId}::uuid, ${l.itemId}::uuid,
              ${l.uomId}::uuid, ${l.factor}::numeric, 'AUTO', ${actor})
      ON CONFLICT (psi_id) DO NOTHING`;
    }
}
class SaveSupplierItemDto {
    companyId;
    supplierId;
    itemId;
    supplierItemCode;
    supplierBarcode;
    buyUomId;
    packQty;
    moq;
    leadDays;
    isPreferred;
    isActive;
}
exports.SaveSupplierItemDto = SaveSupplierItemDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveSupplierItemDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveSupplierItemDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveSupplierItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "The supplier's own code for the item." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SaveSupplierItemDto.prototype, "supplierItemCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "The barcode on the supplier's pack (a scan finds the item)." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SaveSupplierItemDto.prototype, "supplierBarcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The unit we buy in (item_unit_conversion.iuc_id of the item).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveSupplierItemDto.prototype, "buyUomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Base units in one buy unit (default: the unit\'s factor).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.000001),
    __metadata("design:type", Number)
], SaveSupplierItemDto.prototype, "packQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveSupplierItemDto.prototype, "moq", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], SaveSupplierItemDto.prototype, "leadDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'First in Reorder → PO; one preferred supplier per item.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveSupplierItemDto.prototype, "isPreferred", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveSupplierItemDto.prototype, "isActive", void 0);
class SupplierItemRefDto {
    psiId;
}
exports.SupplierItemRefDto = SupplierItemRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierItemRefDto.prototype, "psiId", void 0);
class SupplierItemActiveDto extends SupplierItemRefDto {
    active;
}
exports.SupplierItemActiveDto = SupplierItemActiveDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SupplierItemActiveDto.prototype, "active", void 0);
let PurchaseSupplierItemService = class PurchaseSupplierItemService {
    prisma;
    ctx;
    constructor(prisma, ctx) {
        this.prisma = prisma;
        this.ctx = ctx;
    }
    actor() {
        const u = this.ctx.getUserId();
        if (!u)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        return u;
    }
    async save(dto) {
        const actor = this.actor();
        const id = supplierItemId(dto.companyId, dto.supplierId, dto.itemId);
        const code = dto.supplierItemCode?.trim() || null;
        const barcode = dto.supplierBarcode?.trim() || null;
        await this.prisma.$transaction(async (tx) => {
            const [sup] = await tx.$queryRaw `SELECT count(*) AS n FROM purchase.suppliers WHERE sup_id = ${dto.supplierId}::uuid AND NOT sup_is_deleted`;
            if (!Number(sup.n))
                (0, purchase_errors_1.purNotFound)(`Supplier ${dto.supplierId} not found`, purchase_errors_1.PUR.SUPPLIER_NOT_FOUND, 'supplierId');
            const [item] = await tx.$queryRaw `SELECT count(*) AS n FROM inventory.item_master WHERE item_id = ${dto.itemId}::uuid AND NOT item_is_deleted`;
            if (!Number(item.n))
                (0, purchase_errors_1.purNotFound)(`Item ${dto.itemId} not found`, purchase_errors_1.PUR.ITEM_NOT_FOUND, 'itemId');
            let pack = dto.packQty === undefined ? null : (0, purchase_doc_helpers_1.D)(dto.packQty);
            if (dto.buyUomId) {
                const [u] = await tx.$queryRaw `
          SELECT iuc_item_id, iuc_to_base_factor FROM inventory.item_unit_conversion WHERE iuc_id = ${dto.buyUomId}::uuid AND NOT iuc_is_deleted`;
                if (!u || u.iuc_item_id !== dto.itemId)
                    (0, purchase_errors_1.purRefuse)('The buy unit must be one of the item\'s units.', purchase_errors_1.PUR.UNIT_NOT_FOUND, 'buyUomId');
                pack = pack ?? (0, purchase_doc_helpers_1.D)(u.iuc_to_base_factor);
            }
            if (code) {
                const [c] = await tx.$queryRaw `
          SELECT im.item_name_en AS item FROM purchase.pur_supplier_item p JOIN inventory.item_master im ON im.item_id = p.psi_item_id
           WHERE p.psi_supplier_id = ${dto.supplierId}::uuid AND upper(p.psi_supplier_item_code) = upper(${code}) AND NOT p.psi_is_deleted
             AND p.psi_id <> ${id}::uuid AND (p.psi_company_id IS NULL OR p.psi_company_id = ${dto.companyId}::uuid) LIMIT 1`;
                if (c)
                    (0, purchase_errors_1.purConflict)(`Code ${code} is already this supplier's code for ${c.item}.`, 'PUR_SUPPLIER_CODE_TAKEN', 'supplierItemCode');
            }
            if (barcode) {
                const [b] = await tx.$queryRaw `
          SELECT im.item_name_en AS item, s.sup_name AS sup FROM purchase.pur_supplier_item p
            JOIN inventory.item_master im ON im.item_id = p.psi_item_id JOIN purchase.suppliers s ON s.sup_id = p.psi_supplier_id
           WHERE upper(p.psi_supplier_barcode) = upper(${barcode}) AND NOT p.psi_is_deleted AND p.psi_id <> ${id}::uuid
             AND p.psi_item_id <> ${dto.itemId}::uuid AND (p.psi_company_id IS NULL OR p.psi_company_id = ${dto.companyId}::uuid) LIMIT 1`;
                if (b)
                    (0, purchase_errors_1.purConflict)(`Barcode ${barcode} already finds ${b.item} (${b.sup}) — a scan would not know which item.`, 'PUR_SUPPLIER_BARCODE_TAKEN', 'supplierBarcode');
            }
            await tx.$executeRaw `
        INSERT INTO purchase.pur_supplier_item (psi_id, psi_company_id, psi_supplier_id, psi_item_id, psi_supplier_item_code, psi_supplier_barcode,
                    psi_buy_uom_id, psi_pack_qty, psi_moq, psi_lead_days, psi_is_preferred, psi_source, psi_is_active, psi_created_by)
        VALUES (${id}::uuid, ${dto.companyId}::uuid, ${dto.supplierId}::uuid, ${dto.itemId}::uuid, ${code}, ${barcode},
                ${dto.buyUomId ?? null}::uuid, ${pack ?? (0, purchase_doc_helpers_1.D)(1)}::numeric, ${dto.moq ?? null}::numeric, ${dto.leadDays ?? null}::smallint,
                ${dto.isPreferred ?? false}, 'TYPED', ${dto.isActive ?? true}, ${actor})
        ON CONFLICT (psi_id) DO UPDATE SET
          psi_supplier_item_code = EXCLUDED.psi_supplier_item_code, psi_supplier_barcode = EXCLUDED.psi_supplier_barcode,
          psi_buy_uom_id = EXCLUDED.psi_buy_uom_id, psi_pack_qty = EXCLUDED.psi_pack_qty, psi_moq = EXCLUDED.psi_moq,
          psi_lead_days = EXCLUDED.psi_lead_days, psi_is_preferred = EXCLUDED.psi_is_preferred, psi_source = 'TYPED',
          psi_is_active = EXCLUDED.psi_is_active, psi_is_deleted = false, psi_modified_on = now(), psi_modified_by = ${actor}`;
            if (dto.isPreferred) {
                await tx.$executeRaw `
          UPDATE purchase.pur_supplier_item SET psi_is_preferred = false, psi_modified_on = now(), psi_modified_by = ${actor}
           WHERE psi_item_id = ${dto.itemId}::uuid AND psi_id <> ${id}::uuid AND psi_is_preferred
             AND (psi_company_id IS NULL OR psi_company_id = ${dto.companyId}::uuid)`;
            }
        }, { timeout: 30000, maxWait: 10000 });
        return this.get(id);
    }
    async setActive(dto) {
        const actor = this.actor();
        const n = await this.prisma.$executeRaw `
      UPDATE purchase.pur_supplier_item SET psi_is_active = ${dto.active}, psi_is_preferred = (psi_is_preferred AND ${dto.active}),
             psi_modified_on = now(), psi_modified_by = ${actor}
       WHERE psi_id = ${dto.psiId}::uuid AND NOT psi_is_deleted`;
        if (!n)
            (0, purchase_errors_1.purNotFound)(`Supplier–item row ${dto.psiId} not found`);
        return this.get(dto.psiId);
    }
    async get(psiId) {
        const [row] = await this.prisma.$queryRaw `
      SELECT p.*, s.sup_name, im.item_name_en AS item_name, um.unit_name AS buy_unit_name,
             st.last_rate, st.last_date, st.bill_count
        FROM purchase.pur_supplier_item p
        JOIN purchase.suppliers s ON s.sup_id = p.psi_supplier_id
        JOIN inventory.item_master im ON im.item_id = p.psi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = p.psi_buy_uom_id
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
        LEFT JOIN LATERAL (
          SELECT (array_agg(pii.pii_rate ORDER BY pi.pi_doc_date DESC, pi.pi_created_on DESC))[1] AS last_rate,
                 max(pi.pi_doc_date) AS last_date, count(DISTINCT pi.pi_id) AS bill_count
            FROM purchase.pur_invoice_item pii
            JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
           WHERE pi.pi_supplier_id = p.psi_supplier_id AND pii.pii_item_id = p.psi_item_id
             AND pi.pi_status = 'POSTED' AND NOT pi.pi_is_deleted AND NOT pii.pii_is_deleted
             AND (p.psi_company_id IS NULL OR pi.pi_company_id = p.psi_company_id)) st ON true
       WHERE p.psi_id = ${psiId}::uuid AND NOT p.psi_is_deleted`;
        if (!row)
            (0, purchase_errors_1.purNotFound)(`Supplier–item row ${psiId} not found`);
        return (0, purchase_doc_helpers_1.jsonSafe)(row);
    }
};
exports.PurchaseSupplierItemService = PurchaseSupplierItemService;
exports.PurchaseSupplierItemService = PurchaseSupplierItemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseSupplierItemService);
let PurchaseSupplierItemController = class PurchaseSupplierItemController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.SUPPLIER_ITEM_MENU_ID, right, codePrefix: 'PSI', action });
    }
    async save(dto) {
        await this.right('edit', 'save a supplier–item row');
        return { success: true, message: 'Supplier–item saved', data: await this.service.save(dto) };
    }
    async active(dto) {
        await this.right('edit', 'switch a supplier–item row on or off');
        return { success: true, message: dto.active ? 'Reactivated' : 'Deactivated', data: await this.service.setActive(dto) };
    }
    async get(q) {
        await this.right('view', 'open a supplier–item row');
        return { success: true, message: 'Supplier–item fetched', data: await this.service.get(q.psiId) };
    }
};
exports.PurchaseSupplierItemController = PurchaseSupplierItemController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update the row of a (supplier, item) pair — one per company, id derived from the three.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SaveSupplierItemDto]),
    __metadata("design:returntype", Promise)
], PurchaseSupplierItemController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('active'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Switch a supplier–item row on or off (off also drops preferred).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SupplierItemActiveDto]),
    __metadata("design:returntype", Promise)
], PurchaseSupplierItemController.prototype, "active", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One row with names and the last rate / date / bill count from posted bills.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SupplierItemRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseSupplierItemController.prototype, "get", null);
exports.PurchaseSupplierItemController = PurchaseSupplierItemController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Supplier–Item map'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/supplier-items'),
    __metadata("design:paramtypes", [PurchaseSupplierItemService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseSupplierItemController);
//# sourceMappingURL=purchase-supplier-item.js.map