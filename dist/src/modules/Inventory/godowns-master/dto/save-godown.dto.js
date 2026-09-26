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
exports.SaveGodownDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const dto_transforms_1 = require("../../../../common/dto/dto-transforms");
class SaveGodownDto {
    gdl_id;
    gdl_branch_id;
    gdl_name;
    gdl_short;
    gdl_code;
    gdl_type;
    gdl_parent_id;
    gdl_sort;
    gdl_level;
    gdl_del_sheet;
    gdl_split_stock;
    gdl_is_active;
    gdl_negative_stock;
    gdl_volume;
    gdl_remarks;
    godown_id;
    godown_name;
    godown_code;
    godown_alias;
    godown_short;
    godown_description;
    godown_sort;
    branch_id;
    parent_id;
    is_active;
    gdl_location_id;
}
exports.SaveGodownDto = SaveGodownDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the godown location',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toOptionalUuid)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['gdl_location_id']))),
    (0, class_validator_1.Matches)(dtoDecorators_1.UUID_PATTERN),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "gdl_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required for create, optional for update' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toOptionalUuid)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['branch_id']))),
    (0, class_validator_1.Matches)(dtoDecorators_1.UUID_PATTERN),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "gdl_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required for create, optional for update' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toTrimmedString)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['godown_name']))),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "gdl_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toNullableString)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['godown_short', 'godown_alias']))),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "gdl_short", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 30 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toNullableString)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['godown_code']))),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "gdl_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'BIN' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "gdl_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toNullableUuid)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['parent_id']))),
    (0, class_validator_1.Matches)(dtoDecorators_1.UUID_PATTERN),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "gdl_parent_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toOptionalInteger)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['godown_sort']))),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SaveGodownDto.prototype, "gdl_sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveGodownDto.prototype, "gdl_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGodownDto.prototype, "gdl_del_sheet", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGodownDto.prototype, "gdl_split_stock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toOptionalBoolean)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['is_active']))),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveGodownDto.prototype, "gdl_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGodownDto.prototype, "gdl_negative_stock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveGodownDto.prototype, "gdl_volume", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, dtoDecorators_1.toNullableString)((0, dto_transforms_1.resolveAliasValue)(value, obj, ['godown_description']))),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "gdl_remarks", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "godown_id", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalTrimmedString)(200),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "godown_name", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "godown_code", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "godown_alias", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "godown_short", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "godown_description", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveGodownDto.prototype, "godown_sort", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "branch_id", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveGodownDto.prototype, "parent_id", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveGodownDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGodownDto.prototype, "gdl_location_id", void 0);
//# sourceMappingURL=save-godown.dto.js.map