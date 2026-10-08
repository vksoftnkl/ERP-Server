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
exports.SaveLoyaltySchemeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const save_loyalty_scheme_branch_dto_1 = require("./save-loyalty-scheme-branch.dto");
const save_loyalty_scheme_gift_dto_1 = require("./save-loyalty-scheme-gift.dto");
const save_loyalty_scheme_item_dto_1 = require("./save-loyalty-scheme-item.dto");
const save_loyalty_scheme_party_dto_1 = require("./save-loyalty-scheme-party.dto");
const save_loyalty_scheme_slab_dto_1 = require("./save-loyalty-scheme-slab.dto");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
const loyalty_utils_1 = require("../utils/loyalty.utils");
class SaveLoyaltySchemeDto {
    lsc_id;
    lsc_comp_id;
    lsc_branch_id;
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
    lsc_created_by;
    lsc_modified_by;
    lsc_approved_on;
    lsc_approved_by;
    branches;
    parties;
    items;
    slabs;
    gifts;
}
exports.SaveLoyaltySchemeDto = SaveLoyaltySchemeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates the existing scheme instead of creating one',
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsc_id === undefined || o.lsc_comp_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Single-shop shorthand. NULL = the whole company.',
    }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'DIWALI25', description: 'Letters, digits, _ and - only' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsc_id === undefined || o.lsc_code !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(30),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150, example: 'Diwali 2025 — 2x points on own brand' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsc_id === undefined || o.lsc_name !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(150),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_TYPES, default: 'BOTH' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_STATUSES, default: 'DRAFT' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 9,
        default: 1,
        description: 'Which scheme wins when several match one bill. 1 = primary, and only one APPROVED, ' +
            'active primary may exist per company/branch/type.',
    }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1, 9),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_APPLY_ON, default: 'BILL_AMOUNT' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_CALC_ON, default: 'NET_AMOUNT' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_include_tax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_BILL_TYPES, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'The earn floor' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Per bill. 0 = uncapped.' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_max_earn_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_earn_on_discounted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_earn_on_charges", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Does a bill that spent points still earn on what was left to pay?',
    }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_earn_with_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_ROUNDING, default: 'FLOOR' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_rounding_method", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 4, default: 2 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(0, 4),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_points_decimals", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_SCOPES, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_branch_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_SCOPES, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_cust_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_SCOPES, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_item_scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        description: 'inventory.item_price_levels(ipl_id). NULL = every price level.',
    }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_price_level_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: loyalty_utils_1.LSC_POOL_MODES,
        default: 'COMPANY',
        description: 'COMPANY = one wallet, earned anywhere and spent anywhere. BRANCH = a franchisee honours ' +
            'only the points it issued.',
    }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_pool_mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_allow_cross_branch_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_allow_point_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_allow_gift_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'accounts.acc_tender_master(tnd_id) — the LOYALTY tender (type 10)',
    }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_redeem_tender_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Rupees per point. WINS over acc_tender_master.tnd_conversion_rate whenever this scheme ' +
            'matches. Required (> 0) once lsc_allow_point_redeem is true.',
    }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_redeem_value_per_point", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_min_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Per bill. 0 = uncapped.' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_max_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 100,
        default: 100,
        description: 'Per bill: the percentage of it points may settle',
    }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_max_redeem_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_redeem_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = any quantity' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_redeem_multiple", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: loyalty_utils_1.LSC_EXPIRY_BASES,
        default: 'EARN_DATE',
        description: 'NONE = never lapses. SCHEME_END_DATE takes the date from lsc_end_date. The rest are ' +
            'computed from the earn date.',
    }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_expiry_basis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Must be greater than 0 when lsc_expiry_basis is EARN_DATE',
    }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_points_valid_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 365,
        default: 0,
        description: 'THE CLAW-BACK DEFENCE. Days a lot must age before it may be REDEEMED — long enough for ' +
            'the return window to close. Points still earn on bill save. 0 = redeemable immediately.',
    }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(0, 365),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "lsc_activation_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: loyalty_utils_1.LSC_RETURN_MODES, default: 'REVERSE' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_return_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-01' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsc_id === undefined || o.lsc_start_date !== undefined),
    (0, loyalty_dto_helpers_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-10-31' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsc_id === undefined || o.lsc_end_date !== undefined),
    (0, loyalty_dto_helpers_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '22:22',
        type: String,
        nullable: true,
        description: 'Both time bounds or neither. from > to legitimately means "spans midnight".',
    }),
    (0, loyalty_dto_helpers_1.OptionalTimeString)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '04:44', type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.OptionalTimeString)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'MON,TUE,WED',
        type: String,
        nullable: true,
        description: 'Three-letter day names, comma separated. NULL = every day.',
    }),
    (0, loyalty_dto_helpers_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "lsc_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "lsc_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2025-09-28T09:30:00.000Z' }),
    (0, loyalty_dto_helpers_1.NullableString)(40),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'public.user_master(usr_id). Required once lsc_status is APPROVED.',
    }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "lsc_approved_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_loyalty_scheme_branch_dto_1.LoyaltySchemeBranchRowDto,
        isArray: true,
        description: 'Branch scope grid. Read only when lsc_branch_scope is LIST.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_loyalty_scheme_branch_dto_1.LoyaltySchemeBranchRowDto),
    __metadata("design:type", Array)
], SaveLoyaltySchemeDto.prototype, "branches", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_loyalty_scheme_party_dto_1.LoyaltySchemePartyRowDto,
        isArray: true,
        description: 'Customer / customer-group scope grid. Read only when lsc_cust_scope is LIST.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_loyalty_scheme_party_dto_1.LoyaltySchemePartyRowDto),
    __metadata("design:type", Array)
], SaveLoyaltySchemeDto.prototype, "parties", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_loyalty_scheme_item_dto_1.LoyaltySchemeItemRowDto,
        isArray: true,
        description: 'Item scope grid. Read only when lsc_item_scope is LIST.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_loyalty_scheme_item_dto_1.LoyaltySchemeItemRowDto),
    __metadata("design:type", Array)
], SaveLoyaltySchemeDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_loyalty_scheme_slab_dto_1.LoyaltySchemeSlabRowDto,
        isArray: true,
        description: 'Earn rate bands. One row = one band; bands are rows, not columns.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_loyalty_scheme_slab_dto_1.LoyaltySchemeSlabRowDto),
    __metadata("design:type", Array)
], SaveLoyaltySchemeDto.prototype, "slabs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_loyalty_scheme_gift_dto_1.LoyaltySchemeGiftRowDto,
        isArray: true,
        description: 'The catalogue of what points may be exchanged for.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_loyalty_scheme_gift_dto_1.LoyaltySchemeGiftRowDto),
    __metadata("design:type", Array)
], SaveLoyaltySchemeDto.prototype, "gifts", void 0);
//# sourceMappingURL=save-loyalty-scheme.dto.js.map