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
exports.SaveGridDetailDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const grid_detail_enum_1 = require("../types/grid-detail-enum");
const save_grid_column_dto_1 = require("./save-grid-column.dto");
class SaveGridDetailDto {
    grid_id;
    grid_name;
    grid_description;
    grid_sort_column;
    grid_sort_order;
    grid_sql;
    grid_status;
    grid_device_type;
    grid_columns;
    replace_columns;
}
exports.SaveGridDetailDto = SaveGridDetailDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'When provided, request updates grid details', type: String }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveGridDetailDto.prototype, "grid_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, type: String }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGridDetailDto.prototype, "grid_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1000, nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(1000),
    __metadata("design:type", Object)
], SaveGridDetailDto.prototype, "grid_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveGridDetailDto.prototype, "grid_sort_column", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveGridDetailDto.prototype, "grid_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveGridDetailDto.prototype, "grid_sql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGridDetailDto.prototype, "grid_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, enum: grid_detail_enum_1.gridDeviceTypeEnum }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGridDetailDto.prototype, "grid_device_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Array of columns to create or update for this grid',
        type: [save_grid_column_dto_1.SaveGridColumnDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_grid_column_dto_1.SaveGridColumnDto),
    __metadata("design:type", Array)
], SaveGridDetailDto.prototype, "grid_columns", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When true, columns not present in grid_columns are soft deleted (full replace). When false or omitted, provided columns are only created/updated.',
        default: false,
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGridDetailDto.prototype, "replace_columns", void 0);
//# sourceMappingURL=save-grid-detail.dto.js.map