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
exports.ItemPriceDetailSuccessSingleDto = exports.ItemPriceDetailPayloadDto = exports.ItemPriceDetailTaxPayloadDto = exports.ItemPriceDetailErrorResponseDto = exports.ItemPriceDetailErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const item_response_dto_1 = require("../../items-master/dto/item-response.dto");
const item_price_response_dto_1 = require("../../items-price-master/dto/item-price-response.dto");
const item_unit_conversion_response_dto_1 = require("../../item-unit-conversion/dto/item-unit-conversion-response.dto");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemPriceDetailErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemPriceDetailErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
const NO_LEDGER = 'Always null: a tax rate carries no ledger columns. A role resolves through accounts.acc_ledger_map, overridden per rate by inventory.tax_rate_ledger (GET /tax-rates/resolve).';
class ItemPriceDetailTaxPayloadDto {
    tax_id;
    tax_name;
    tax_code;
    tax_taxability_type;
    tax_is_reverse_charge;
    tax_cgst_perc;
    tax_sgst_perc;
    tax_igst_perc;
    tax_cgst_pur_perc;
    tax_sgst_pur_perc;
    tax_igst_pur_perc;
    tax_cess_type;
    tax_cess_perc;
    tax_cess_unit;
    tax_cess_pur_perc;
    tax_cess_pur_unit;
    tax_gst_rate_total;
    tax_sales_ledger_id;
    tax_sales_return_ledger_id;
    tax_purchase_ledger_id;
    tax_purchase_return_ledger_id;
    tax_cgst_output_ledger_id;
    tax_sgst_output_ledger_id;
    tax_igst_output_ledger_id;
    tax_cess_output_ledger_id;
    tax_cgst_input_ledger_id;
    tax_sgst_input_ledger_id;
    tax_igst_input_ledger_id;
    tax_cess_input_ledger_id;
    tax_is_active;
    tax_is_deleted;
    tax_sync_date;
    tax_created_on;
    tax_created_by;
    tax_modified_on;
    tax_modified_by;
}
exports.ItemPriceDetailTaxPayloadDto = ItemPriceDetailTaxPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100, example: 'GST 18%' }),
    __metadata("design:type", String)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true, example: 'GST18' }),
    __metadata("design:type", Object)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'TAXABLE',
        description: 'tax_taxability: TAXABLE | EXEMPT | NIL_RATED | NON_GST | ZERO_RATED',
    }),
    __metadata("design:type", String)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_taxability_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_is_reverse_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9, description: 'Generated from tax_rate_perc (half of it).' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9, description: 'Generated from tax_rate_perc (half of it).' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18, description: 'Generated from tax_rate_perc (all of it).' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_igst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 9,
        description: 'Same as tax_cgst_perc — a rate has one percentage for sales and purchase.',
    }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cgst_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9, description: 'Same as tax_sgst_perc.' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sgst_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18, description: 'Same as tax_igst_perc.' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_igst_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'NONE',
        enum: ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'],
        description: 'tax_cess_basis. The old item_tax_master said UNIT where this says PER_UNIT, and had no BOTH (a percentage AND a per-unit amount).',
    }),
    __metadata("design:type", String)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Non-zero only when the basis is PERCENT or BOTH.' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'tax_cess_per_unit — non-zero only when the basis is PER_UNIT or BOTH.',
    }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Same as tax_cess_perc — one cess for both sides.' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Same as tax_cess_unit.' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_pur_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18, description: 'tax_rate_perc — the total GST rate.' }),
    __metadata("design:type", Number)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_gst_rate_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sales_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sales_return_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_purchase_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_purchase_return_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cgst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sgst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_igst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cgst_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sgst_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_igst_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'uuid', nullable: true, description: NO_LEDGER }),
    __metadata("design:type", void 0)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_cess_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Null on a rate never edited.' }),
    __metadata("design:type", Object)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceDetailTaxPayloadDto.prototype, "tax_modified_by", void 0);
class ItemPriceDetailPayloadDto {
    item;
    item_prices;
    item_unit_conversions;
    item_tax;
}
exports.ItemPriceDetailPayloadDto = ItemPriceDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_response_dto_1.ItemPayloadDto }),
    __metadata("design:type", item_response_dto_1.ItemPayloadDto)
], ItemPriceDetailPayloadDto.prototype, "item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: item_price_response_dto_1.ItemPricePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemPriceDetailPayloadDto.prototype, "item_prices", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: item_unit_conversion_response_dto_1.ItemUnitConversionPayloadDto,
        isArray: true,
        description: "The item's live unit conversions; each price row points at one through ipm_uc_unit_id and carries none of its shape",
    }),
    __metadata("design:type", Array)
], ItemPriceDetailPayloadDto.prototype, "item_unit_conversions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemPriceDetailTaxPayloadDto, nullable: true }),
    __metadata("design:type", Object)
], ItemPriceDetailPayloadDto.prototype, "item_tax", void 0);
let ItemPriceDetailSuccessSingleDto = class ItemPriceDetailSuccessSingleDto {
    success;
    message;
    data;
};
exports.ItemPriceDetailSuccessSingleDto = ItemPriceDetailSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceDetailSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item price details fetched successfully' }),
    __metadata("design:type", String)
], ItemPriceDetailSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemPriceDetailPayloadDto }),
    __metadata("design:type", ItemPriceDetailPayloadDto)
], ItemPriceDetailSuccessSingleDto.prototype, "data", void 0);
exports.ItemPriceDetailSuccessSingleDto = ItemPriceDetailSuccessSingleDto = __decorate([
    (0, swagger_1.ApiExtraModels)(item_response_dto_1.ItemPayloadDto, item_price_response_dto_1.ItemPricePayloadDto, item_unit_conversion_response_dto_1.ItemUnitConversionPayloadDto, ItemPriceDetailTaxPayloadDto)
], ItemPriceDetailSuccessSingleDto);
//# sourceMappingURL=item-price-detail-response.dto.js.map