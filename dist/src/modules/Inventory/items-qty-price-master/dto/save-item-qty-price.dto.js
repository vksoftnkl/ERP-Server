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
exports.SaveItemQtyPriceDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveItemQtyPriceDto {
    iqp_id;
    iqp_company_id;
    iqp_branch_id;
    iqp_party_id;
    iqp_price_level;
    iqp_item_id;
    iqp_item_unit_id;
    iqp_from_qty;
    iqp_to_qty;
    iqp_price_mode;
    iqp_disc_pct;
    iqp_flat_off;
    iqp_price;
    iqp_is_tax_incl;
    iqp_effective_from;
    iqp_effective_to;
    iqp_is_active;
    iqp_sync_date;
    iqp_created_by;
    iqp_modified_by;
}
exports.SaveItemQtyPriceDto = SaveItemQtyPriceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing item qty price row',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveItemQtyPriceDto.prototype, "iqp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Party/customer this slab is scoped to (null = applies to all)',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_party_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Price level this slab applies to' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_price_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveItemQtyPriceDto.prototype, "iqp_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveItemQtyPriceDto.prototype, "iqp_item_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, default: 0, description: 'Slab lower bound (inclusive)' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveItemQtyPriceDto.prototype, "iqp_from_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 0,
        nullable: true,
        description: 'Slab upper bound (exclusive); null = "& above"',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_to_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 1,
        default: 'P',
        description: 'P = by % | R = by qty (flat off) | F = fixed price',
    }),
    (0, dtoDecorators_1.OptionalUpperString)(1),
    (0, class_validator_1.Matches)(/^[PRF]$/, { message: 'iqp_price_mode must be one of P, R, F' }),
    __metadata("design:type", String)
], SaveItemQtyPriceDto.prototype, "iqp_price_mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_disc_pct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_flat_off", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemQtyPriceDto.prototype, "iqp_is_tax_incl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        format: 'date',
        description: 'Slab effective-from date (inclusive)',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SaveItemQtyPriceDto.prototype, "iqp_effective_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_effective_to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemQtyPriceDto.prototype, "iqp_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveItemQtyPriceDto.prototype, "iqp_modified_by", void 0);
//# sourceMappingURL=save-item-qty-price.dto.js.map