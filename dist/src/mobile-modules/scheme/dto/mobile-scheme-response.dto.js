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
exports.MobileSchemesSuccessDto = exports.MobileSchemesPayloadDto = exports.MobileSchemeDto = exports.MobileSchemeSlabDto = exports.MobileSchemeItemDto = exports.MobileSchemePartyDto = exports.MobileSchemeBranchDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const num = (scale, example, nullable = false) => ({
    type: String,
    nullable,
    example,
    description: `numeric(18,${scale}) as exact text${nullable ? '; null when NULL' : ''}`,
});
const NULLABLE_UUID = { type: String, format: 'uuid', nullable: true };
const NULLABLE_TEXT = { type: String, nullable: true };
class MobileSchemeBranchDto {
    prb_id;
    prb_branch_id;
    prb_branch_name;
    prb_is_exclude;
}
exports.MobileSchemeBranchDto = MobileSchemeBranchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeBranchDto.prototype, "prb_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeBranchDto.prototype, "prb_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, description: 'br_name (display only)' }),
    __metadata("design:type", Object)
], MobileSchemeBranchDto.prototype, "prb_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemeBranchDto.prototype, "prb_is_exclude", void 0);
class MobileSchemePartyDto {
    prp_id;
    prp_kind;
    prp_scope_id;
    prp_scope_name;
    prp_is_exclude;
    prp_match_priority;
}
exports.MobileSchemePartyDto = MobileSchemePartyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemePartyDto.prototype, "prp_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['CUSTOMER', 'CUSTOMER_GROUP', 'AREA', 'CITY'] }),
    __metadata("design:type", String)
], MobileSchemePartyDto.prototype, "prp_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemePartyDto.prototype, "prp_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        ...NULLABLE_TEXT,
        example: 'Retail',
        description: 'cus_name / cgr_name / arm_name / ctm_name by kind (display only)',
    }),
    __metadata("design:type", Object)
], MobileSchemePartyDto.prototype, "prp_scope_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemePartyDto.prototype, "prp_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'CUSTOMER 4, AREA 3, CITY 2, CUSTOMER_GROUP 1 (seeded)' }),
    __metadata("design:type", Number)
], MobileSchemePartyDto.prototype, "prp_match_priority", void 0);
class MobileSchemeItemDto {
    pri_id;
    pri_kind;
    pri_scope_id;
    pri_scope_name;
    pri_unit_id;
    pri_unit_name;
    pri_is_exclude;
    pri_disc_perc;
    pri_disc_qty;
    pri_disc_amt;
    pri_min_qty;
    pri_factor;
    pri_max_benefit;
    pri_match_priority;
}
exports.MobileSchemeItemDto = MobileSchemeItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ITEM', 'ITEM_GROUP', 'ITEM_CATEGORY', 'ITEM_BRAND', 'ITEM_SECTION'] }),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        ...NULLABLE_TEXT,
        description: 'item_name_en / itg_name / category_name / brand_name / sec_name (display only)',
    }),
    __metadata("design:type", Object)
], MobileSchemeItemDto.prototype, "pri_scope_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        ...NULLABLE_UUID,
        description: 'item_unit_conversion.iuc_id (soiItemUnitId); ITEM rows only',
    }),
    __metadata("design:type", Object)
], MobileSchemeItemDto.prototype, "pri_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, example: 'PCS', description: 'unit_name (display only)' }),
    __metadata("design:type", Object)
], MobileSchemeItemDto.prototype, "pri_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemeItemDto.prototype, "pri_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(4, '0.0000')),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(4, '0.0000')),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(2, '0.00')),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_disc_amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(3, '0.000')),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(4, '1.0000')),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(2, '0.00')),
    __metadata("design:type", String)
], MobileSchemeItemDto.prototype, "pri_max_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4 }),
    __metadata("design:type", Number)
], MobileSchemeItemDto.prototype, "pri_match_priority", void 0);
class MobileSchemeSlabDto {
    prs_id;
    prs_slno;
    prs_benefit;
    prs_exceeds;
    prs_upto;
    prs_each;
    prs_is_repeat;
    prs_max_repeats;
    prs_free_item_id;
    prs_free_item_name;
    prs_free_unit_id;
    prs_free_unit_name;
    prs_free_unit_factor;
    prs_free_qty;
    prs_free_stock_check;
    prs_disc_perc;
    prs_disc_qty;
    prs_disc_amt;
    prs_fixed_price;
    prs_max_benefit_amt;
}
exports.MobileSchemeSlabDto = MobileSchemeSlabDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], MobileSchemeSlabDto.prototype, "prs_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'FREE_ITEM' }),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(3, '5.000')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(3, '10.000', true)),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_upto", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(3, '1.000')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_each", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemeSlabDto.prototype, "prs_is_repeat", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: '0 = no limit' }),
    __metadata("design:type", Number)
], MobileSchemeSlabDto.prototype, "prs_max_repeats", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(NULLABLE_UUID),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_free_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, description: 'item_name_en (display only)' }),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_free_item_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_UUID, description: 'item_unit_conversion.iuc_id of the free unit' }),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_free_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, description: 'unit_name (display only)' }),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_free_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        nullable: true,
        example: '1.000000',
        description: 'iuc_to_base_factor of the free unit, numeric(18,6) as text; null when no free unit',
    }),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_free_unit_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(3, '1.000')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemeSlabDto.prototype, "prs_free_stock_check", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(4, '0.0000')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(4, '0.0000')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(2, '0.00')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_disc_amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(4, '95.0000', true)),
    __metadata("design:type", Object)
], MobileSchemeSlabDto.prototype, "prs_fixed_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(2, '0.00')),
    __metadata("design:type", String)
], MobileSchemeSlabDto.prototype, "prs_max_benefit_amt", void 0);
class MobileSchemeDto {
    prm_id;
    prm_comp_id;
    prm_branch_id;
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
    prm_coupon_batch_id;
    prm_start_date;
    prm_end_date;
    prm_valid_from_time;
    prm_valid_to_time;
    prm_valid_weekdays;
    prm_remarks;
    prm_modified_on;
    branches;
    parties;
    items;
    slabs;
}
exports.MobileSchemeDto = MobileSchemeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_UUID, description: 'null = every branch of the company' }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'FRRE' }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'APPROVED' }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['BILL_AMOUNT', 'BILL_QTY', 'ITEM_AMOUNT', 'ITEM_QTY'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['FREE_ITEM', 'DISC_PERC', 'DISC_AMT', 'FIXED_PRICE', 'DISC_PER_ITEM'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_benefit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: '1 is applied first' }),
    __metadata("design:type", Number)
], MobileSchemeDto.prototype, "prm_priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['EXCLUSIVE', 'STACKABLE'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_stack_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileSchemeDto.prototype, "prm_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemeDto.prototype, "prm_allow_with_manual_disc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['GROSS_AMOUNT', 'NET_AMOUNT', 'TAXABLE_AMOUNT'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileSchemeDto.prototype, "prm_include_tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ALL', 'CASH', 'CREDIT'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(2, '0.00')),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(3, '0.000')),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ALL', 'LIST'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_branch_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ALL', 'LIST'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_cust_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ALL', 'LIST'] }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_item_scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: Number, nullable: true }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_price_level_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(num(2, '0.00')),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_max_benefit_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_UUID, description: 'Always null: coupon schemes are not sent' }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_coupon_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '2026-08-24' }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', example: '2027-08-24' }),
    __metadata("design:type", String)
], MobileSchemeDto.prototype, "prm_end_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, example: '09:00:00' }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, example: '18:00:00' }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, example: 'MON,TUE,WED' }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(NULLABLE_TEXT),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ ...NULLABLE_TEXT, example: '2026-08-24T15:20:31.123+05:30' }),
    __metadata("design:type", Object)
], MobileSchemeDto.prototype, "prm_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSchemeBranchDto] }),
    __metadata("design:type", Array)
], MobileSchemeDto.prototype, "branches", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSchemePartyDto] }),
    __metadata("design:type", Array)
], MobileSchemeDto.prototype, "parties", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSchemeItemDto] }),
    __metadata("design:type", Array)
], MobileSchemeDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSchemeSlabDto] }),
    __metadata("design:type", Array)
], MobileSchemeDto.prototype, "slabs", void 0);
class MobileSchemesPayloadDto {
    companyId;
    asOf;
    schemes;
}
exports.MobileSchemesPayloadDto = MobileSchemesPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileSchemesPayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'date',
        example: '2026-11-19',
        description: "The database's today (IST) that the end-date filter used",
    }),
    __metadata("design:type", String)
], MobileSchemesPayloadDto.prototype, "asOf", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileSchemeDto] }),
    __metadata("design:type", Array)
], MobileSchemesPayloadDto.prototype, "schemes", void 0);
class MobileSchemesSuccessDto {
    success;
    message;
    data;
}
exports.MobileSchemesSuccessDto = MobileSchemesSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileSchemesSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Active schemes fetched' }),
    __metadata("design:type", String)
], MobileSchemesSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileSchemesPayloadDto }),
    __metadata("design:type", MobileSchemesPayloadDto)
], MobileSchemesSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-scheme-response.dto.js.map