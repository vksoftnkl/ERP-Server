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
exports.PromotionSchemeSlabSuccessListDto = exports.PromotionSchemeItemSuccessListDto = exports.PromotionSchemePartySuccessListDto = exports.PromotionSchemeBranchSuccessListDto = exports.PromotionSchemeChildSuccessDeleteDto = exports.PromotionSchemeSuccessDeleteDto = exports.PromotionSchemeSuccessSingleDto = exports.PromotionSchemeChildDeleteResultDto = exports.PromotionSchemeDeleteResultDto = exports.PromotionSchemePayloadDto = exports.PromotionSchemeSlabPayloadDto = exports.PromotionSchemeItemPayloadDto = exports.PromotionSchemePartyPayloadDto = exports.PromotionSchemeBranchPayloadDto = exports.PromotionSchemeErrorResponseDto = exports.PromotionSchemeErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "PromotionSchemeErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "PromotionSchemeErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class PromotionSchemeBranchPayloadDto {
    prb_id;
    prb_prm_id;
    prb_slno;
    prb_branch_id;
    prb_is_exclude;
    prb_notes;
    prb_is_active;
    prb_is_deleted;
    prb_sync_date;
    prb_created_on;
    prb_created_by;
    prb_modified_on;
    prb_modified_by;
}
exports.PromotionSchemeBranchPayloadDto = PromotionSchemeBranchPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeBranchPayloadDto.prototype, "prb_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeBranchPayloadDto.prototype, "prb_prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemeBranchPayloadDto.prototype, "prb_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeBranchPayloadDto.prototype, "prb_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchPayloadDto.prototype, "prb_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchPayloadDto.prototype, "prb_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchPayloadDto.prototype, "prb_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeBranchPayloadDto.prototype, "prb_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_modified_by", void 0);
class PromotionSchemePartyPayloadDto {
    prp_id;
    prp_prm_id;
    prp_slno;
    prp_kind;
    prp_scope_id;
    prp_cust_id;
    prp_cust_group_id;
    prp_area_id;
    prp_city_id;
    prp_is_exclude;
    prp_match_priority;
    prp_notes;
    prp_is_active;
    prp_is_deleted;
    prp_sync_date;
    prp_created_on;
    prp_created_by;
    prp_modified_on;
    prp_modified_by;
}
exports.PromotionSchemePartyPayloadDto = PromotionSchemePartyPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePartyPayloadDto.prototype, "prp_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePartyPayloadDto.prototype, "prp_prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemePartyPayloadDto.prototype, "prp_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CUSTOMER_GROUP' }),
    __metadata("design:type", String)
], PromotionSchemePartyPayloadDto.prototype, "prp_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePartyPayloadDto.prototype, "prp_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_cust_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_cust_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_area_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_city_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemePartyPayloadDto.prototype, "prp_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemePartyPayloadDto.prototype, "prp_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemePartyPayloadDto.prototype, "prp_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemePartyPayloadDto.prototype, "prp_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePartyPayloadDto.prototype, "prp_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_modified_by", void 0);
class PromotionSchemeItemPayloadDto {
    pri_id;
    pri_prm_id;
    pri_slno;
    pri_kind;
    pri_scope_id;
    pri_item_id;
    pri_group_id;
    pri_category_id;
    pri_brand_id;
    pri_section_id;
    pri_unit_id;
    pri_is_exclude;
    pri_disc_perc;
    pri_disc_qty;
    pri_disc_amt;
    pri_min_qty;
    pri_factor;
    pri_max_benefit;
    pri_match_priority;
    pri_notes;
    pri_is_active;
    pri_is_deleted;
    pri_sync_date;
    pri_created_on;
    pri_created_by;
    pri_modified_on;
    pri_modified_by;
}
exports.PromotionSchemeItemPayloadDto = PromotionSchemeItemPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeItemPayloadDto.prototype, "pri_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeItemPayloadDto.prototype, "pri_prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ITEM_BRAND' }),
    __metadata("design:type", String)
], PromotionSchemeItemPayloadDto.prototype, "pri_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeItemPayloadDto.prototype, "pri_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_category_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_brand_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_section_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeItemPayloadDto.prototype, "pri_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_disc_amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_max_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PromotionSchemeItemPayloadDto.prototype, "pri_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeItemPayloadDto.prototype, "pri_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeItemPayloadDto.prototype, "pri_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeItemPayloadDto.prototype, "pri_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_modified_by", void 0);
class PromotionSchemeSlabPayloadDto {
    prs_id;
    prs_prm_id;
    prs_slno;
    prs_benefit;
    prs_exceeds;
    prs_upto;
    prs_each;
    prs_is_repeat;
    prs_max_repeats;
    prs_free_item_id;
    prs_free_unit_id;
    prs_free_qty;
    prs_free_stock_check;
    prs_disc_perc;
    prs_disc_qty;
    prs_disc_amt;
    prs_fixed_price;
    prs_max_benefit_amt;
    prs_notes;
    prs_is_active;
    prs_is_deleted;
    prs_sync_date;
    prs_created_on;
    prs_created_by;
    prs_modified_on;
    prs_modified_by;
}
exports.PromotionSchemeSlabPayloadDto = PromotionSchemeSlabPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSlabPayloadDto.prototype, "prs_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSlabPayloadDto.prototype, "prs_prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DISC_PERC' }),
    __metadata("design:type", String)
], PromotionSchemeSlabPayloadDto.prototype, "prs_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1000 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 4999 }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_upto", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_each", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabPayloadDto.prototype, "prs_is_repeat", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_max_repeats", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_stock_check", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_disc_amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_fixed_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_max_benefit_amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabPayloadDto.prototype, "prs_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabPayloadDto.prototype, "prs_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSlabPayloadDto.prototype, "prs_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_modified_by", void 0);
class PromotionSchemePayloadDto {
    prm_id;
    prm_comp_id;
    prm_branch_id;
    prm_tenant_id;
    prm_code;
    prm_name;
    prm_status;
    prm_apply_on;
    prm_benefit;
    prm_priority;
    prm_stack_mode;
    prm_auto_apply;
    prm_allow_with_manual_disc;
    prm_calc_on_amount_type;
    prm_include_tax;
    prm_bill_type;
    prm_min_bill_amount;
    prm_min_qty;
    prm_branch_scope;
    prm_cust_scope;
    prm_item_scope;
    prm_price_level_id;
    prm_max_benefit_per_bill;
    prm_max_uses_total;
    prm_max_uses_per_cust;
    prm_budget_amount;
    prm_coupon_batch_id;
    prm_start_date;
    prm_end_date;
    prm_valid_from_time;
    prm_valid_to_time;
    prm_valid_weekdays;
    prm_remarks;
    prm_is_active;
    prm_is_deleted;
    prm_sync_date;
    prm_created_on;
    prm_created_by;
    prm_modified_on;
    prm_modified_by;
    prm_approved_on;
    prm_approved_by;
    branches;
    parties;
    items;
    slabs;
}
exports.PromotionSchemePayloadDto = PromotionSchemePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DIWALI25' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Diwali 2025' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DRAFT' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ITEM_QTY' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DISC_PERC' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'EXCLUSIVE' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_stack_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemePayloadDto.prototype, "prm_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemePayloadDto.prototype, "prm_allow_with_manual_disc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NET_AMOUNT' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemePayloadDto.prototype, "prm_include_tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_branch_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_cust_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_item_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_price_level_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_max_benefit_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_max_uses_total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_max_uses_per_cust", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemePayloadDto.prototype, "prm_budget_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_coupon_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-01' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-31' }),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '22:00:00' }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '04:00:00' }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'MON,TUE' }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemePayloadDto.prototype, "prm_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemePayloadDto.prototype, "prm_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePayloadDto.prototype, "prm_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePayloadDto.prototype, "prm_approved_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeBranchPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemePayloadDto.prototype, "branches", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemePartyPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemePayloadDto.prototype, "parties", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeItemPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemePayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeSlabPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemePayloadDto.prototype, "slabs", void 0);
class PromotionSchemeDeleteResultDto {
    deleted;
    prm_id;
}
exports.PromotionSchemeDeleteResultDto = PromotionSchemeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeDeleteResultDto.prototype, "deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeDeleteResultDto.prototype, "prm_id", void 0);
class PromotionSchemeChildDeleteResultDto extends PromotionSchemeDeleteResultDto {
    row_id;
}
exports.PromotionSchemeChildDeleteResultDto = PromotionSchemeChildDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The prb_id / prp_id / pri_id / prs_id that was soft deleted' }),
    __metadata("design:type", String)
], PromotionSchemeChildDeleteResultDto.prototype, "row_id", void 0);
class PromotionSchemeSuccessSingleDto {
    success;
    message;
    data;
}
exports.PromotionSchemeSuccessSingleDto = PromotionSchemeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme fetched successfully' }),
    __metadata("design:type", String)
], PromotionSchemeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PromotionSchemePayloadDto }),
    __metadata("design:type", PromotionSchemePayloadDto)
], PromotionSchemeSuccessSingleDto.prototype, "data", void 0);
class PromotionSchemeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.PromotionSchemeSuccessDeleteDto = PromotionSchemeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme deleted successfully' }),
    __metadata("design:type", String)
], PromotionSchemeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PromotionSchemeDeleteResultDto }),
    __metadata("design:type", PromotionSchemeDeleteResultDto)
], PromotionSchemeSuccessDeleteDto.prototype, "data", void 0);
class PromotionSchemeChildSuccessDeleteDto {
    success;
    message;
    data;
}
exports.PromotionSchemeChildSuccessDeleteDto = PromotionSchemeChildSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeChildSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Row deleted successfully' }),
    __metadata("design:type", String)
], PromotionSchemeChildSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PromotionSchemeChildDeleteResultDto }),
    __metadata("design:type", PromotionSchemeChildDeleteResultDto)
], PromotionSchemeChildSuccessDeleteDto.prototype, "data", void 0);
class PromotionSchemeBranchSuccessListDto {
    success;
    message;
    data;
}
exports.PromotionSchemeBranchSuccessListDto = PromotionSchemeBranchSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme branches saved successfully' }),
    __metadata("design:type", String)
], PromotionSchemeBranchSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeBranchPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemeBranchSuccessListDto.prototype, "data", void 0);
class PromotionSchemePartySuccessListDto {
    success;
    message;
    data;
}
exports.PromotionSchemePartySuccessListDto = PromotionSchemePartySuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemePartySuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme parties saved successfully' }),
    __metadata("design:type", String)
], PromotionSchemePartySuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemePartyPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemePartySuccessListDto.prototype, "data", void 0);
class PromotionSchemeItemSuccessListDto {
    success;
    message;
    data;
}
exports.PromotionSchemeItemSuccessListDto = PromotionSchemeItemSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeItemSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme items saved successfully' }),
    __metadata("design:type", String)
], PromotionSchemeItemSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeItemPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemeItemSuccessListDto.prototype, "data", void 0);
class PromotionSchemeSlabSuccessListDto {
    success;
    message;
    data;
}
exports.PromotionSchemeSlabSuccessListDto = PromotionSchemeSlabSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme slabs saved successfully' }),
    __metadata("design:type", String)
], PromotionSchemeSlabSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeSlabPayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemeSlabSuccessListDto.prototype, "data", void 0);
//# sourceMappingURL=promotion-scheme-response.dto.js.map