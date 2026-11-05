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
exports.UpdateBatchDetailDto = exports.BatchDetailModelsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class BatchDetailModelsQueryDto {
    companyId;
    itemId;
    q;
}
exports.BatchDetailModelsQueryDto = BatchDetailModelsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BatchDetailModelsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BatchDetailModelsQueryDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Typed so far; matched anywhere in the model, ignoring case.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], BatchDetailModelsQueryDto.prototype, "q", void 0);
class UpdateBatchDetailDto {
    companyId;
    batchNo;
    sizeId;
    colourId;
    model;
    reason;
}
exports.UpdateBatchDetailDto = UpdateBatchDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], UpdateBatchDetailDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CBE26-00001', description: 'Matched trimmed and upper-cased.' }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateBatchDetailDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Omitted: kept. null: cleared.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], UpdateBatchDetailDto.prototype, "sizeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Omitted: kept. null: cleared.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], UpdateBatchDetailDto.prototype, "colourId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Omitted: kept. null or blank: cleared.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], UpdateBatchDetailDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250, description: 'Why — kept on the audit row.' }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateBatchDetailDto.prototype, "reason", void 0);
//# sourceMappingURL=batch-detail.dto.js.map