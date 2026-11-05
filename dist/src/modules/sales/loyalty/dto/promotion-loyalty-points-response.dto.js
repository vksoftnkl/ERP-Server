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
exports.LoyaltySchemeEligibilitySuccessDto = exports.LoyaltySchemeEligibilityPayloadDto = exports.LoyaltySchemeSuccessDeleteDto = exports.LoyaltySchemeSuccessListDto = exports.LoyaltySchemeSuccessSingleDto = exports.LoyaltySchemeDeleteResultDto = exports.LoyaltySchemePayloadDto = exports.LoyaltySchemeSummaryPayloadDto = exports.LoyaltySchemeGiftPayloadDto = exports.LoyaltySchemeSlabPayloadDto = exports.LoyaltySchemeItemPayloadDto = exports.LoyaltySchemePartyPayloadDto = exports.LoyaltySchemeBranchPayloadDto = exports.PromotionLoyaltyPointsErrorResponseDto = exports.PromotionLoyaltyPointsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "PromotionLoyaltyPointsErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "PromotionLoyaltyPointsErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class LoyaltySchemeBranchPayloadDto {
    lsb_id;
    lsb_lsc_id;
    lsb_slno;
    lsb_branch_id;
    lsb_branch_name;
    lsb_branch_code;
    lsb_is_exclude;
    lsb_notes;
    lsb_is_active;
    lsb_is_deleted;
    lsb_sync_date;
    lsb_created_on;
    lsb_created_by;
    lsb_modified_on;
    lsb_modified_by;
}
exports.LoyaltySchemeBranchPayloadDto = LoyaltySchemeBranchPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'branch_master.br_name' }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'br_code, else br_short' }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_branch_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeBranchPayloadDto.prototype, "lsb_modified_by", void 0);
class LoyaltySchemePartyPayloadDto {
    lsp_id;
    lsp_lsc_id;
    lsp_slno;
    lsp_kind;
    lsp_scope_id;
    lsp_cust_id;
    lsp_cust_group_id;
    lsp_scope_name;
    lsp_scope_code;
    lsp_is_exclude;
    lsp_match_priority;
    lsp_notes;
    lsp_is_active;
    lsp_is_deleted;
    lsp_sync_date;
    lsp_created_on;
    lsp_created_by;
    lsp_modified_on;
    lsp_modified_by;
}
exports.LoyaltySchemePartyPayloadDto = LoyaltySchemePartyPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CUSTOMER_GROUP' }),
    __metadata("design:type", String)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_cust_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_cust_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'Wholesale',
        description: 'Display only. cus_name or cgr_name, whichever lsp_kind names.',
    }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_scope_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Display only. cus_code or cgr_short.',
    }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_scope_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemePartyPayloadDto.prototype, "lsp_modified_by", void 0);
class LoyaltySchemeItemPayloadDto {
    lsi_id;
    lsi_lsc_id;
    lsi_slno;
    lsi_kind;
    lsi_scope_id;
    lsi_item_id;
    lsi_group_id;
    lsi_category_id;
    lsi_brand_id;
    lsi_section_id;
    lsi_scope_name;
    lsi_is_exclude;
    lsi_factor;
    lsi_points;
    lsi_max_points;
    lsi_match_priority;
    lsi_notes;
    lsi_is_active;
    lsi_is_deleted;
    lsi_sync_date;
    lsi_created_on;
    lsi_created_by;
    lsi_modified_on;
    lsi_modified_by;
}
exports.LoyaltySchemeItemPayloadDto = LoyaltySchemeItemPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ITEM_BRAND' }),
    __metadata("design:type", String)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_category_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_brand_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_section_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'Masala Items',
        description: 'Display only. item_name_en / itg_name / category_name / brand_name / sec_name, ' +
            'whichever lsi_kind names.',
    }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_scope_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_max_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeItemPayloadDto.prototype, "lsi_modified_by", void 0);
