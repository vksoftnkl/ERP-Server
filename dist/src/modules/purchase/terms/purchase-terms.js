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
exports.PurchaseTermsController = exports.PurchaseTermsService = exports.TermsDeleteDto = exports.TermsRefDto = exports.SaveTermsDto = exports.TERMS_MENU_ID = void 0;
exports.termsOf = termsOf;
exports.pickableTermsId = pickableTermsId;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.TERMS_MENU_ID = 23;
class SaveTermsDto {
    pteId;
    companyId;
    code;
    name;
    termsText;
    sort;
    isActive;
}
exports.SaveTermsDto = SaveTermsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveTermsDto.prototype, "pteId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'The owning company; null / omitted on create = shared with every company. Omit on update = keep.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], SaveTermsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Letters, digits, _ or - (unique per company, any case).', maxLength: 30 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(30),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_-]+$/, { message: 'code may hold only letters, digits, _ and -' }),
    __metadata("design:type", String)
], SaveTermsDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SaveTermsDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The terms text copied into the PO.' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveTermsDto.prototype, "termsText", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'List order (dropdown 73 sorts by it, then name). Default 0.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SaveTermsDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default true.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveTermsDto.prototype, "isActive", void 0);
class TermsRefDto {
    pteId;
}
exports.TermsRefDto = TermsRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TermsRefDto.prototype, "pteId", void 0);
class TermsDeleteDto extends TermsRefDto {
}
exports.TermsDeleteDto = TermsDeleteDto;
let PurchaseTermsService = class PurchaseTermsService {
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
        const name = dto.name.replace(/\s+/g, ' ').trim();
        if (!name)
            (0, purchase_errors_1.purRefuse)('Give the terms a name.', 'PUR_TERMS_NAME_REQUIRED', 'name');
        const code = dto.code.trim();
        const text = dto.termsText.trim();
        if (!text)
            (0, purchase_errors_1.purRefuse)('Type the terms text.', 'PUR_TERMS_TEXT_REQUIRED', 'termsText');
        let id = dto.pteId ?? null;
        try {
            if (!id) {
                const row = await this.prisma.purTerms.create({ data: {
                        pteCompanyId: dto.companyId ?? null, pteCode: code, pteName: name, pteTermsText: text, pteSort: dto.sort ?? 0, pteIsActive: dto.isActive ?? true, pteCreatedBy: actor,
                    }, select: { pteId: true } });
                id = row.pteId;
            }
            else {
                const cur = await this.prisma.purTerms.findFirst({ where: { pteId: id, pteIsDeleted: false }, select: { pteId: true } });
                if (!cur)
                    (0, purchase_errors_1.purNotFound)(`PO terms ${id} not found`, 'PUR_TERMS_NOT_FOUND', 'pteId');
                await this.prisma.purTerms.update({ where: { pteId: id }, data: {
                        pteCode: code, pteName: name, pteTermsText: text,
                        ...((0, module_shared_utils_1.isPresentField)(dto, 'companyId') ? { pteCompanyId: dto.companyId ?? null } : {}),
                        ...(dto.sort !== undefined ? { pteSort: dto.sort } : {}),
                        ...(dto.isActive !== undefined ? { pteIsActive: dto.isActive } : {}),
                        pteModifiedBy: actor, pteModifiedOn: new Date(),
                    } });
            }
        }
        catch (e) {
            if ((0, module_shared_utils_1.isUniqueConstraintError)(e))
                (0, purchase_errors_1.purConflict)(`PO terms with the code "${code}" already exist.`, 'PUR_TERMS_CODE_EXISTS', 'code');
            if ((0, module_shared_utils_1.isForeignKeyConstraintError)(e))
                (0, purchase_errors_1.purNotFound)(`Company ${dto.companyId} not found`, 'PUR_COMPANY_NOT_FOUND', 'companyId');
            throw e;
        }
        return this.get(id);
    }
    async get(pteId) {
        const [row] = await this.prisma.$queryRaw `
      SELECT t.pte_id AS "pteId", t.pte_company_id AS "companyId", c.comp_name AS "companyName", t.pte_code AS "code", t.pte_name AS "name",
             t.pte_terms_text AS "termsText", t.pte_sort AS "sort", t.pte_is_active AS "isActive",
             t.pte_created_on AS "createdOn", t.pte_created_by AS "createdBy", t.pte_modified_on AS "modifiedOn", t.pte_modified_by AS "modifiedBy",
             (SELECT count(*) FROM purchase.pur_order o WHERE o.po_terms_id = t.pte_id AND NOT o.po_is_deleted)::int AS "poCount"
        FROM purchase.pur_terms t LEFT JOIN public.companys c ON c.comp_id = t.pte_company_id
       WHERE t.pte_id = ${pteId}::uuid AND NOT t.pte_is_deleted`;
        if (!row)
            (0, purchase_errors_1.purNotFound)(`PO terms ${pteId} not found`, 'PUR_TERMS_NOT_FOUND', 'pteId');
        return (0, purchase_doc_helpers_1.jsonSafe)(row);
    }
    async delete(dto) {
        const actor = this.actor();
        const n = await this.prisma.purTerms.updateMany({ where: { pteId: dto.pteId, pteIsDeleted: false },
            data: { pteIsDeleted: true, pteModifiedBy: actor, pteModifiedOn: new Date() } });
        if (!n.count)
            (0, purchase_errors_1.purNotFound)(`PO terms ${dto.pteId} not found`, 'PUR_TERMS_NOT_FOUND', 'pteId');
        return { pteId: dto.pteId, deleted: true };
    }
};
exports.PurchaseTermsService = PurchaseTermsService;
exports.PurchaseTermsService = PurchaseTermsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseTermsService);
async function termsOf(db, termsId, companyId, field = 'header.termsId', opts = {}) {
    const [t] = await db.$queryRaw `
    SELECT pte_id AS id, pte_name AS name, pte_terms_text AS text, pte_company_id AS company, pte_is_active AS active
      FROM purchase.pur_terms WHERE pte_id = ${termsId}::uuid AND NOT pte_is_deleted`;
    if (opts.keep)
        return t ?? null;
    if (!t || (t.company && t.company !== companyId))
        (0, purchase_errors_1.purNotFound)(`PO terms ${termsId} not found`, 'PUR_TERMS_NOT_FOUND', field);
    if (!t.active)
        (0, purchase_errors_1.purConflict)(`PO terms "${t.name}" are switched off — pick other terms.`, 'PUR_TERMS_INACTIVE', field);
    return t;
}
async function pickableTermsId(db, termsId, companyId) {
    if (!termsId)
        return null;
    const [t] = await db.$queryRaw `
    SELECT pte_id AS id FROM purchase.pur_terms
     WHERE pte_id = ${termsId}::uuid AND NOT pte_is_deleted AND pte_is_active AND (pte_company_id IS NULL OR pte_company_id = ${companyId}::uuid)`;
    return t?.id ?? null;
}
let PurchaseTermsController = class PurchaseTermsController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.TERMS_MENU_ID, right, codePrefix: 'PO', action });
    }
    async create(dto) {
        await this.right(dto.pteId ? 'edit' : 'create', 'save PO terms');
        const data = await this.service.save(dto);
        return { success: true, message: `PO terms ${String(data.code)} saved`, data };
    }
    async get(q) {
        await this.right('view', 'open PO terms');
        return { success: true, message: 'PO terms fetched', data: await this.service.get(q.pteId) };
    }
    async delete(dto) {
        await this.right('delete', 'delete PO terms');
        return { success: true, message: 'PO terms deleted', data: await this.service.delete(dto) };
    }
};
exports.PurchaseTermsController = PurchaseTermsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create a PO terms row (no pteId) or update one (pteId). Code unique per company, any case: 409 PUR_TERMS_CODE_EXISTS. Create / Edit on menu 23.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SaveTermsDto]),
    __metadata("design:returntype", Promise)
], PurchaseTermsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One PO terms row and how many POs name it. View on menu 23.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TermsRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseTermsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a PO terms row (soft). POs keep their own copy of the text. Delete on menu 23.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TermsDeleteDto]),
    __metadata("design:returntype", Promise)
], PurchaseTermsController.prototype, "delete", null);
exports.PurchaseTermsController = PurchaseTermsController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — PO terms'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/terms'),
    __metadata("design:paramtypes", [PurchaseTermsService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseTermsController);
//# sourceMappingURL=purchase-terms.js.map