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
exports.ItemTaxHistorySuccessDeleteDto = exports.ItemTaxHistorySuccessSingleDto = exports.ItemTaxHistoryDeleteResultDto = exports.ItemTaxHistoryPayloadDto = exports.ItemTaxHistoryErrorResponseDto = exports.ItemTaxHistoryErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemTaxHistoryErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemTaxHistoryErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class ItemTaxHistoryPayloadDto {
    ith_id;
    ith_item_id;
    ith_tax_id;
    ith_effective_from;
    ith_effective_to;
    ith_reason;
    ith_created_on;
    ith_created_by;
}
exports.ItemTaxHistoryPayloadDto = ItemTaxHistoryPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemTaxHistoryPayloadDto.prototype, "ith_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemTaxHistoryPayloadDto.prototype, "ith_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemTaxHistoryPayloadDto.prototype, "ith_tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemTaxHistoryPayloadDto.prototype, "ith_effective_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemTaxHistoryPayloadDto.prototype, "ith_effective_to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemTaxHistoryPayloadDto.prototype, "ith_reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemTaxHistoryPayloadDto.prototype, "ith_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemTaxHistoryPayloadDto.prototype, "ith_created_by", void 0);
class ItemTaxHistoryDeleteResultDto {
    ith_id;
    deleted;
}
exports.ItemTaxHistoryDeleteResultDto = ItemTaxHistoryDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemTaxHistoryDeleteResultDto.prototype, "ith_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemTaxHistoryDeleteResultDto.prototype, "deleted", void 0);
class ItemTaxHistorySuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemTaxHistorySuccessSingleDto = ItemTaxHistorySuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemTaxHistorySuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item tax history fetched successfully' }),
    __metadata("design:type", String)
], ItemTaxHistorySuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemTaxHistoryPayloadDto }),
    __metadata("design:type", ItemTaxHistoryPayloadDto)
], ItemTaxHistorySuccessSingleDto.prototype, "data", void 0);
class ItemTaxHistorySuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemTaxHistorySuccessDeleteDto = ItemTaxHistorySuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemTaxHistorySuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item tax history deleted successfully' }),
    __metadata("design:type", String)
], ItemTaxHistorySuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemTaxHistoryDeleteResultDto }),
    __metadata("design:type", ItemTaxHistoryDeleteResultDto)
], ItemTaxHistorySuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-tax-history-response.dto.js.map