class LoyaltySchemeSlabPayloadDto {
    lss_id;
    lss_lsc_id;
    lss_slno;
    lss_item_id;
    lss_unit_id;
    lss_item_name;
    lss_unit_name;
    lss_exceeds;
    lss_upto;
    lss_each;
    lss_points;
    lss_factor;
    lss_max_points;
    lss_notes;
    lss_is_active;
    lss_is_deleted;
    lss_sync_date;
    lss_created_on;
    lss_created_by;
    lss_modified_on;
    lss_modified_by;
}
exports.LoyaltySchemeSlabPayloadDto = LoyaltySchemeSlabPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'NULL = the band applies to the whole bill',
    }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Display only.' }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_item_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Display only.' }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1000 }),
    __metadata("design:type", Number)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 4999 }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_upto", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_each", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_max_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSlabPayloadDto.prototype, "lss_modified_by", void 0);
class LoyaltySchemeGiftPayloadDto {
    lsg_id;
    lsg_lsc_id;
    lsg_slno;
    lsg_item_id;
    lsg_unit_id;
    lsg_item_name;
    lsg_unit_name;
    lsg_item_qty;
    lsg_redeem_points;
    lsg_repeat;
    lsg_max_qty_per_bill;
    lsg_stock_check;
    lsg_valid_from;
    lsg_valid_upto;
    lsg_notes;
    lsg_is_active;
    lsg_is_deleted;
    lsg_sync_date;
    lsg_created_on;
    lsg_created_by;
    lsg_modified_on;
    lsg_modified_by;
}
exports.LoyaltySchemeGiftPayloadDto = LoyaltySchemeGiftPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'item_unit_conversion.iuc_id, as on a bill line' }),
    __metadata("design:type", String)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Display only.' }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_item_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Display only.' }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_item_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 500 }),
    __metadata("design:type", Number)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_repeat", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_max_qty_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_stock_check", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2025-10-01' }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_valid_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2025-10-31' }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_valid_upto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeGiftPayloadDto.prototype, "lsg_modified_by", void 0);
class LoyaltySchemeSummaryPayloadDto {
    lsc_id;
    lsc_comp_id;
    lsc_branch_id;
    lsc_comp_name;
    lsc_branch_name;
    lsc_tenant_id;
    lsc_code;
    lsc_name;
    lsc_type;
    lsc_status;
    lsc_priority;
    lsc_auto_apply;
    lsc_apply_on;
    lsc_calc_on_amount_type;
    lsc_include_tax;
    lsc_bill_type;
    lsc_min_bill_amount;
    lsc_max_earn_points;
    lsc_earn_on_discounted;
    lsc_earn_on_charges;
    lsc_earn_with_redeem;
    lsc_rounding_method;
    lsc_points_decimals;
    lsc_branch_scope;
    lsc_cust_scope;
    lsc_item_scope;
    lsc_price_level_id;
    lsc_pool_mode;
    lsc_allow_cross_branch_redeem;
    lsc_allow_point_redeem;
    lsc_allow_gift_redeem;
    lsc_redeem_tender_id;
    lsc_redeem_value_per_point;
    lsc_min_redeem_points;
    lsc_max_redeem_points;
    lsc_max_redeem_perc;
    lsc_redeem_min_bill_amount;
    lsc_redeem_multiple;
    lsc_expiry_basis;
    lsc_points_valid_days;
    lsc_activation_days;
    lsc_return_mode;
    lsc_start_date;
    lsc_end_date;
    lsc_valid_from_time;
    lsc_valid_to_time;
    lsc_valid_weekdays;
    lsc_remarks;
    lsc_is_active;
    lsc_is_deleted;
    lsc_sync_date;
    lsc_created_on;
    lsc_created_by;
    lsc_modified_on;
    lsc_modified_by;
    lsc_approved_on;
    lsc_approved_by;
}
exports.LoyaltySchemeSummaryPayloadDto = LoyaltySchemeSummaryPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'company.comp_name' }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_comp_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'branch_master.br_name — null when the scheme is company-wide',
    }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DIWALI25' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Diwali 2025' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BOTH' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DRAFT' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BILL_AMOUNT' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NET_AMOUNT' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_include_tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_max_earn_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_earn_on_discounted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_earn_on_charges", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_earn_with_redeem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'FLOOR' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_rounding_method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_points_decimals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_branch_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_cust_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_item_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_price_level_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'COMPANY' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_pool_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_allow_cross_branch_redeem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_allow_point_redeem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_allow_gift_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_redeem_tender_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0.25 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_redeem_value_per_point", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_min_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_max_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_max_redeem_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_redeem_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_redeem_multiple", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'EARN_DATE' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_expiry_basis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 365 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_points_valid_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_activation_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'REVERSE' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_return_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-01' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-31' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '22:22:00' }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '04:44:00' }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: 'MON,TUE' }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "lsc_approved_by", void 0);
