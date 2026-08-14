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
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
const save_loyalty_party_dto_1 = require("./save-loyalty-party.dto");
const LOYALTY_SCHEME_TYPES = ['REDEEM', 'BOTH', 'GIFT'];
const LOYALTY_SCHEME_STATUSES = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED'];
const LOYALTY_SCHEME_APPLY_ON = [
    'BILL_AMOUNT',
    'ITEM_AMOUNT',
    'BILL_QTY',
    'ITEM_QTY',
    'MASTER_PV',
];
const LOYALTY_SCHEME_CALC_AMOUNT_TYPES = ['NET_AMOUNT', 'GROSS_AMOUNT', 'TAXABLE_AMOUNT'];
const LOYALTY_SCHEME_BILL_TYPES = ['ALL', 'CASH', 'CREDIT'];
const LOYALTY_SCHEME_CUSTOMER_TYPES = ['ALL', 'CUSTOMER_GROUP', 'CUSTOMER'];
const LOYALTY_SCHEME_ITEM_TYPES = [
    'ALL',
    'ITEM_GROUP',
    'ITEM_BRAND',
    'ITEM_CATEGORY',
    'ITEM_SECTION',
    'ITEM',
];
const LOYALTY_SCHEME_ROUNDING_METHODS = ['FLOOR', 'ROUND', 'CEIL'];
const LOYALTY_SCHEME_EXPIRY_BASIS = [
    'EARN_DATE',
    'SCHEME_END_DATE',
    'MONTH_END',
    'YEAR_END',
    'NONE',
];
let LoyaltySchemeDateRangeConstraint = class LoyaltySchemeDateRangeConstraint {
    validate(value, args) {
        const dto = args.object;
        if (!dto.ls_start_date || typeof value !== 'string') {
            return true;
        }
        const start = new Date(dto.ls_start_date);
        const end = new Date(value);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return true;
        }
        return start.getTime() <= end.getTime();
    }
    defaultMessage() {
        return 'ls_end_date must be greater than or equal to ls_start_date';
    }
};
LoyaltySchemeDateRangeConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'LoyaltySchemeDateRange', async: false })
], LoyaltySchemeDateRangeConstraint);
class SaveLoyaltySchemeDto {
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
    ls_created_by;
    ls_updated_by;
    ls_approved_on;
    ls_approved_by;
    parties;
}
exports.SaveLoyaltySchemeDto = SaveLoyaltySchemeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates an existing loyalty scheme',
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, class_validator_1.ValidateIf)((object) => object.ls_id === undefined || object.ls_name !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(150),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, class_validator_1.ValidateIf)((object) => object.ls_id === undefined || object.ls_type !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_TYPES),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'DRAFT' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_STATUSES),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_auto_apply", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'BILL_AMOUNT' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_APPLY_ON),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_apply_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'NET_AMOUNT' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_CALC_AMOUNT_TYPES),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_calc_on_amount_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_BILL_TYPES),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_bill_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_CUSTOMER_TYPES),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_cust_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'ALL' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_ITEM_TYPES),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_item_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    (0, class_validator_1.ValidateIf)((object) => object.ls_id === undefined || object.ls_start_date !== undefined),
    (0, class_transformer_1.Transform)(({ value }) => (0, loyalty_dto_helpers_1.toOptionalDateString)(value)),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    (0, class_validator_1.ValidateIf)((object) => object.ls_id === undefined || object.ls_end_date !== undefined),
    (0, class_transformer_1.Transform)(({ value }) => (0, loyalty_dto_helpers_1.toOptionalDateString)(value)),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.Validate)(LoyaltySchemeDateRangeConstraint),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'time', nullable: true }),
    (0, loyalty_dto_helpers_1.OptionalTimeString)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_valid_from_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'time', nullable: true }),
    (0, loyalty_dto_helpers_1.OptionalTimeString)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_valid_to_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_valid_weekdays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((object) => object.ls_id === undefined || object.ls_comp_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_include_tax_for_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, default: 'FLOOR' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(10),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_ROUNDING_METHODS),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_rounding_method", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_recur_apl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_bal_apl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_allow_point_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_allow_gift_redeem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "ls_redeem_value_per_point", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "ls_min_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "ls_max_redeem_points_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "ls_max_redeem_percent_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "ls_redeem_min_bill_amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveLoyaltySchemeDto.prototype, "ls_points_valid_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'EARN_DATE' }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(LOYALTY_SCHEME_EXPIRY_BASIS),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_expiry_basis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltySchemeDto.prototype, "ls_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_updated_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    (0, loyalty_dto_helpers_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveLoyaltySchemeDto.prototype, "ls_approved_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltySchemeDto.prototype, "ls_approved_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: save_loyalty_party_dto_1.SaveLoyaltyPartyDto, isArray: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_loyalty_party_dto_1.SaveLoyaltyPartyDto),
    __metadata("design:type", Array)
], SaveLoyaltySchemeDto.prototype, "parties", void 0);
//# sourceMappingURL=save-loyalty-scheme.dto.js.map