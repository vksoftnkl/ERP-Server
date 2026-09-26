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
exports.ItemBatchStockSuccessListDto = exports.ItemBatchStockPayloadDto = exports.ItemBatchStockErrorResponseDto = exports.ItemBatchStockErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class ItemBatchStockErrorFieldDto {
    field;
    message;
}
exports.ItemBatchStockErrorFieldDto = ItemBatchStockErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ibs_item_id' }),
    __metadata("design:type", String)
], ItemBatchStockErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item batch stock not found' }),
    __metadata("design:type", String)
], ItemBatchStockErrorFieldDto.prototype, "message", void 0);
class ItemBatchStockErrorResponseDto {
    success;
    message;
    errors;
}
exports.ItemBatchStockErrorResponseDto = ItemBatchStockErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemBatchStockErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ItemBatchStockErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBatchStockErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ItemBatchStockErrorResponseDto.prototype, "errors", void 0);
class ItemBatchStockPayloadDto {
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
    ibs_serial_no;
    ibs_mfg_date;
    ibs_expiry_date;
    ibs_mrp;
    ibs_barcode;
    ibs_stock_bucket;
    ibs_opening_qty;
    ibs_in_qty;
    ibs_out_qty;
    ibs_closing_qty;
    ibs_opening_free_qty;
    ibs_free_in_qty;
    ibs_free_out_qty;
    ibs_free_closing_qty;
    ibs_reserved_qty;
    ibs_available_qty;
    book_qty;
    book_base_qty;
    book_free_qty;
    book_free_base_qty;
    book_reserved_qty;
    book_reserved_base_qty;
    book_available_qty;
    book_available_base_qty;
    ibs_opening_avg_rate;
    ibs_avg_stock_rate;
    ibs_opening_value;
    ibs_stock_value;
    ibs_last_in_date;
    ibs_last_out_date;
    ibs_is_active;
    ibs_is_deleted;
    ibs_row_version;
    ibs_created_on;
    ibs_created_by;
    ibs_updated_on;
    ibs_updated_by;
}
exports.ItemBatchStockPayloadDto = ItemBatchStockPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_acc_year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_batch_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_mfg_batch_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_batch_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_serial_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_mfg_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_expiry_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_barcode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_stock_bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_opening_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_in_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_out_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_closing_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_opening_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_free_in_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_free_out_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_free_closing_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_reserved_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_available_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_free_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_reserved_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_reserved_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_available_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "book_available_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_opening_avg_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_avg_stock_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_opening_value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ItemBatchStockPayloadDto.prototype, "ibs_stock_value", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_last_in_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_last_out_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemBatchStockPayloadDto.prototype, "ibs_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemBatchStockPayloadDto.prototype, "ibs_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'BigInt row version serialized as string' }),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_row_version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemBatchStockPayloadDto.prototype, "ibs_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], ItemBatchStockPayloadDto.prototype, "ibs_updated_by", void 0);
class ItemBatchStockSuccessListDto {
    success;
    message;
    data;
}
exports.ItemBatchStockSuccessListDto = ItemBatchStockSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemBatchStockSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item batch stock fetched successfully' }),
    __metadata("design:type", String)
], ItemBatchStockSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemBatchStockPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemBatchStockSuccessListDto.prototype, "data", void 0);
//# sourceMappingURL=item-batch-stock-response.dto.js.map