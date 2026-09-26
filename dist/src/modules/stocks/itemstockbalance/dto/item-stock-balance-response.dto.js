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
exports.ItemBatchStockOptionSuccessListDto = exports.ItemBatchStockOptionPayloadDto = exports.ItemStockBalanceSuccessListDto = exports.ItemStockBalancePayloadDto = exports.ItemStockBalanceErrorResponseDto = exports.ItemStockBalanceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ItemStockBalanceErrorFieldDto {
    field;
    message;
}
exports.ItemStockBalanceErrorFieldDto = ItemStockBalanceErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'isb_item_id' }),
    __metadata("design:type", String)
], ItemStockBalanceErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item stock balance not found' }),
    __metadata("design:type", String)
], ItemStockBalanceErrorFieldDto.prototype, "message", void 0);
class ItemStockBalanceErrorResponseDto {
    success;
    message;
    errors;
}
exports.ItemStockBalanceErrorResponseDto = ItemStockBalanceErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemStockBalanceErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ItemStockBalanceErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemStockBalanceErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ItemStockBalanceErrorResponseDto.prototype, "errors", void 0);
class ItemStockBalancePayloadDto {
    isb_id;
    isb_acc_year;
    isb_company_id;
    isb_branch_id;
    isb_godown_id;
    isb_item_id;
    isb_unit_id;
    isb_tracking_type;
    isb_stock_bucket;
    isb_opening_qty;
    isb_in_qty;
    isb_out_qty;
    isb_closing_qty;
    isb_opening_free_qty;
    isb_free_in_qty;
    isb_free_out_qty;
    isb_free_closing_qty;
    isb_reserved_qty;
    isb_transit_qty;
    isb_available_qty;
    book_qty;
    book_base_qty;
    isb_opening_avg_rate;
    isb_avg_stock_rate;
    isb_opening_value;
    isb_stock_value;
    isb_opening_avg_rate_wot;
    isb_avg_stock_rate_wot;
    isb_opening_value_wot;
    isb_stock_value_wot;
    isb_last_in_date;
    isb_last_out_date;
    isb_sync_date;
    isb_created_on;
    isb_created_by;
    isb_updated_on;
    isb_updated_by;
}
exports.ItemStockBalancePayloadDto = ItemStockBalancePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_acc_year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_tracking_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_stock_bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_opening_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_in_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_out_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_closing_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_opening_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_free_in_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_free_out_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_free_closing_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_reserved_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_transit_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_available_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "book_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "book_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_opening_avg_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_avg_stock_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_opening_value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_stock_value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_opening_avg_rate_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_avg_stock_rate_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_opening_value_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemStockBalancePayloadDto.prototype, "isb_stock_value_wot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemStockBalancePayloadDto.prototype, "isb_last_in_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemStockBalancePayloadDto.prototype, "isb_last_out_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemStockBalancePayloadDto.prototype, "isb_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemStockBalancePayloadDto.prototype, "isb_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ItemStockBalancePayloadDto.prototype, "isb_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemStockBalancePayloadDto.prototype, "isb_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ItemStockBalancePayloadDto.prototype, "isb_updated_by", void 0);
class ItemStockBalanceSuccessListDto {
    success;
    message;
    data;
}
exports.ItemStockBalanceSuccessListDto = ItemStockBalanceSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemStockBalanceSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item stock balance fetched successfully' }),
    __metadata("design:type", String)
], ItemStockBalanceSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemStockBalancePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemStockBalanceSuccessListDto.prototype, "data", void 0);
class ItemBatchStockOptionPayloadDto {
    ibs_id;
    ibs_acc_year;
    ibs_company_id;
    ibs_branch_id;
    ibs_godown_id;
    ibs_item_id;
    ibs_unit_id;
    ibs_batch_id;
    ibs_batch_no;
    ibs_mfg_batch_no;
    ibs_batch_date;
    ibs_mfg_date;
    ibs_expiry_date;
    ibs_mrp;
    ibs_barcode;
    ibs_serial_no;
    ibs_stock_bucket;
    ibs_closing_qty;
    ibs_free_closing_qty;
    book_qty;
    book_base_qty;
    book_free_qty;
    book_free_base_qty;
    ibs_avg_stock_rate;
    ibs_avg_stock_rate_wot;
}
exports.ItemBatchStockOptionPayloadDto = ItemBatchStockOptionPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_acc_year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_batch_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_mfg_batch_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_batch_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_mfg_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_expiry_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_serial_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_stock_bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_closing_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_free_closing_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "book_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "book_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "book_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "book_free_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_avg_stock_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockOptionPayloadDto.prototype, "ibs_avg_stock_rate_wot", void 0);
class ItemBatchStockOptionSuccessListDto {
    success;
    message;
    data;
}
exports.ItemBatchStockOptionSuccessListDto = ItemBatchStockOptionSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemBatchStockOptionSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item batch stock options fetched successfully' }),
    __metadata("design:type", String)
], ItemBatchStockOptionSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBatchStockOptionPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemBatchStockOptionSuccessListDto.prototype, "data", void 0);
//# sourceMappingURL=item-stock-balance-response.dto.js.map