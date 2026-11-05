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
exports.InventoryErrorResponseDto = exports.InventoryErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class InventoryErrorFieldDto {
    field;
    message;
}
exports.InventoryErrorFieldDto = InventoryErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fieldName' }),
    __metadata("design:type", String)
], InventoryErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation message' }),
    __metadata("design:type", String)
], InventoryErrorFieldDto.prototype, "message", void 0);
class InventoryErrorResponseDto {
    success;
    message;
    errors;
}
exports.InventoryErrorResponseDto = InventoryErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], InventoryErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], InventoryErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: InventoryErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], InventoryErrorResponseDto.prototype, "errors", void 0);
//# sourceMappingURL=inventory-response.dto.js.map