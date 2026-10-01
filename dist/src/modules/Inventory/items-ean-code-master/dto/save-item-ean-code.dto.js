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
exports.SaveItemEanCodeDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveItemEanCodeDto {
    ean_id;
    ean_item_id;
    ean_unit_id;
    ean_code;
    ean_sl_no;
    ean_is_default;
    ean_is_active;
    ean_created_by;
    ean_modified_by;
    ean_remarks;
}
exports.SaveItemEanCodeDto = SaveItemEanCodeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing EAN code row',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveItemEanCodeDto.prototype, "ean_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveItemEanCodeDto.prototype, "ean_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveItemEanCodeDto.prototype, "ean_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 64 }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SaveItemEanCodeDto.prototype, "ean_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemEanCodeDto.prototype, "ean_sl_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemEanCodeDto.prototype, "ean_is_default", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemEanCodeDto.prototype, "ean_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveItemEanCodeDto.prototype, "ean_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveItemEanCodeDto.prototype, "ean_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveItemEanCodeDto.prototype, "ean_remarks", void 0);
//# sourceMappingURL=save-item-ean-code.dto.js.map