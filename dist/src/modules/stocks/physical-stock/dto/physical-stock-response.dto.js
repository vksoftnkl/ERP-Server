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
exports.PhysicalStockErrorResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PhysicalStockErrorResponseDto {
    success;
    message;
    statusCode;
    errors;
}
exports.PhysicalStockErrorResponseDto = PhysicalStockErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'Request success status',
    }),
    __metadata("design:type", Boolean)
], PhysicalStockErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Validation failed',
        description: 'Error message',
    }),
    __metadata("design:type", String)
], PhysicalStockErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 400,
        description: 'HTTP status code',
    }),
    __metadata("design:type", Number)
], PhysicalStockErrorResponseDto.prototype, "statusCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: [
            'psDocNo must be a number',
            'psGodownId should not be empty',
        ],
        required: false,
        description: 'Validation error details',
        type: [String],
    }),
    __metadata("design:type", Array)
], PhysicalStockErrorResponseDto.prototype, "errors", void 0);
//# sourceMappingURL=physical-stock-response.dto.js.map