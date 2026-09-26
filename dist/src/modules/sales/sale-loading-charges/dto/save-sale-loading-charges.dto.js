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
exports.SaveSaleLoadingChargeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveSaleLoadingChargeDto {
    ilcId;
    ilcCompId;
    ilcBranchId;
    ilcFromWeight;
    ilcToWeight;
    ilcLoadChrg;
    ilcUnloadChrg;
    ilcIsActive;
    ilcCreatedBy;
    ilcModifiedBy;
}
exports.SaveSaleLoadingChargeDto = SaveSaleLoadingChargeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing sale loading charge',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleLoadingChargeDto.prototype, "ilcId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcCompId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcFromWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcToWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcLoadChrg", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcUnloadChrg", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleLoadingChargeDto.prototype, "ilcIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSaleLoadingChargeDto.prototype, "ilcModifiedBy", void 0);
//# sourceMappingURL=save-sale-loading-charges.dto.js.map