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
exports.PromotionSchemeEligibilitySuccessDto = exports.PromotionSchemeEligibilityPayloadDto = exports.PromotionSchemeSuccessDeleteDto = exports.PromotionSchemeSuccessListDto = exports.PromotionSchemeSuccessSingleDto = exports.PromotionSchemeDeleteResultDto = exports.PromotionSchemePayloadDto = exports.PromotionSchemeSummaryPayloadDto = exports.PromotionSchemeSlabPayloadDto = exports.PromotionSchemeItemPayloadDto = exports.PromotionSchemePartyPayloadDto = exports.PromotionSchemeBranchPayloadDto = exports.PromotionSchemeErrorResponseDto = exports.PromotionSchemeErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "PromotionSchemeErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "PromotionSchemeErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class PromotionSchemeBranchPayloadDto {
    prb_id;
    prb_prm_id;
    prb_slno;
    prb_branch_id;
    prb_branch_name;
    prb_branch_code;
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'branch_master.br_name' }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'br_code, else br_short' }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_branch_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchPayloadDto.prototype, "prb_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeBranchPayloadDto.prototype, "prb_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeBranchPayloadDto.prototype, "prb_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    prp_scope_name;
    prp_scope_code;
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_cust_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_cust_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_area_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_city_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'namakkal',
        description: 'Display only. The name behind prp_scope_id — cus_name / cgr_name / arm_name / ' +
            'ctm_name, whichever prp_kind names.',
    }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_scope_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'gn',
        description: 'Display only. cus_code / cgr_short / arm_short / ctm_short.',
    }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_scope_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemePartyPayloadDto.prototype, "prp_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemePartyPayloadDto.prototype, "prp_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemePartyPayloadDto.prototype, "prp_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemePartyPayloadDto.prototype, "prp_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    pri_scope_name;
    pri_unit_name;
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_category_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_brand_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Generated by the database' }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_section_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'Masala Items',
        description: 'Display only. item_name_en / itg_name / category_name / brand_name / sec_name, ' +
            'whichever pri_kind names.',
    }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_scope_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'Kilogram',
        description: 'Display only. item_unit_master.unit_name behind pri_unit_id.',
    }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_unit_name", void 0);
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeItemPayloadDto.prototype, "pri_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeItemPayloadDto.prototype, "pri_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    prs_free_item_name;
    prs_free_unit_name;
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
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, example: 4999 }),
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Display only.' }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_item_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'Display only.' }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_free_unit_name", void 0);
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
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_fixed_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSlabPayloadDto.prototype, "prs_max_benefit_amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
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
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSlabPayloadDto.prototype, "prs_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSlabPayloadDto.prototype, "prs_modified_by", void 0);
class PromotionSchemeSummaryPayloadDto {
    prm_id;
    prm_comp_id;
    prm_branch_id;
    prm_comp_name;
    prm_branch_name;
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
}
exports.PromotionSchemeSummaryPayloadDto = PromotionSchemeSummaryPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, description: 'company.comp_name' }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_comp_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'branch_master.br_name — null when the scheme is company-wide',
    }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DIWALI25' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Diwali 2025' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DRAFT' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ITEM_QTY' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DISC_PERC' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'EXCLUSIVE' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_stack_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_allow_with_manual_disc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NET_AMOUNT' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_include_tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_branch_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_cust_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_item_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_price_level_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_max_benefit_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_max_uses_total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_max_uses_per_cust", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_budget_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_coupon_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-01' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-31' }),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '22:00:00' }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '04:00:00' }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: 'MON,TUE' }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeSummaryPayloadDto.prototype, "prm_approved_by", void 0);
class PromotionSchemePayloadDto extends PromotionSchemeSummaryPayloadDto {
    branches;
    parties;
    items;
    slabs;
}
exports.PromotionSchemePayloadDto = PromotionSchemePayloadDto;
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
class PromotionSchemeSuccessListDto {
    success;
    message;
    data;
}
exports.PromotionSchemeSuccessListDto = PromotionSchemeSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion schemes fetched successfully' }),
    __metadata("design:type", String)
], PromotionSchemeSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemePayloadDto] }),
    __metadata("design:type", Array)
], PromotionSchemeSuccessListDto.prototype, "data", void 0);
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
class PromotionSchemeEligibilityPayloadDto {
    prm_id;
    cus_id;
    qualifies;
    decided_by;
    matched_by;
    matched_row_id;
    match_priority;
    is_exclude;
    reason;
}
exports.PromotionSchemeEligibilityPayloadDto = PromotionSchemeEligibilityPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeEligibilityPayloadDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PromotionSchemeEligibilityPayloadDto.prototype, "cus_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeEligibilityPayloadDto.prototype, "qualifies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['ALL', 'RULE', 'NO_RULE'],
        description: 'ALL — the scheme covers everyone, no party row was consulted. RULE — a party row decided ' +
            'it. NO_RULE — the scheme is scoped to a LIST and nothing on it touches this customer.',
    }),
    __metadata("design:type", String)
], PromotionSchemeEligibilityPayloadDto.prototype, "decided_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: 'AREA',
        description: 'prp_kind of the row that decided it',
    }),
    __metadata("design:type", Object)
], PromotionSchemeEligibilityPayloadDto.prototype, "matched_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeEligibilityPayloadDto.prototype, "matched_row_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeEligibilityPayloadDto.prototype, "match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, nullable: true }),
    __metadata("design:type", Object)
], PromotionSchemeEligibilityPayloadDto.prototype, "is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NO — carved out by the AREA rule' }),
    __metadata("design:type", String)
], PromotionSchemeEligibilityPayloadDto.prototype, "reason", void 0);
class PromotionSchemeEligibilitySuccessDto {
    success;
    message;
    data;
}
exports.PromotionSchemeEligibilitySuccessDto = PromotionSchemeEligibilitySuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PromotionSchemeEligibilitySuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Promotion scheme eligibility evaluated successfully' }),
    __metadata("design:type", String)
], PromotionSchemeEligibilitySuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PromotionSchemeEligibilityPayloadDto }),
    __metadata("design:type", PromotionSchemeEligibilityPayloadDto)
], PromotionSchemeEligibilitySuccessDto.prototype, "data", void 0);
//# sourceMappingURL=promotion-scheme-response.dto.js.map