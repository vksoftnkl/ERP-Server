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
exports.SaveAgeingSlabsDto = exports.AgeingSlabDto = exports.AgeingSlabsCompanyDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class AgeingSlabsCompanyDto {
    companyId;
}
exports.AgeingSlabsCompanyDto = AgeingSlabsCompanyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company whose ladder is read or reverted.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AgeingSlabsCompanyDto.prototype, "companyId", void 0);
class AgeingSlabDto {
    slabNo;
    label;
    fromDays;
    toDays;
}
exports.AgeingSlabDto = AgeingSlabDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 20, example: 1, description: '1..n, in order.' }),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], AgeingSlabDto.prototype, "slabNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, example: '0-30 days', description: 'Non-blank, unique within the ladder (any case).' }),
    (0, dtoDecorators_1.TrimmedString)(50),
    __metadata("design:type", String)
], AgeingSlabDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 0,
        example: 0,
        description: 'The first slab starts at 0; each next one the day after the previous one ends.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], AgeingSlabDto.prototype, "fromDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        nullable: true,
        example: 30,
        description: 'Inclusive. null = open-ended ("and older"): exactly one slab is, and it is the last.',
    }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], AgeingSlabDto.prototype, "toDays", void 0);
class SaveAgeingSlabsDto extends AgeingSlabsCompanyDto {
    slabs;
}
exports.SaveAgeingSlabsDto = SaveAgeingSlabsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: AgeingSlabDto,
        isArray: true,
        description: '1–20 slabs, slabNo 1..n, contiguous from day 0, the last (only the last) open-ended. Refused 422 per field (slabs.<i>.fromDays …) otherwise.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AgeingSlabDto),
    __metadata("design:type", Array)
], SaveAgeingSlabsDto.prototype, "slabs", void 0);
//# sourceMappingURL=ageing-slabs.dto.js.map