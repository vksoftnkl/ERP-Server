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
exports.ItemSuccessDeleteDto = exports.ItemSuccessSingleDto = exports.ItemDeleteResultDto = exports.ItemPayloadDto = exports.ItemErrorResponseDto = exports.ItemErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class ItemPayloadDto {
    item_id;
    item_company_id;
    item_branch_id;
    item_code;
    item_sku;
    item_name_en;
    item_name_ta;
    item_alias;
    item_stock_type;
    item_default_barcode;
    item_group_id;
    item_category_id;
    item_brand_id;
    item_section_id;
    item_company_category_id;
    item_mfgr_id;
    item_supplier_id;
    item_cust_group;
    item_base_unit_id;
    item_is_service;
    item_is_batch_based;
    item_is_expiry_item;
    item_expiry_days;
    item_intimate_before_days;
    item_allow_sales;
    item_allow_sales_return;
    item_allow_purchase;
    item_allow_po;
    item_allow_so;
    item_allow_neg_stock;
    item_allow_negative_so;
    item_price_list;
    item_weigh_scale;
    item_retail_item;
    item_is_kit;
    item_auto_break;
    item_auto_make;
    item_allow_loyalty;
    item_allow_promo;
    item_has_offer;
    item_damagable_product;
    item_is_demand;
    item_allow_loading;
    item_allow_freight;
    item_random_stock;
    item_barcode_sticker;
    item_barcode_sticker_id;
    item_default_tax_id;
    item_hsn_code;
    item_batch_config;
    item_sort_order;
    item_photo;
    item_image_url;
    item_notes;
    item_storage_location;
    item_packing_item_ids;
    item_incl_tax;
    item_is_active;
    item_is_deleted;
    item_created_on;
    item_created_by;
    item_modified_on;
    item_modified_by;
    item_company_name;
    item_branch_name;
    item_group_name;
    item_category_name;
    item_brand_name;
    item_section_name;
    item_supplier_name;
    item_cust_group_name;
    item_base_unit_name;
    item_default_tax_name;
}
exports.ItemPayloadDto = ItemPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPayloadDto.prototype, "item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_sku", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPayloadDto.prototype, "item_name_en", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_name_ta", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_alias", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPayloadDto.prototype, "item_stock_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_default_barcode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPayloadDto.prototype, "item_group_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_category_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_brand_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_section_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_company_category_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_mfgr_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_supplier_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_cust_group", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_base_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_service", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_batch_based", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_expiry_item", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_expiry_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_intimate_before_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_sales", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_sales_return", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_purchase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_po", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_so", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_neg_stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_negative_so", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_price_list", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_weigh_scale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_retail_item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_kit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_auto_break", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_auto_make", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_loyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_promo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_has_offer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_damagable_product", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_demand", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_loading", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_allow_freight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_random_stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_barcode_sticker", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_barcode_sticker_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_default_tax_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_hsn_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemPayloadDto.prototype, "item_batch_config", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Base64-encoded image bytes' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_photo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_image_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_storage_location", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], ItemPayloadDto.prototype, "item_packing_item_ids", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_incl_tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPayloadDto.prototype, "item_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPayloadDto.prototype, "item_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPayloadDto.prototype, "item_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked company (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_company_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked branch (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked item group (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_group_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked category (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_category_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked brand (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_brand_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked section (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_section_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked supplier (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_supplier_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked customer group (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_cust_group_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked base unit (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_base_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked default tax (resolved on the composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPayloadDto.prototype, "item_default_tax_name", void 0);
class ItemDeleteResultDto {
    item_id;
    deleted;
}
exports.ItemDeleteResultDto = ItemDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemDeleteResultDto.prototype, "item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemDeleteResultDto.prototype, "deleted", void 0);
class ItemSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemSuccessSingleDto = ItemSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item fetched successfully' }),
    __metadata("design:type", String)
], ItemSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemPayloadDto }),
    __metadata("design:type", ItemPayloadDto)
], ItemSuccessSingleDto.prototype, "data", void 0);
class ItemSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemSuccessDeleteDto = ItemSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item deleted successfully' }),
    __metadata("design:type", String)
], ItemSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemDeleteResultDto }),
    __metadata("design:type", ItemDeleteResultDto)
], ItemSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-response.dto.js.map