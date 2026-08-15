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
exports.LoyaltyGiftSuccessDeleteDto = exports.LoyaltyGiftSuccessSingleDto = exports.LoyaltyPointSuccessDeleteDto = exports.LoyaltyPointSuccessSingleDto = exports.LoyaltySchemeSuccessDeleteDto = exports.LoyaltySchemeSuccessSingleDto = exports.LoyaltyGiftDeleteResultDto = exports.LoyaltyPointDeleteResultDto = exports.LoyaltySchemeDeleteResultDto = exports.LoyaltySchemePayloadDto = exports.LoyaltySchemeSummaryPayloadDto = exports.LoyaltyPartyPayloadDto = exports.LoyaltyGiftPayloadDto = exports.LoyaltyPointPayloadDto = exports.PromotionLoyaltyPointsErrorResponseDto = exports.PromotionLoyaltyPointsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "PromotionLoyaltyPointsErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "PromotionLoyaltyPointsErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class LoyaltyPointPayloadDto {
    lspt_id;
    lspt_ls_id;
    lspt_slno;
    lspt_item_id;
    lspt_unit_id;
    lspt_exceeds;
    lspt_each;
    lspt_factor;
    lspt_points;
    lspt_notes;
    lspt_is_active;
    lspt_is_deleted;
    lspt_sync_date;
    lspt_created_on;
    lspt_created_by;
    lspt_updated_on;
    lspt_updated_by;
}
exports.LoyaltyPointPayloadDto = LoyaltyPointPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyPointPayloadDto.prototype, "lspt_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyPointPayloadDto.prototype, "lspt_ls_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltyPointPayloadDto.prototype, "lspt_slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], LoyaltyPointPayloadDto.prototype, "lspt_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltyPointPayloadDto.prototype, "lspt_each", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltyPointPayloadDto.prototype, "lspt_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    __metadata("design:type", Number)
], LoyaltyPointPayloadDto.prototype, "lspt_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Bill amount slab', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyPointPayloadDto.prototype, "lspt_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltyPointPayloadDto.prototype, "lspt_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-06T12:00:00.000Z' }),
    __metadata("design:type", String)
], LoyaltyPointPayloadDto.prototype, "lspt_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPointPayloadDto.prototype, "lspt_updated_by", void 0);
class LoyaltyGiftPayloadDto {
    lsg_id;
    lsg_ls_id;
    lsg_slno;
    lsg_item_id;
    lsg_unit_id;
    lsg_item_qty;
    lsg_redeem_points;
    lsg_repeat;
    lsg_notes;
    lsg_is_active;
    lsg_is_deleted;
    lsg_sync_date;
    lsg_created_on;
    lsg_created_by;
    lsg_updated_on;
    lsg_updated_by;
}
exports.LoyaltyGiftPayloadDto = LoyaltyGiftPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyGiftPayloadDto.prototype, "lsg_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyGiftPayloadDto.prototype, "lsg_ls_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltyGiftPayloadDto.prototype, "lsg_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyGiftPayloadDto.prototype, "lsg_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyGiftPayloadDto.prototype, "lsg_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltyGiftPayloadDto.prototype, "lsg_item_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], LoyaltyGiftPayloadDto.prototype, "lsg_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltyGiftPayloadDto.prototype, "lsg_repeat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Festival gift', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyGiftPayloadDto.prototype, "lsg_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyGiftPayloadDto.prototype, "lsg_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltyGiftPayloadDto.prototype, "lsg_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyGiftPayloadDto.prototype, "lsg_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-06T12:00:00.000Z' }),
    __metadata("design:type", String)
], LoyaltyGiftPayloadDto.prototype, "lsg_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyGiftPayloadDto.prototype, "lsg_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyGiftPayloadDto.prototype, "lsg_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyGiftPayloadDto.prototype, "lsg_updated_by", void 0);
class LoyaltyPartyPayloadDto {
    lps_id;
    lps_ls_id;
    lps_slno;
    lps_scope_type;
    lps_scope_id;
    lps_is_exclude;
    lps_notes;
    lps_is_active;
    lps_is_deleted;
    lps_sync_date;
    lps_created_on;
    lps_created_by;
    lps_updated_on;
    lps_updated_by;
}
exports.LoyaltyPartyPayloadDto = LoyaltyPartyPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyPartyPayloadDto.prototype, "lps_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyPartyPayloadDto.prototype, "lps_ls_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltyPartyPayloadDto.prototype, "lps_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CUSTOMER_GROUP' }),
    __metadata("design:type", String)
], LoyaltyPartyPayloadDto.prototype, "lps_scope_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyPartyPayloadDto.prototype, "lps_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltyPartyPayloadDto.prototype, "lps_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Premium customers only', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPartyPayloadDto.prototype, "lps_notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyPartyPayloadDto.prototype, "lps_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltyPartyPayloadDto.prototype, "lps_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPartyPayloadDto.prototype, "lps_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-06T12:00:00.000Z' }),
    __metadata("design:type", String)
], LoyaltyPartyPayloadDto.prototype, "lps_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPartyPayloadDto.prototype, "lps_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPartyPayloadDto.prototype, "lps_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPartyPayloadDto.prototype, "lps_updated_by", void 0);
class LoyaltySchemeSummaryPayloadDto {
    ls_id;
    ls_code;
    ls_name;
    ls_type;
    ls_status;
    ls_auto_apply;
    ls_apply_on;
    ls_calc_on_amount_type;
    ls_bill_type;
    ls_cust_type;
    ls_item_type;
    ls_start_date;
    ls_end_date;
    ls_valid_from_time;
    ls_valid_to_time;
    ls_valid_weekdays;
    ls_comp_id;
    ls_branch_id;
    ls_include_tax_for_points;
    ls_rounding_method;
    ls_recur_apl;
    ls_bal_apl;
    ls_allow_point_redeem;
    ls_allow_gift_redeem;
    ls_redeem_value_per_point;
    ls_min_redeem_points;
    ls_max_redeem_points_per_bill;
    ls_max_redeem_percent_per_bill;
    ls_redeem_min_bill_amount;
    ls_points_valid_days;
    ls_expiry_basis;
    ls_remarks;
    ls_is_active;
    ls_is_deleted;
    ls_sync_date;
    ls_created_on;
    ls_created_by;
    ls_updated_on;
    ls_updated_by;
    ls_approved_on;
    ls_approved_by;
}
exports.LoyaltySchemeSummaryPayloadDto = LoyaltySchemeSummaryPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'LS001', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Summer Rewards' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'REDEEM' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ACTIVE' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BILL_AMOUNT' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NET_AMOUNT' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_cust_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALL' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_item_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-30' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '09:00:00', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '18:00:00', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1,2,3,4,5', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_include_tax_for_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'FLOOR' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_rounding_method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_recur_apl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_bal_apl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_allow_point_redeem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_allow_gift_redeem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_redeem_value_per_point", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_min_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 500 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_max_redeem_points_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_max_redeem_percent_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2500 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_redeem_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 180 }),
    __metadata("design:type", Number)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_points_valid_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'EARN_DATE' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_expiry_basis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Approved for summer promotion', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-06T12:00:00.000Z' }),
    __metadata("design:type", String)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_updated_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-06T12:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true }),
    __metadata("design:type", Object)
], LoyaltySchemeSummaryPayloadDto.prototype, "ls_approved_by", void 0);
class LoyaltySchemePayloadDto extends LoyaltySchemeSummaryPayloadDto {
    parties;
    points;
    gifts;
}
exports.LoyaltySchemePayloadDto = LoyaltySchemePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyPartyPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "parties", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyPointPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyGiftPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], LoyaltySchemePayloadDto.prototype, "gifts", void 0);
class LoyaltySchemeDeleteResultDto {
    ls_id;
    deleted;
}
exports.LoyaltySchemeDeleteResultDto = LoyaltySchemeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltySchemeDeleteResultDto.prototype, "ls_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltySchemeDeleteResultDto.prototype, "deleted", void 0);
class LoyaltyPointDeleteResultDto {
    lspt_id;
    deleted;
}
exports.LoyaltyPointDeleteResultDto = LoyaltyPointDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyPointDeleteResultDto.prototype, "lspt_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyPointDeleteResultDto.prototype, "deleted", void 0);
class LoyaltyGiftDeleteResultDto {
    lsg_id;
    deleted;
}
exports.LoyaltyGiftDeleteResultDto = LoyaltyGiftDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    __metadata("design:type", String)
], LoyaltyGiftDeleteResultDto.prototype, "lsg_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyGiftDeleteResultDto.prototype, "deleted", void 0);
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
class LoyaltyPointSuccessSingleDto {
    success;
    message;
    data;
}
exports.LoyaltyPointSuccessSingleDto = LoyaltyPointSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyPointSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty point fetched successfully' }),
    __metadata("design:type", String)
], LoyaltyPointSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyPointPayloadDto }),
    __metadata("design:type", LoyaltyPointPayloadDto)
], LoyaltyPointSuccessSingleDto.prototype, "data", void 0);
class LoyaltyPointSuccessDeleteDto {
    success;
    message;
    data;
}
exports.LoyaltyPointSuccessDeleteDto = LoyaltyPointSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyPointSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty point deleted successfully' }),
    __metadata("design:type", String)
], LoyaltyPointSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyPointDeleteResultDto }),
    __metadata("design:type", LoyaltyPointDeleteResultDto)
], LoyaltyPointSuccessDeleteDto.prototype, "data", void 0);
class LoyaltyGiftSuccessSingleDto {
    success;
    message;
    data;
}
exports.LoyaltyGiftSuccessSingleDto = LoyaltyGiftSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyGiftSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty gift fetched successfully' }),
    __metadata("design:type", String)
], LoyaltyGiftSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyGiftPayloadDto }),
    __metadata("design:type", LoyaltyGiftPayloadDto)
], LoyaltyGiftSuccessSingleDto.prototype, "data", void 0);
class LoyaltyGiftSuccessDeleteDto {
    success;
    message;
    data;
}
exports.LoyaltyGiftSuccessDeleteDto = LoyaltyGiftSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LoyaltyGiftSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Loyalty gift deleted successfully' }),
    __metadata("design:type", String)
], LoyaltyGiftSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LoyaltyGiftDeleteResultDto }),
    __metadata("design:type", LoyaltyGiftDeleteResultDto)
], LoyaltyGiftSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=promotion-loyalty-points-response.dto.js.map