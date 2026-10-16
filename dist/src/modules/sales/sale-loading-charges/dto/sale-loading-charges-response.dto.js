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
exports.SaleLoadingChargeSuccessDeleteDto = exports.SaleLoadingChargeSuccessCreateDto = exports.SaleLoadingChargeSuccessSingleDto = exports.SaleLoadingChargeDeleteResultDto = exports.SaleLoadingChargePayloadDto = exports.SaleLoadingChargeErrorResponseDto = exports.SaleLoadingChargeErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "SaleLoadingChargeErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "SaleLoadingChargeErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class SaleLoadingChargePayloadDto {
    ilcId;
    ilcCompId;
    ilcCompanyName;
    ilcBranchId;
    ilcBranchName;
    ilcFromWeight;
    ilcToWeight;
    ilcLoadChrg;
    ilcUnloadChrg;
    ilcIsActive;
    ilcIsDeleted;
    ilcSyncDate;
    ilcCreatedOn;
    ilcCreatedBy;
    ilcModifiedOn;
    ilcModifiedBy;
}
exports.SaleLoadingChargePayloadDto = SaleLoadingChargePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleLoadingChargePayloadDto.prototype, "ilcId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcCompId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 0 }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcFromWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 50 }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcToWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 25 }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcLoadChrg", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 25 }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcUnloadChrg", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleLoadingChargePayloadDto.prototype, "ilcIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SaleLoadingChargePayloadDto.prototype, "ilcIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleLoadingChargePayloadDto.prototype, "ilcCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleLoadingChargePayloadDto.prototype, "ilcModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleLoadingChargePayloadDto.prototype, "ilcModifiedBy", void 0);
class SaleLoadingChargeDeleteResultDto {
    ilcId;
    deleted;
}
exports.SaleLoadingChargeDeleteResultDto = SaleLoadingChargeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleLoadingChargeDeleteResultDto.prototype, "ilcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleLoadingChargeDeleteResultDto.prototype, "deleted", void 0);
class SaleLoadingChargeSuccessSingleDto {
    success;
    message;
    data;
}
exports.SaleLoadingChargeSuccessSingleDto = SaleLoadingChargeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleLoadingChargeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale loading charge fetched successfully' }),
    __metadata("design:type", String)
], SaleLoadingChargeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleLoadingChargePayloadDto }),
    __metadata("design:type", SaleLoadingChargePayloadDto)
], SaleLoadingChargeSuccessSingleDto.prototype, "data", void 0);
class SaleLoadingChargeSuccessCreateDto {
    success;
    message;
    data;
}
exports.SaleLoadingChargeSuccessCreateDto = SaleLoadingChargeSuccessCreateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleLoadingChargeSuccessCreateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale loading charge created successfully' }),
    __metadata("design:type", String)
], SaleLoadingChargeSuccessCreateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleLoadingChargePayloadDto }),
    __metadata("design:type", SaleLoadingChargePayloadDto)
], SaleLoadingChargeSuccessCreateDto.prototype, "data", void 0);
class SaleLoadingChargeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SaleLoadingChargeSuccessDeleteDto = SaleLoadingChargeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleLoadingChargeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale loading charge deleted successfully' }),
    __metadata("design:type", String)
], SaleLoadingChargeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleLoadingChargeDeleteResultDto }),
    __metadata("design:type", SaleLoadingChargeDeleteResultDto)
], SaleLoadingChargeSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=sale-loading-charges-response.dto.js.map