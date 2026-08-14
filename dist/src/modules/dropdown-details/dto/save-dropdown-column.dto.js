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
exports.SaveDropdownColumnDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
class SaveDropdownColumnDto {
    dropdown_columns_id;
    dropdown_columns_no;
    dropdown_columns_data_type;
    dropdown_columns_name;
    dropdown_columns_alias;
    dropdown_columns_width;
    dropdown_columns_visiblity;
    dropdown_columns_allignment;
    dropdown_columns_filter;
    dropdown_columns_sql_name;
}
exports.SaveDropdownColumnDto = SaveDropdownColumnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, request updates dropdown column by UUID',
        type: String,
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDropdownColumnDto.prototype, "dropdown_columns_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0, type: Number }),
    (0, dtoDecorators_1.RequiredInteger)(0),
    __metadata("design:type", Number)
], SaveDropdownColumnDto.prototype, "dropdown_columns_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, type: String }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDropdownColumnDto.prototype, "dropdown_columns_data_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, type: String }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveDropdownColumnDto.prototype, "dropdown_columns_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 200, type: String }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveDropdownColumnDto.prototype, "dropdown_columns_alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDropdownColumnDto.prototype, "dropdown_columns_width", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDropdownColumnDto.prototype, "dropdown_columns_visiblity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 30, type: String }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveDropdownColumnDto.prototype, "dropdown_columns_allignment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDropdownColumnDto.prototype, "dropdown_columns_filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveDropdownColumnDto.prototype, "dropdown_columns_sql_name", void 0);
//# sourceMappingURL=save-dropdown-column.dto.js.map