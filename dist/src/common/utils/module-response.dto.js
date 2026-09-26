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
exports.SalesListMetaDto = exports.PurchaseListMetaDto = exports.InventoryListMetaDto = exports.FixedListMetaDto = exports.AccountsListMetaDto = exports.SalesErrorResponseDto = exports.PurchaseErrorResponseDto = exports.InventoryErrorResponseDto = exports.FixedErrorResponseDto = exports.AccountsErrorResponseDto = exports.SalesErrorFieldDto = exports.PurchaseErrorFieldDto = exports.InventoryErrorFieldDto = exports.FixedErrorFieldDto = exports.AccountsErrorFieldDto = exports.ModuleListMetaDto = exports.ModuleErrorResponseDto = exports.ModuleErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ModuleErrorFieldDto {
    field;
    message;
}
exports.ModuleErrorFieldDto = ModuleErrorFieldDto;
exports.AccountsErrorFieldDto = ModuleErrorFieldDto;
exports.FixedErrorFieldDto = ModuleErrorFieldDto;
exports.InventoryErrorFieldDto = ModuleErrorFieldDto;
exports.PurchaseErrorFieldDto = ModuleErrorFieldDto;
exports.SalesErrorFieldDto = ModuleErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fieldName' }),
    __metadata("design:type", String)
], ModuleErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation message' }),
    __metadata("design:type", String)
], ModuleErrorFieldDto.prototype, "message", void 0);
class ModuleErrorResponseDto {
    success;
    message;
    errors;
}
exports.ModuleErrorResponseDto = ModuleErrorResponseDto;
exports.AccountsErrorResponseDto = ModuleErrorResponseDto;
exports.FixedErrorResponseDto = ModuleErrorResponseDto;
exports.InventoryErrorResponseDto = ModuleErrorResponseDto;
exports.PurchaseErrorResponseDto = ModuleErrorResponseDto;
exports.SalesErrorResponseDto = ModuleErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ModuleErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ModuleErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ModuleErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ModuleErrorResponseDto.prototype, "errors", void 0);
class ModuleListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.ModuleListMetaDto = ModuleListMetaDto;
exports.AccountsListMetaDto = ModuleListMetaDto;
exports.FixedListMetaDto = ModuleListMetaDto;
exports.InventoryListMetaDto = ModuleListMetaDto;
exports.PurchaseListMetaDto = ModuleListMetaDto;
exports.SalesListMetaDto = ModuleListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ModuleListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ModuleListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], ModuleListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ModuleListMetaDto.prototype, "total_pages", void 0);
//# sourceMappingURL=module-response.dto.js.map