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
exports.GetStockAdjReasonsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class GetStockAdjReasonsQueryDto {
    sarId;
    sarCode;
    sarReasonKind;
    activeOnly;
    includeDeleted;
}
exports.GetStockAdjReasonsQueryDto = GetStockAdjReasonsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fetch a specific stock adjustment reason by ID.',
        example: '01930000-0000-7000-0000-000000000001',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetStockAdjReasonsQueryDto.prototype, "sarId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filter by reason code.',
        example: 'DAMAGE',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(30),
    __metadata("design:type", String)
], GetStockAdjReasonsQueryDto.prototype, "sarCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filter by reason kind.',
        example: 'LOSS',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(30),
    __metadata("design:type", String)
], GetStockAdjReasonsQueryDto.prototype, "sarReasonKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: true,
        description: 'Return only active records.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetStockAdjReasonsQueryDto.prototype, "activeOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: false,
        description: 'Include soft-deleted records.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetStockAdjReasonsQueryDto.prototype, "includeDeleted", void 0);
//# sourceMappingURL=get-stock-adj-reasons-query.dto.js.map