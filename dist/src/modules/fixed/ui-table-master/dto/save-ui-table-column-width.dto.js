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
exports.SaveUiTableColumnWidthDto = exports.UiTableColumnWidthItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class UiTableColumnWidthItemDto {
    uiTblClmId;
    uiTblClmColumnWidth;
}
exports.UiTableColumnWidthItemDto = UiTableColumnWidthItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, description: 'UI table column id to update' }),
    (0, class_transformer_1.Transform)(({ value }) => (value != null ? String(value).trim() : value)),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumberString)({ no_symbols: true }),
    __metadata("design:type", String)
], UiTableColumnWidthItemDto.prototype, "uiTblClmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], UiTableColumnWidthItemDto.prototype, "uiTblClmColumnWidth", void 0);
class SaveUiTableColumnWidthDto {
    columns;
}
exports.SaveUiTableColumnWidthDto = SaveUiTableColumnWidthDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UiTableColumnWidthItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UiTableColumnWidthItemDto),
    __metadata("design:type", Array)
], SaveUiTableColumnWidthDto.prototype, "columns", void 0);
//# sourceMappingURL=save-ui-table-column-width.dto.js.map