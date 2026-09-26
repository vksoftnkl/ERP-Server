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
exports.SaveUiTableMasterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_ui_table_column_dto_1 = require("./save-ui-table-column.dto");
class SaveUiTableMasterDto {
    uiTblId;
    uiTblName;
    uiTblEditable;
    uiTblIsActive;
    uiTblDeviceType;
    uiTblColumns;
    replaceColumns;
}
exports.SaveUiTableMasterDto = SaveUiTableMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, request updates the existing UI table row',
        example: '1',
    }),
    (0, dtoDecorators_1.OptionalNumberString)(),
    __metadata("design:type", String)
], SaveUiTableMasterDto.prototype, "uiTblId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'UI table name', example: 'Item Master Grid' }),
    (0, dtoDecorators_1.TrimmedString)(500),
    (0, class_validator_1.ValidateIf)((o) => !o.uiTblId),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveUiTableMasterDto.prototype, "uiTblName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableMasterDto.prototype, "uiTblEditable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableMasterDto.prototype, "uiTblIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Device type for this UI table', nullable: true }),
    (0, dtoDecorators_1.NullableString)(255),
    __metadata("design:type", Object)
], SaveUiTableMasterDto.prototype, "uiTblDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Array of columns to create or update for this table',
        type: [save_ui_table_column_dto_1.SaveUiTableColumnDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_ui_table_column_dto_1.SaveUiTableColumnDto),
    __metadata("design:type", Array)
], SaveUiTableMasterDto.prototype, "uiTblColumns", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When true, columns not present in uiTblColumns are soft deleted (full replace). When false or omitted, provided columns are only created/updated.',
        default: false,
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUiTableMasterDto.prototype, "replaceColumns", void 0);
//# sourceMappingURL=save-ui-table-master.dto.js.map