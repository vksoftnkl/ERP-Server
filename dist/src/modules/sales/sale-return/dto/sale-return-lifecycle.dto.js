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
exports.SaleReturnTransportDto = exports.AmendSaleReturnDto = exports.CancelSaleReturnDto = exports.PostSaleReturnDto = exports.ValidateSaleReturnDto = exports.SaleReturnKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_sale_return_dto_1 = require("./save-sale-return.dto");
class SaleReturnKeysDto {
    srId;
    srCompanyId;
    srBranchId;
    srAccYear;
}
exports.SaleReturnKeysDto = SaleReturnKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srAccYear", void 0);
class ValidateSaleReturnDto extends save_sale_return_dto_1.SaveSaleReturnDto {
    overrides;
}
exports.ValidateSaleReturnDto = ValidateSaleReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ValidateSaleReturnDto.prototype, "overrides", void 0);
class PostSaleReturnDto extends SaleReturnKeysDto {
    overrides;
    printAfter;
}
exports.PostSaleReturnDto = PostSaleReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PostSaleReturnDto.prototype, "overrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], PostSaleReturnDto.prototype, "printAfter", void 0);
class CancelSaleReturnDto extends SaleReturnKeysDto {
    reason;
}
exports.CancelSaleReturnDto = CancelSaleReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelSaleReturnDto.prototype, "reason", void 0);
class AmendSaleReturnDto extends ValidateSaleReturnDto {
    baseRevision;
    editRemark;
}
exports.AmendSaleReturnDto = AmendSaleReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendSaleReturnDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], AmendSaleReturnDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AmendSaleReturnDto.prototype, "editRemark", void 0);
class SaleReturnTransportDto extends SaleReturnKeysDto {
    transport;
}
exports.SaleReturnTransportDto = SaleReturnTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: bill_lifecycle_dto_1.TransportBandDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => bill_lifecycle_dto_1.TransportBandDto),
    __metadata("design:type", bill_lifecycle_dto_1.TransportBandDto)
], SaleReturnTransportDto.prototype, "transport", void 0);
//# sourceMappingURL=sale-return-lifecycle.dto.js.map