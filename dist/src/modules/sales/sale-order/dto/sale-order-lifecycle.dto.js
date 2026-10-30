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
exports.AmendSaleOrderDto = exports.CancelSaleOrderDto = exports.PostSaleOrderDto = exports.SaleOrderKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_sale_order_dto_1 = require("./save-sale-order.dto");
class SaleOrderKeysDto {
    soId;
    soCompanyId;
    soBranchId;
    soAccYear;
}
exports.SaleOrderKeysDto = SaleOrderKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleOrderKeysDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleOrderKeysDto.prototype, "soCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleOrderKeysDto.prototype, "soBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaleOrderKeysDto.prototype, "soAccYear", void 0);
class PostSaleOrderDto extends SaleOrderKeysDto {
}
exports.PostSaleOrderDto = PostSaleOrderDto;
class CancelSaleOrderDto extends SaleOrderKeysDto {
    reason;
}
exports.CancelSaleOrderDto = CancelSaleOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelSaleOrderDto.prototype, "reason", void 0);
class AmendSaleOrderDto extends save_sale_order_dto_1.SaveSaleOrderDto {
    baseRevision;
    editRemark;
}
exports.AmendSaleOrderDto = AmendSaleOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Required on amend' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendSaleOrderDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The soRevisionNo the client loaded — the optimistic lock' }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], AmendSaleOrderDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AmendSaleOrderDto.prototype, "editRemark", void 0);
//# sourceMappingURL=sale-order-lifecycle.dto.js.map