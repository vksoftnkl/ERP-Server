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
exports.ItemPriceSuccessDeleteDto = exports.ItemPriceSuccessListDto = exports.ItemPriceSuccessSaveDto = exports.ItemPriceSuccessSingleDto = exports.ItemPriceDeleteResultDto = exports.ItemPricePayloadDto = exports.ItemPriceListMetaDto = exports.ItemPriceErrorResponseDto = exports.ItemPriceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemPriceErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemPriceErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
Object.defineProperty(exports, "ItemPriceListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryListMetaDto; } });
class ItemPricePayloadDto {
    ipm_id;
    ipm_company_id;
    ipm_branch_id;
    ipm_item_id;
    ipm_uc_unit_id;
    ipm_godown_id;
    ipm_sl_no;
    ipm_cost_price;
    ipm_cost_wot;
    ipm_sales_price_a;
    ipm_sales_price_b;
    ipm_sales_price_c;
    ipm_sales_price_d;
    ipm_price_a_wot;
    ipm_price_b_wot;
    ipm_price_c_wot;
    ipm_price_d_wot;
    ipm_price_a_markup_perc;
    ipm_price_b_markup_perc;
    ipm_price_c_markup_perc;
    ipm_price_d_markup_perc;
    ipm_max_price;
    ipm_min_price;
    ipm_disc_perc;
    ipm_disc_qty;
    ipm_addl_cess;
    ipm_profit_type;
    ipm_round_off;
    ipm_loading_charge;
    ipm_freight_charge;
    ipm_loyalty_points;
    ipm_uom_remarks;
    ipm_cost_remarks;
    ipm_is_active;
    ipm_is_deleted;
    ipm_sync_date;
    ipm_created_on;
    ipm_created_by;
    ipm_updated_on;
    ipm_updated_by;
    ipm_company_name;
    ipm_branch_name;
    ipm_unit_name;
    ipm_godown_name;
}
exports.ItemPricePayloadDto = ItemPricePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPricePayloadDto.prototype, "ipm_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPricePayloadDto.prototype, "ipm_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Item unit conversion id (iuc_id) this price applies to' }),
    __metadata("design:type", String)
], ItemPricePayloadDto.prototype, "ipm_uc_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_sl_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_cost_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_cost_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_sales_price_a", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_sales_price_b", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_sales_price_c", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_sales_price_d", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_a_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_b_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_c_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_d_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_a_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_b_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_c_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_price_d_markup_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_max_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_min_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_addl_cess", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'MANUAL' }),
    __metadata("design:type", String)
], ItemPricePayloadDto.prototype, "ipm_profit_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_round_off", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_loading_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_freight_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPricePayloadDto.prototype, "ipm_loyalty_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_uom_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_cost_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPricePayloadDto.prototype, "ipm_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemPricePayloadDto.prototype, "ipm_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPricePayloadDto.prototype, "ipm_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, example: null }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_updated_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked company (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_company_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked branch (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked unit (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the linked godown (resolved on the item composite get endpoint)' }),
    __metadata("design:type", Object)
], ItemPricePayloadDto.prototype, "ipm_godown_name", void 0);
class ItemPriceDeleteResultDto {
    ipm_id;
    deleted;
}
exports.ItemPriceDeleteResultDto = ItemPriceDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPriceDeleteResultDto.prototype, "ipm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item price was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemPriceDeleteResultDto.prototype, "deleted", void 0);
class ItemPriceSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemPriceSuccessSingleDto = ItemPriceSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item price fetched successfully' }),
    __metadata("design:type", String)
], ItemPriceSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemPricePayloadDto }),
    __metadata("design:type", ItemPricePayloadDto)
], ItemPriceSuccessSingleDto.prototype, "data", void 0);
let ItemPriceSuccessSaveDto = class ItemPriceSuccessSaveDto {
    success;
    message;
    data;
};
exports.ItemPriceSuccessSaveDto = ItemPriceSuccessSaveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceSuccessSaveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item price created successfully' }),
    __metadata("design:type", String)
], ItemPriceSuccessSaveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemPricePayloadDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemPricePayloadDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemPriceSuccessSaveDto.prototype, "data", void 0);
exports.ItemPriceSuccessSaveDto = ItemPriceSuccessSaveDto = __decorate([
    (0, swagger_1.ApiExtraModels)(ItemPricePayloadDto, ItemPriceDeleteResultDto)
], ItemPriceSuccessSaveDto);
let ItemPriceSuccessListDto = class ItemPriceSuccessListDto {
    success;
    message;
    data;
    meta;
};
exports.ItemPriceSuccessListDto = ItemPriceSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item prices fetched successfully' }),
    __metadata("design:type", String)
], ItemPriceSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ItemPricePayloadDto] }),
    __metadata("design:type", Array)
], ItemPriceSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.InventoryListMetaDto }),
    __metadata("design:type", module_response_dto_1.InventoryListMetaDto)
], ItemPriceSuccessListDto.prototype, "meta", void 0);
exports.ItemPriceSuccessListDto = ItemPriceSuccessListDto = __decorate([
    (0, swagger_1.ApiExtraModels)(ItemPricePayloadDto)
], ItemPriceSuccessListDto);
class ItemPriceSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemPriceSuccessDeleteDto = ItemPriceSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item price deleted successfully' }),
    __metadata("design:type", String)
], ItemPriceSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { $ref: (0, swagger_1.getSchemaPath)(ItemPriceDeleteResultDto) },
            {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(ItemPriceDeleteResultDto) },
            },
        ],
    }),
    __metadata("design:type", Object)
], ItemPriceSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-price-response.dto.js.map