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
exports.SaveItemPriceDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ITEM_PRICE_PROFIT_TYPES = ['By %', 'By Rs', 'By User'];
class SaveItemPriceDto {
    ipm_id;
    ipm_company_id;
    ipm_branch_id;
    ipm_item_id;
    ipm_uc_unit_id;
    ipm_godown_id;
    ipm_sl_no;
    ipm_cost_price;
    ipm_cost_wot;
    ipm_sales_price_a;
    ipm_sales_price_b;
    ipm_sales_price_c;
    ipm_sales_price_d;
    ipm_price_a_wot;
    ipm_price_b_wot;
    ipm_price_c_wot;
    ipm_price_d_wot;
    ipm_price_a_markup_perc;
    ipm_price_b_markup_perc;
    ipm_price_c_markup_perc;
    ipm_price_d_markup_perc;
    ipm_max_price;
    ipm_min_price;
    ipm_disc_perc;
    ipm_disc_qty;
    ipm_addl_cess;
    ipm_profit_type;
    ipm_round_off;
    ipm_loading_charge;
    ipm_freight_charge;
    ipm_loyalty_points;
    ipm_uom_remarks;
    ipm_cost_remarks;
    ipm_is_active;
    ipm_sync_date;
    ipm_created_by;
    ipm_updated_by;
}
exports.SaveItemPriceDto = SaveItemPriceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing item price row',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveItemPriceDto.prototype, "ipm_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveItemPriceDto.prototype, "ipm_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Item unit conversion id (iuc_id) this price applies to' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveItemPriceDto.prototype, "ipm_uc_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_sl_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_cost_price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_cost_wot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_sales_price_a", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_sales_price_b", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_sales_price_c", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_sales_price_d", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_a_wot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_b_wot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_c_wot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_d_wot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_a_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_b_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_c_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_price_d_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_max_price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_min_price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_addl_cess", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, enum: ITEM_PRICE_PROFIT_TYPES }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(20),
    (0, class_validator_1.IsIn)(ITEM_PRICE_PROFIT_TYPES),
    __metadata("design:type", String)
], SaveItemPriceDto.prototype, "ipm_profit_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_round_off", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_loading_charge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_freight_charge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemPriceDto.prototype, "ipm_loyalty_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, maxLength: 250, nullable: true, example: null }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_uom_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, maxLength: 250, nullable: true, example: null }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_cost_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemPriceDto.prototype, "ipm_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemPriceDto.prototype, "ipm_updated_by", void 0);
//# sourceMappingURL=save-item-price.dto.js.map