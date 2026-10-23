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
exports.SaveItemSizeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveItemSizeDto {
    isz_id;
    isz_company_id;
    isz_name;
    isz_code;
    isz_size_set;
    isz_sort;
    isz_is_active;
}
exports.SaveItemSizeDto = SaveItemSizeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, the request updates that size.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemSizeDto.prototype, "isz_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = shared by every company. Taken on create; ignored on update.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemSizeDto.prototype, "isz_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 50,
        example: 'XL',
        description: 'Trimmed. Unique ignoring case among the live sizes of the company and the shared ones: ' +
            'a taken name is a 409 ITEM_SIZE_NAME_TAKEN whose error carries existingId — a quick-add ' +
            'uses that row.',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], SaveItemSizeDto.prototype, "isz_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveItemSizeDto.prototype, "isz_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        example: 'ALPHA',
        description: 'ALPHA / WAIST / KIDS / free text: groups sizes for a size grid.',
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveItemSizeDto.prototype, "isz_size_set", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, description: 'S < M < L < XL; lists and reports sort by it.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SaveItemSizeDto.prototype, "isz_sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemSizeDto.prototype, "isz_is_active", void 0);
//# sourceMappingURL=save-item-size.dto.js.map