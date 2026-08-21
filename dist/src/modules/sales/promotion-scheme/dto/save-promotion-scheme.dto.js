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
exports.SavePromotionSchemeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const promotion_scheme_dto_helpers_1 = require("./promotion-scheme-dto.helpers");
const promotion_scheme_utils_1 = require("../utils/promotion-scheme.utils");
class SavePromotionSchemeDto {
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
    prm_created_by;
    prm_modified_by;
    prm_approved_on;
    prm_approved_by;
}
exports.SavePromotionSchemeDto = SavePromotionSchemeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates the existing scheme instead of creating one',
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((o) => o.prm_id === undefined || o.prm_comp_id !== undefined),
    (0, promotion_scheme_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'NULL = the whole company' }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'DIWALI25', description: 'Letters, digits, _ and - only' }),
    (0, class_validator_1.ValidateIf)((o) => o.prm_id === undefined || o.prm_code !== undefined),
    (0, promotion_scheme_dto_helpers_1.TrimmedString)(30),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150, example: 'Diwali 2025 — 10% off own brand' }),
    (0, class_validator_1.ValidateIf)((o) => o.prm_id === undefined || o.prm_name !== undefined),
    (0, promotion_scheme_dto_helpers_1.TrimmedString)(150),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_STATUSES, default: 'DRAFT' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_APPLY_ON, default: 'ITEM_QTY' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_BENEFITS, default: 'DISC_PERC' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_benefit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 9, default: 1 }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(1, 9),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_STACK_MODES, default: 'EXCLUSIVE' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_stack_mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SavePromotionSchemeDto.prototype, "prm_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Does the scheme still fire on a line the operator already discounted by hand?',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SavePromotionSchemeDto.prototype, "prm_allow_with_manual_disc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_CALC_ON, default: 'NET_AMOUNT' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SavePromotionSchemeDto.prototype, "prm_include_tax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_BILL_TYPES, default: 'ALL' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_SCOPES, default: 'ALL' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_branch_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_SCOPES, default: 'ALL' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_cust_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: promotion_scheme_utils_1.PRM_SCOPES, default: 'ALL' }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_item_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'NULL = every price level' }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_price_level_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_max_benefit_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped' }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_max_uses_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped' }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_max_uses_per_cust", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePromotionSchemeDto.prototype, "prm_budget_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'sales.loyalty_coupon_batch(lcb_id). NULL = applies automatically, no code needed. ' +
            'Stored without a foreign key until that table exists.',
    }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_coupon_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-01' }),
    (0, class_validator_1.ValidateIf)((o) => o.prm_id === undefined || o.prm_start_date !== undefined),
    (0, promotion_scheme_dto_helpers_1.OptionalDateString)(),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-31' }),
    (0, class_validator_1.ValidateIf)((o) => o.prm_id === undefined || o.prm_end_date !== undefined),
    (0, promotion_scheme_dto_helpers_1.OptionalDateString)(),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '22:00',
        nullable: true,
        description: 'Both time bounds or neither. from > to legitimately means "spans midnight".',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalTimeString)(),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '04:00', nullable: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalTimeString)(),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'MON,TUE,WED',
        nullable: true,
        description: 'Three-letter day names, comma separated. NULL = every day.',
    }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(30),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SavePromotionSchemeDto.prototype, "prm_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SavePromotionSchemeDto.prototype, "prm_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2025-09-28T09:30:00.000Z' }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(40),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'public.user_master(usr_id). Required once prm_status is APPROVED.',
    }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePromotionSchemeDto.prototype, "prm_approved_by", void 0);
//# sourceMappingURL=save-promotion-scheme.dto.js.map