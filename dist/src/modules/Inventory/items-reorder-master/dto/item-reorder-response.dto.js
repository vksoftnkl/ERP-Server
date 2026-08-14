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
exports.ItemReorderSuccessDeleteDto = exports.ItemReorderSuccessListDto = exports.ItemReorderSuccessSaveDto = exports.ItemReorderSuccessSingleDto = exports.ItemReorderDeleteResultDto = exports.ItemReorderPayloadDto = exports.ItemReorderListMetaDto = exports.ItemReorderErrorResponseDto = exports.ItemReorderErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemReorderErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemReorderErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
Object.defineProperty(exports, "ItemReorderListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryListMetaDto; } });
class ItemReorderPayloadDto {
    ir_id;
    ir_branch_id;
    ir_item_id;
    ir_unit_id;
    ir_godown_id;
    ir_sl_no;
    ir_min_level;
    ir_max_level;
    ir_reorder_level;
    ir_reorder_qty;
    ir_lead_time_days;
    ir_review_cycle_days;
    ir_reorder_days;
    ir_expiry_buffer_days;
    ir_reorder_type;
    ir_is_active;
    ir_is_deleted;
    ir_remarks;
    ir_created_on;
    ir_created_by;
    ir_modified_on;
    ir_modified_by;
    ir_branch_name;
    ir_unit_name;
    ir_godown_name;
}
exports.ItemReorderPayloadDto = ItemReorderPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemReorderPayloadDto.prototype, "ir_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemReorderPayloadDto.prototype, "ir_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_sl_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_min_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_max_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_reorder_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_reorder_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_lead_time_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_review_cycle_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_reorder_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemReorderPayloadDto.prototype, "ir_expiry_buffer_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'MIN_MAX' }),
    __metadata("design:type", String)
], ItemReorderPayloadDto.prototype, "ir_reorder_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemReorderPayloadDto.prototype, "ir_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemReorderPayloadDto.prototype, "ir_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemReorderPayloadDto.prototype, "ir_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemReorderPayloadDto.prototype, "ir_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked branch (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked unit (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked godown (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemReorderPayloadDto.prototype, "ir_godown_name", void 0);
class ItemReorderDeleteResultDto {
    ir_id;
    deleted;
}
exports.ItemReorderDeleteResultDto = ItemReorderDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemReorderDeleteResultDto.prototype, "ir_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item reorder was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemReorderDeleteResultDto.prototype, "deleted", void 0);
class ItemReorderSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemReorderSuccessSingleDto = ItemReorderSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemReorderSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item reorder fetched successfully' }),
    __metadata("design:type", String)
], ItemReorderSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemReorderPayloadDto }),
    __metadata("design:type", ItemReorderPayloadDto)
], ItemReorderSuccessSingleDto.prototype, "data", void 0);
let ItemReorderSuccessSaveDto = class ItemReorderSuccessSaveDto {
    success;
    message;
    data;
};
exports.ItemReorderSuccessSaveDto = ItemReorderSuccessSaveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemReorderSuccessSaveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item reorder created successfully' }),
    __metadata("design:type", String)
], ItemReorderSuccessSaveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemReorderPayloadDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemReorderPayloadDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemReorderSuccessSaveDto.prototype, "data", void 0);
exports.ItemReorderSuccessSaveDto = ItemReorderSuccessSaveDto = __decorate([
    (0, swagger_1.ApiExtraModels)(ItemReorderPayloadDto)
], ItemReorderSuccessSaveDto);
class ItemReorderSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemReorderSuccessListDto = ItemReorderSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemReorderSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item reorders fetched successfully' }),
    __metadata("design:type", String)
], ItemReorderSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemReorderPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemReorderSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.InventoryListMetaDto }),
    __metadata("design:type", module_response_dto_1.InventoryListMetaDto)
], ItemReorderSuccessListDto.prototype, "meta", void 0);
class ItemReorderSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemReorderSuccessDeleteDto = ItemReorderSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemReorderSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item reorder deleted successfully' }),
    __metadata("design:type", String)
], ItemReorderSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemReorderDeleteResultDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemReorderDeleteResultDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemReorderSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-reorder-response.dto.js.map