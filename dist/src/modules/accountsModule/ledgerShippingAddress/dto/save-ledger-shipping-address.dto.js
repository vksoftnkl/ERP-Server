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
exports.SaveLedgerShippingAddressDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const class_transformer_1 = require("class-transformer");
const class_validator_2 = require("class-validator");
const DtoTransforms_1 = require("../../../../common/dto/DtoTransforms");
const ledger_shipping_address_enum_1 = require("../types/ledger-shipping-address-enum");
class SaveLedgerShippingAddressDto {
    saaId;
    saaCompanyId;
    saaBranchId;
    saaLedgerId;
    saaAddrType;
    saaIsDefault;
    saaSort;
    saaTradeName;
    saaContactName;
    saaAddr1;
    saaAddr2;
    saaAddr3;
    saaLocation;
    saaPin;
    saaStateCode;
    saaStateName;
    saaCountryCode;
    saaDistanceKm;
    saaPhone;
    saaEmail;
    saaGstin;
    saaSyncedOn;
    saaIsActive;
    saaRemarks;
}
exports.SaveLedgerShippingAddressDto = SaveLedgerShippingAddressDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing ledger shipping address',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLedgerShippingAddressDto.prototype, "saaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLedgerShippingAddressDto.prototype, "saaLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ledger_shipping_address_enum_1.SaaAddrType,
        enumName: 'SaaAddrType',
        description: 'Allowed values: SHIP_TO, BILL_TO, BOTH (defaults to SHIP_TO)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, DtoTransforms_1.toUpperTrimmed)(value)),
    (0, class_validator_1.IsEnum)(ledger_shipping_address_enum_1.SaaAddrType),
    __metadata("design:type", String)
], SaveLedgerShippingAddressDto.prototype, "saaAddrType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveLedgerShippingAddressDto.prototype, "saaIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveLedgerShippingAddressDto.prototype, "saaSort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaTradeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaContactName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaLocation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 10,
        nullable: true,
        description: 'PIN code; must be 6 digits when the country is India',
    }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 2,
        minLength: 2,
        nullable: true,
        description: '2-digit GST numeric state code',
    }),
    (0, dtoDecorators_1.NullableUpperString)(2),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 2,
        minLength: 2,
        description: 'ISO country code (defaults to IN)',
    }),
    (0, dtoDecorators_1.OptionalUpperString)(2),
    __metadata("design:type", String)
], SaveLedgerShippingAddressDto.prototype, "saaCountryCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaDistanceKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaEmail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 15,
        description: 'Mandatory 15-character GSTIN',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (0, DtoTransforms_1.toUpperTrimmed)(value)),
    (0, class_validator_2.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveLedgerShippingAddressDto.prototype, "saaGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaSyncedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveLedgerShippingAddressDto.prototype, "saaIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveLedgerShippingAddressDto.prototype, "saaRemarks", void 0);
//# sourceMappingURL=save-ledger-shipping-address.dto.js.map