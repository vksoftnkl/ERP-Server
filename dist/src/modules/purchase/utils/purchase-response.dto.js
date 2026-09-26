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
exports.PurchaseListMetaDto = exports.PurchaseErrorResponseDto = exports.PurchaseErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PurchaseErrorFieldDto {
    field;
    message;
}
exports.PurchaseErrorFieldDto = PurchaseErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fieldName' }),
    __metadata("design:type", String)
], PurchaseErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation message' }),
    __metadata("design:type", String)
], PurchaseErrorFieldDto.prototype, "message", void 0);
class PurchaseErrorResponseDto {
    success;
    message;
    errors;
}
exports.PurchaseErrorResponseDto = PurchaseErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PurchaseErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], PurchaseErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PurchaseErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], PurchaseErrorResponseDto.prototype, "errors", void 0);
class PurchaseListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.PurchaseListMetaDto = PurchaseListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PurchaseListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], PurchaseListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PurchaseListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PurchaseListMetaDto.prototype, "total_pages", void 0);
//# sourceMappingURL=purchase-response.dto.js.map