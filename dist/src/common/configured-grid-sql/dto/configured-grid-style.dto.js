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
exports.ConfiguredGridStyleDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ConfiguredGridStyleDto {
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
exports.ConfiguredGridStyleDto = ConfiguredGridStyleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], ConfiguredGridStyleDto.prototype, "grid_column_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ConfiguredGridStyleDto.prototype, "grid_column_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'unit_name' }),
    __metadata("design:type", String)
], ConfiguredGridStyleDto.prototype, "grid_column_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 180 }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 1 }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_position", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'left' }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_alignment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfiguredGridStyleDto.prototype, "grid_column_visibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ConfiguredGridStyleDto.prototype, "grid_column_filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_condition_color", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ConfiguredGridStyleDto.prototype, "grid_column_group", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ConfiguredGridStyleDto.prototype, "grid_column_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'text' }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_data_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_color", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '180px' }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_px", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'unit_name' }),
    __metadata("design:type", Object)
], ConfiguredGridStyleDto.prototype, "grid_column_sql_field_name", void 0);
//# sourceMappingURL=configured-grid-style.dto.js.map