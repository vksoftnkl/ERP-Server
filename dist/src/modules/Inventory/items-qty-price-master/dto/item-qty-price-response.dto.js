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
exports.ItemQtyPriceSuccessDeleteDto = exports.ItemQtyPriceSuccessListDto = exports.ItemQtyPriceSuccessSaveDto = exports.ItemQtyPriceSuccessSingleDto = exports.ItemQtyPriceDeleteResultDto = exports.ItemQtyPricePayloadDto = exports.ItemQtyPriceListMetaDto = exports.ItemQtyPriceErrorResponseDto = exports.ItemQtyPriceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemQtyPriceErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemQtyPriceErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
Object.defineProperty(exports, "ItemQtyPriceListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryListMetaDto; } });
class ItemQtyPricePayloadDto {
    iqp_id;
    iqp_company_id;
    iqp_branch_id;
    iqp_party_id;
    iqp_price_level;
    iqp_item_id;
    iqp_item_unit_id;
    iqp_from_qty;
    iqp_to_qty;
    iqp_price_mode;
    iqp_disc_pct;
    iqp_flat_off;
    iqp_price;
    iqp_is_tax_incl;
    iqp_effective_from;
    iqp_effective_to;
    iqp_is_active;
    iqp_is_deleted;
    iqp_sync_date;
    iqp_created_on;
    iqp_created_by;
    iqp_modified_on;
    iqp_modified_by;
    iqp_item_name;
    iqp_unit_name;
    iqp_company_name;
    iqp_branch_name;
    iqp_price_level_name;
    iqp_party_name;
}
exports.ItemQtyPricePayloadDto = ItemQtyPricePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_party_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 1 }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_price_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_item_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Slab lower bound (inclusive)' }),
    __metadata("design:type", Number)
], ItemQtyPricePayloadDto.prototype, "iqp_from_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 0,
        nullable: true,
        description: 'Slab upper bound (exclusive); null = "& above"',
    }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_to_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 1,
        example: 'P',
        description: 'P = by % | R = by qty (flat off) | F = fixed price',
    }),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_price_mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_disc_pct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_flat_off", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemQtyPricePayloadDto.prototype, "iqp_is_tax_incl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Slab effective-from date (inclusive)' }),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_effective_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_effective_to", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemQtyPricePayloadDto.prototype, "iqp_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemQtyPricePayloadDto.prototype, "iqp_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemQtyPricePayloadDto.prototype, "iqp_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Resolved item_master.item_name_en' }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_item_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Resolved unit name (item_unit_master.unit_name reached via item_unit_conversion)',
    }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Resolved company name' }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_company_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Resolved branch name' }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Resolved price level name' }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_price_level_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Resolved party/customer name' }),
    __metadata("design:type", Object)
], ItemQtyPricePayloadDto.prototype, "iqp_party_name", void 0);
class ItemQtyPriceDeleteResultDto {
    iqp_id;
    deleted;
}
exports.ItemQtyPriceDeleteResultDto = ItemQtyPriceDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemQtyPriceDeleteResultDto.prototype, "iqp_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item qty price was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemQtyPriceDeleteResultDto.prototype, "deleted", void 0);
class ItemQtyPriceSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemQtyPriceSuccessSingleDto = ItemQtyPriceSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemQtyPriceSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item qty price fetched successfully' }),
    __metadata("design:type", String)
], ItemQtyPriceSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemQtyPricePayloadDto }),
    __metadata("design:type", ItemQtyPricePayloadDto)
], ItemQtyPriceSuccessSingleDto.prototype, "data", void 0);
class ItemQtyPriceSuccessSaveDto {
    success;
    message;
    data;
}
exports.ItemQtyPriceSuccessSaveDto = ItemQtyPriceSuccessSaveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemQtyPriceSuccessSaveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item qty prices saved successfully' }),
    __metadata("design:type", String)
], ItemQtyPriceSuccessSaveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemQtyPricePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemQtyPriceSuccessSaveDto.prototype, "data", void 0);
class ItemQtyPriceSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemQtyPriceSuccessListDto = ItemQtyPriceSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemQtyPriceSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item qty prices fetched successfully' }),
    __metadata("design:type", String)
], ItemQtyPriceSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemQtyPricePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemQtyPriceSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.InventoryListMetaDto }),
    __metadata("design:type", module_response_dto_1.InventoryListMetaDto)
], ItemQtyPriceSuccessListDto.prototype, "meta", void 0);
class ItemQtyPriceSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemQtyPriceSuccessDeleteDto = ItemQtyPriceSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemQtyPriceSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item qty price deleted successfully' }),
    __metadata("design:type", String)
], ItemQtyPriceSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemQtyPriceDeleteResultDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemQtyPriceDeleteResultDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemQtyPriceSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-qty-price-response.dto.js.map