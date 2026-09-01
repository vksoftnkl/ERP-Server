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
exports.SaveGridColumnDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
class SaveGridColumnDto {
    grid_column_id;
    grid_column_number;
    grid_column_name;
    grid_column_width;
    grid_column_position;
    grid_column_alignment;
    grid_column_visibility;
    grid_column_filter;
    grid_column_condition;
    grid_column_condition_color;
    grid_column_group;
    grid_column_total;
    grid_column_data_type;
    grid_column_color;
    grid_column_notes;
    grid_column_px;
    grid_column_sql_field_name;
}
exports.SaveGridColumnDto = SaveGridColumnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'When provided, request updates grid column by UUID', type: String }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGridColumnDto.prototype, "grid_column_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, type: Number }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SaveGridColumnDto.prototype, "grid_column_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, type: String }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGridColumnDto.prototype, "grid_column_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_position", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, type: String }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_alignment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGridColumnDto.prototype, "grid_column_visibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGridColumnDto.prototype, "grid_column_filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, type: String }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_condition_color", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGridColumnDto.prototype, "grid_column_group", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGridColumnDto.prototype, "grid_column_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, type: String }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_data_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, type: String }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_color", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 1000, type: String }),
    (0, dtoDecorators_1.NullableString)(1000),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100, type: String, example: '120px' }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_px", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveGridColumnDto.prototype, "grid_column_sql_field_name", void 0);
//# sourceMappingURL=save-grid-column.dto.js.map