class LoyaltySchemePayloadDto extends LoyaltySchemeSummaryPayloadDto {
    branches;
    parties;
    items;
    slabs;
    gifts;
}
exports.LoyaltySchemePayloadDto = LoyaltySchemePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LoyaltySchemeBranchPayloadDto] }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "branches", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LoyaltySchemePartyPayloadDto] }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "parties", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LoyaltySchemeItemPayloadDto] }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LoyaltySchemeSlabPayloadDto] }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "slabs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LoyaltySchemeGiftPayloadDto] }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "gifts", void 0);
class LoyaltySchemeDeleteResultDto {
    deleted;
    lsc_id;
}
exports.LoyaltySchemeDeleteResultDto = LoyaltySchemeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeDeleteResultDto.prototype, "deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeDeleteResultDto.prototype, "lsc_id", void 0);
class LoyaltySchemeSuccessSingleDto {
    success;
    message;
    data;
}
exports.LoyaltySchemeSuccessSingleDto = LoyaltySchemeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty scheme fetched successfully' }),
    __metadata("design:type", String)
], LoyaltySchemeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltySchemePayloadDto }),
    __metadata("design:type", LoyaltySchemePayloadDto)
], LoyaltySchemeSuccessSingleDto.prototype, "data", void 0);
class LoyaltySchemeSuccessListDto {
    success;
    message;
    data;
}
exports.LoyaltySchemeSuccessListDto = LoyaltySchemeSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty schemes fetched successfully' }),
    __metadata("design:type", String)
], LoyaltySchemeSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LoyaltySchemePayloadDto] }),
    __metadata("design:type", Array)
], LoyaltySchemeSuccessListDto.prototype, "data", void 0);
class LoyaltySchemeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.LoyaltySchemeSuccessDeleteDto = LoyaltySchemeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty scheme deleted successfully' }),
    __metadata("design:type", String)
], LoyaltySchemeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltySchemeDeleteResultDto }),
    __metadata("design:type", LoyaltySchemeDeleteResultDto)
], LoyaltySchemeSuccessDeleteDto.prototype, "data", void 0);
class LoyaltySchemeEligibilityPayloadDto {
    lsc_id;
    cus_id;
    qualifies;
    decided_by;
    matched_by;
    matched_row_id;
    match_priority;
    is_exclude;
    reason;
}
exports.LoyaltySchemeEligibilityPayloadDto = LoyaltySchemeEligibilityPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeEligibilityPayloadDto.prototype, "lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoyaltySchemeEligibilityPayloadDto.prototype, "cus_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeEligibilityPayloadDto.prototype, "qualifies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['ALL', 'RULE', 'NO_RULE'],
        description: 'ALL — the scheme covers everyone, no party row was consulted. RULE — a party row decided ' +
            'it. NO_RULE — the scheme is scoped to a LIST and nothing on it touches this customer.',
    }),
    __metadata("design:type", String)
], LoyaltySchemeEligibilityPayloadDto.prototype, "decided_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'CUSTOMER_GROUP',
        description: 'lsp_kind of the row that decided it',
    }),
    __metadata("design:type", Object)
], LoyaltySchemeEligibilityPayloadDto.prototype, "matched_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeEligibilityPayloadDto.prototype, "matched_row_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeEligibilityPayloadDto.prototype, "match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeEligibilityPayloadDto.prototype, "is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NO — carved out by the CUSTOMER rule' }),
    __metadata("design:type", String)
], LoyaltySchemeEligibilityPayloadDto.prototype, "reason", void 0);
class LoyaltySchemeEligibilitySuccessDto {
    success;
    message;
    data;
}
exports.LoyaltySchemeEligibilitySuccessDto = LoyaltySchemeEligibilitySuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeEligibilitySuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty scheme eligibility evaluated successfully' }),
    __metadata("design:type", String)
], LoyaltySchemeEligibilitySuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltySchemeEligibilityPayloadDto }),
    __metadata("design:type", LoyaltySchemeEligibilityPayloadDto)
], LoyaltySchemeEligibilitySuccessDto.prototype, "data", void 0);
//# sourceMappingURL=promotion-loyalty-points-response.dto.js.map