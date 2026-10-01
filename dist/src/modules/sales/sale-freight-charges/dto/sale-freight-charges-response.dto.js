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
exports.SaleFreightChargeSuccessDeleteDto = exports.SaleFreightChargeSuccessCreateDto = exports.SaleFreightChargeSuccessSingleDto = exports.SaleFreightChargeDeleteResultDto = exports.SaleFreightChargePayloadDto = exports.SaleFreightChargeErrorResponseDto = exports.SaleFreightChargeErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "SaleFreightChargeErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "SaleFreightChargeErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class SaleFreightChargePayloadDto {
    frId;
    frCompanyId;
    frCompanyName;
    frBranchId;
    frBranchName;
    frFromKm;
    frToKm;
    frFromWeight;
    frToWeight;
    frFreightChrg;
    frIsActive;
    frIsDeleted;
    frSyncDate;
    frCreatedOn;
    frCreatedBy;
    frModifiedOn;
    frModifiedBy;
}
exports.SaleFreightChargePayloadDto = SaleFreightChargePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleFreightChargePayloadDto.prototype, "frId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 0 }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frFromKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 100 }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frToKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 10 }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frFromWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 50 }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frToWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 250 }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frFreightChrg", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleFreightChargePayloadDto.prototype, "frIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SaleFreightChargePayloadDto.prototype, "frIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleFreightChargePayloadDto.prototype, "frCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleFreightChargePayloadDto.prototype, "frModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleFreightChargePayloadDto.prototype, "frModifiedBy", void 0);
class SaleFreightChargeDeleteResultDto {
    frId;
    deleted;
}
exports.SaleFreightChargeDeleteResultDto = SaleFreightChargeDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleFreightChargeDeleteResultDto.prototype, "frId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleFreightChargeDeleteResultDto.prototype, "deleted", void 0);
class SaleFreightChargeSuccessSingleDto {
    success;
    message;
    data;
}
exports.SaleFreightChargeSuccessSingleDto = SaleFreightChargeSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleFreightChargeSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale freight charge fetched successfully' }),
    __metadata("design:type", String)
], SaleFreightChargeSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleFreightChargePayloadDto }),
    __metadata("design:type", SaleFreightChargePayloadDto)
], SaleFreightChargeSuccessSingleDto.prototype, "data", void 0);
class SaleFreightChargeSuccessCreateDto {
    success;
    message;
    data;
}
exports.SaleFreightChargeSuccessCreateDto = SaleFreightChargeSuccessCreateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleFreightChargeSuccessCreateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale freight charge created successfully' }),
    __metadata("design:type", String)
], SaleFreightChargeSuccessCreateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleFreightChargePayloadDto }),
    __metadata("design:type", SaleFreightChargePayloadDto)
], SaleFreightChargeSuccessCreateDto.prototype, "data", void 0);
class SaleFreightChargeSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SaleFreightChargeSuccessDeleteDto = SaleFreightChargeSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleFreightChargeSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale freight charge deleted successfully' }),
    __metadata("design:type", String)
], SaleFreightChargeSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleFreightChargeDeleteResultDto }),
    __metadata("design:type", SaleFreightChargeDeleteResultDto)
], SaleFreightChargeSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=sale-freight-charges-response.dto.js.map