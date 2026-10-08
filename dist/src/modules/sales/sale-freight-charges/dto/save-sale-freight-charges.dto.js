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
exports.SaveSaleFreightChargeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveSaleFreightChargeDto {
    frId;
    frCompanyId;
    frBranchId;
    frFromKm;
    frToKm;
    frFromWeight;
    frToWeight;
    frFreightChrg;
    frIsActive;
    frCreatedBy;
    frModifiedBy;
}
exports.SaveSaleFreightChargeDto = SaveSaleFreightChargeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing sale freight charge',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleFreightChargeDto.prototype, "frId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frFromKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frToKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frFromWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frToWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frFreightChrg", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleFreightChargeDto.prototype, "frIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSaleFreightChargeDto.prototype, "frModifiedBy", void 0);
//# sourceMappingURL=save-sale-freight-charges.dto.js.map