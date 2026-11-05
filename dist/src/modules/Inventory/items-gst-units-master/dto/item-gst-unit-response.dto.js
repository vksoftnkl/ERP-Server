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
exports.ItemGstUnitSuccessListDto = exports.ItemGstUnitPayloadDto = exports.ItemGstUnitErrorResponseDto = exports.ItemGstUnitErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemGstUnitErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemGstUnitErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class ItemGstUnitPayloadDto {
    item_gst_unit_id;
    item_gst_unit_code;
    item_gst_unit_name;
    item_gst_unit_created_on;
    item_gst_unit_created_by;
    item_gst_unit_modified_on;
    item_gst_unit_modified_by;
    item_gst_unit_sync_date;
}
exports.ItemGstUnitPayloadDto = ItemGstUnitPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'NOS' }),
    __metadata("design:type", Object)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Numbers' }),
    __metadata("design:type", Object)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ItemGstUnitPayloadDto.prototype, "item_gst_unit_sync_date", void 0);
class ItemGstUnitSuccessListDto {
    success;
    message;
    data;
}
exports.ItemGstUnitSuccessListDto = ItemGstUnitSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemGstUnitSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item GST units fetched successfully' }),
    __metadata("design:type", String)
], ItemGstUnitSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemGstUnitPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemGstUnitSuccessListDto.prototype, "data", void 0);
//# sourceMappingURL=item-gst-unit-response.dto.js.map