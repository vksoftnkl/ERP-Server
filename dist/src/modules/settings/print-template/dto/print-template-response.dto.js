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
exports.PrintTemplateSuccessDeleteDto = exports.PrintTemplateSuccessListDto = exports.PrintTemplateSuccessSingleDto = exports.PrintTemplateListMetaDto = exports.PrintTemplateDeleteResultDto = exports.PrintTemplatePayloadDto = exports.PrintTemplateVersionPayloadDto = exports.PrintTemplateDatasetPayloadDto = exports.PrintTemplateErrorResponseDto = exports.PrintTemplateErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "PrintTemplateErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorFieldDto; } });
Object.defineProperty(exports, "PrintTemplateErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorResponseDto; } });
const print_template_constants_1 = require("../print-template.constants");
class PrintTemplateDatasetPayloadDto {
    ptdId;
    ptdVersionId;
    ptdRole;
    ptdDatasetNo;
    ptdSortOrder;
    ptdName;
    ptdLabel;
    ptdSourceKind;
    ptdProviderCode;
    ptdSql;
    ptdSqlNorm;
    ptdRequiresCompany;
    ptdParentNo;
    ptdLinkFields;
    ptdRowLimit;
    ptdTimeoutMs;
    ptdRemarks;
    ptdIsDeleted;
    ptdSyncDate;
    ptdCreatedOn;
    ptdCreatedBy;
    ptdModifiedOn;
    ptdModifiedBy;
}
exports.PrintTemplateDatasetPayloadDto = PrintTemplateDatasetPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateDatasetPayloadDto.prototype, "ptdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateDatasetPayloadDto.prototype, "ptdVersionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_constants_1.PTD_ROLES }),
    __metadata("design:type", String)
], PrintTemplateDatasetPayloadDto.prototype, "ptdRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'THE BINDING. The master is always 0.' }),
    __metadata("design:type", Number)
], PrintTemplateDatasetPayloadDto.prototype, "ptdDatasetNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Display order only. Binds nothing.' }),
    __metadata("design:type", Number)
], PrintTemplateDatasetPayloadDto.prototype, "ptdSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'items' }),
    __metadata("design:type", String)
], PrintTemplateDatasetPayloadDto.prototype, "ptdName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_constants_1.PTD_SOURCE_KINDS }),
    __metadata("design:type", String)
], PrintTemplateDatasetPayloadDto.prototype, "ptdSourceKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdProviderCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdSql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Read-only, computed by the database: comments stripped, literals and quoted identifiers ' +
            'replaced by tokens, casts flattened, lowercased. Every SQL guard reads THIS, not ptdSql, ' +
            'so it is what to look at when a guard refuses a query that looks fine.',
    }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdSqlNorm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateDatasetPayloadDto.prototype, "ptdRequiresCompany", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdParentNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: 'sb_id=bill_id' }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdLinkFields", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000 }),
    __metadata("design:type", Number)
], PrintTemplateDatasetPayloadDto.prototype, "ptdRowLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 15000 }),
    __metadata("design:type", Number)
], PrintTemplateDatasetPayloadDto.prototype, "ptdTimeoutMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PrintTemplateDatasetPayloadDto.prototype, "ptdIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], PrintTemplateDatasetPayloadDto.prototype, "ptdCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateDatasetPayloadDto.prototype, "ptdModifiedBy", void 0);
class PrintTemplateVersionPayloadDto {
    ptvId;
    ptvTemplateId;
    ptvRevNo;
    ptvStatus;
    ptvEngine;
    ptvBody;
    ptvSchemaVer;
    ptvPaperCode;
    ptvOrientation;
    ptvWidthMm;
    ptvHeightMm;
    ptvMarginTopMm;
    ptvMarginBottomMm;
    ptvMarginLeftMm;
    ptvMarginRightMm;
    ptvColumns;
    ptvLang;
    ptvFontFamily;
    ptvParams;
    ptvNote;
    ptvApprovedOn;
    ptvApprovedBy;
    ptvIsDeleted;
    ptvSyncDate;
    ptvCreatedOn;
    ptvCreatedBy;
    ptvModifiedOn;
    ptvModifiedBy;
    ptvIsPublishedRev;
    ptvIsEditable;
    datasets;
}
exports.PrintTemplateVersionPayloadDto = PrintTemplateVersionPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvTemplateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PrintTemplateVersionPayloadDto.prototype, "ptvRevNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_constants_1.PTV_STATUSES }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_constants_1.PTV_ENGINES }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvEngine", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The design. Text — a JSON object for JSON_BANDS.' }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvBody", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PrintTemplateVersionPayloadDto.prototype, "ptvSchemaVer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'A4' }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvPaperCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_constants_1.PTV_ORIENTATIONS }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvOrientation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvWidthMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvHeightMm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PrintTemplateVersionPayloadDto.prototype, "ptvMarginTopMm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PrintTemplateVersionPayloadDto.prototype, "ptvMarginBottomMm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PrintTemplateVersionPayloadDto.prototype, "ptvMarginLeftMm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PrintTemplateVersionPayloadDto.prototype, "ptvMarginRightMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 48 }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvColumns", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'en-IN' }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvLang", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvFontFamily", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'array',
        items: { type: 'object' },
        nullable: true,
        description: 'What the operator is asked, once, for the whole render',
    }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvParams", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvNote", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvApprovedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvApprovedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PrintTemplateVersionPayloadDto.prototype, "ptvIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], PrintTemplateVersionPayloadDto.prototype, "ptvCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateVersionPayloadDto.prototype, "ptvModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'Derived: is this the revision the template currently publishes?',
    }),
    __metadata("design:type", Boolean)
], PrintTemplateVersionPayloadDto.prototype, "ptvIsPublishedRev", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Derived: DRAFT and nothing else. A published version is never UPDATEd.',
    }),
    __metadata("design:type", Boolean)
], PrintTemplateVersionPayloadDto.prototype, "ptvIsEditable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateDatasetPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], PrintTemplateVersionPayloadDto.prototype, "datasets", void 0);
class PrintTemplatePayloadDto {
    ptlId;
    ptlCompanyId;
    ptlCompanyName;
    ptlPurposeId;
    ptlPurposeCode;
    ptlPurposeName;
    ptlCode;
    ptlName;
    ptlDescription;
    ptlPublishedRevId;
    ptlPublishedRevNo;
    ptlForkedFromId;
    ptlForkedFromCode;
    ptlForkedFromRev;
    ptlSortOrder;
    ptlCompanyKey;
    ptlIsActive;
    ptlIsDeleted;
    ptlSyncDate;
    ptlCreatedOn;
    ptlCreatedBy;
    ptlModifiedOn;
    ptlModifiedBy;
    versions;
}
exports.PrintTemplatePayloadDto = PrintTemplatePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplatePayloadDto.prototype, "ptlId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'NULL = shipped with the product',
    }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplatePayloadDto.prototype, "ptlPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: 'SALE_INVOICE' }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlPurposeCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlPurposeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SALE_INVOICE_A4' }),
    __metadata("design:type", String)
], PrintTemplatePayloadDto.prototype, "ptlCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tax Invoice — A4' }),
    __metadata("design:type", String)
], PrintTemplatePayloadDto.prototype, "ptlName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlPublishedRevId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlPublishedRevNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlForkedFromId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlForkedFromCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlForkedFromRev", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], PrintTemplatePayloadDto.prototype, "ptlSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Read-only, generated: the owner with NULL folded to the nil uuid',
    }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlCompanyKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplatePayloadDto.prototype, "ptlIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PrintTemplatePayloadDto.prototype, "ptlIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], PrintTemplatePayloadDto.prototype, "ptlCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PrintTemplatePayloadDto.prototype, "ptlModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: PrintTemplateVersionPayloadDto,
        isArray: true,
        description: 'Newest revision first',
    }),
    __metadata("design:type", Array)
], PrintTemplatePayloadDto.prototype, "versions", void 0);
class PrintTemplateDeleteResultDto {
    ptlId;
    deleted;
}
exports.PrintTemplateDeleteResultDto = PrintTemplateDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateDeleteResultDto.prototype, "ptlId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateDeleteResultDto.prototype, "deleted", void 0);
class PrintTemplateListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.PrintTemplateListMetaDto = PrintTemplateListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PrintTemplateListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], PrintTemplateListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PrintTemplateListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PrintTemplateListMetaDto.prototype, "total_pages", void 0);
class PrintTemplateSuccessSingleDto {
    success;
    message;
    data;
}
exports.PrintTemplateSuccessSingleDto = PrintTemplateSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template fetched successfully' }),
    __metadata("design:type", String)
], PrintTemplateSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplatePayloadDto }),
    __metadata("design:type", PrintTemplatePayloadDto)
], PrintTemplateSuccessSingleDto.prototype, "data", void 0);
class PrintTemplateSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.PrintTemplateSuccessListDto = PrintTemplateSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print templates fetched successfully' }),
    __metadata("design:type", String)
], PrintTemplateSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplatePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], PrintTemplateSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateListMetaDto }),
    __metadata("design:type", PrintTemplateListMetaDto)
], PrintTemplateSuccessListDto.prototype, "meta", void 0);
class PrintTemplateSuccessDeleteDto {
    success;
    message;
    data;
}
exports.PrintTemplateSuccessDeleteDto = PrintTemplateSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template deleted successfully' }),
    __metadata("design:type", String)
], PrintTemplateSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateDeleteResultDto }),
    __metadata("design:type", PrintTemplateDeleteResultDto)
], PrintTemplateSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=print-template-response.dto.js.map