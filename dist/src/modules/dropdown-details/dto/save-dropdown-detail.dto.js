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
exports.SaveDropdownDetailDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const save_dropdown_column_dto_1 = require("./save-dropdown-column.dto");
class SaveDropdownDetailDto {
    dropdown_id;
    dropdown_name;
    dropdown_sql;
    dropdown_description;
    dropdown_sort_order;
    dropdown_sort_column;
    dropdown_completion;
    dropdown_sql_regional;
    dropdown_max_visible_items;
    dropdown_show_header;
    dropdown_width;
    dropdown_device_type;
    dropdown_columns;
    replace_columns;
}
exports.SaveDropdownDetailDto = SaveDropdownDetailDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, request updates dropdown details',
        type: String,
    }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveDropdownDetailDto.prototype, "dropdown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, type: String }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDropdownDetailDto.prototype, "dropdown_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'SQL query for dropdown source', type: String }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDropdownDetailDto.prototype, "dropdown_sql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 20, type: String }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, type: String }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_sort_column", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_completion", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_sql_regional", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 10 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveDropdownDetailDto.prototype, "dropdown_max_visible_items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDropdownDetailDto.prototype, "dropdown_show_header", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, minimum: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveDropdownDetailDto.prototype, "dropdown_device_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Array of columns to create or update for this dropdown',
        type: [save_dropdown_column_dto_1.SaveDropdownColumnDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_dropdown_column_dto_1.SaveDropdownColumnDto),
    __metadata("design:type", Array)
], SaveDropdownDetailDto.prototype, "dropdown_columns", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When true, columns not present in dropdown_columns are deleted (full replace). When false or omitted, provided columns are only created/updated.',
        default: false,
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDropdownDetailDto.prototype, "replace_columns", void 0);
//# sourceMappingURL=save-dropdown-detail.dto.js.map