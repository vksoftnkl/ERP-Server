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
exports.CreateSequenceDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dto_transforms_1 = require("../../dto/dto-transforms");
class CreateSequenceDto {
    vchrTypeId;
    companyId;
    branchId;
    accYear;
    deviceId;
    deviceCode;
    periodKey;
    voucherPrefix;
    companyCode;
    branchCode;
    voucherSuffix;
    noWidth;
    lastRefno;
    isActive;
    createdBy;
}
exports.CreateSequenceDto = CreateSequenceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateSequenceDto.prototype, "vchrTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], CreateSequenceDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], CreateSequenceDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9, example: '2026-27' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], CreateSequenceDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableUuid)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'MAIN' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateSequenceDto.prototype, "deviceCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: '2026-27' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateSequenceDto.prototype, "periodKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "voucherPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "companyCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "branchCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "voucherSuffix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 5 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateSequenceDto.prototype, "noWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "lastRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSequenceDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableUuid)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", Object)
], CreateSequenceDto.prototype, "createdBy", void 0);
//# sourceMappingURL=create-sequence.dto.js.map