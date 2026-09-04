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
exports.ItemTaxSuccessDeleteDto = exports.ItemTaxSuccessSingleDto = exports.ItemTaxDeleteResultDto = exports.ItemTaxPayloadDto = exports.ItemTaxErrorResponseDto = exports.ItemTaxErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemTaxErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorFieldDto; } });
Object.defineProperty(exports, "ItemTaxErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.InventoryErrorResponseDto; } });
class ItemTaxPayloadDto {
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
    tax_sales_ledger_name;
    tax_sales_return_ledger_id;
    tax_sales_return_ledger_name;
    tax_purchase_ledger_id;
    tax_purchase_ledger_name;
    tax_purchase_return_ledger_id;
    tax_purchase_return_ledger_name;
    tax_cgst_output_ledger_id;
    tax_cgst_output_ledger_name;
    tax_sgst_output_ledger_id;
    tax_sgst_output_ledger_name;
    tax_igst_output_ledger_id;
    tax_igst_output_ledger_name;
    tax_cess_output_ledger_id;
    tax_cess_output_ledger_name;
    tax_cgst_input_ledger_id;
    tax_cgst_input_ledger_name;
    tax_sgst_input_ledger_id;
    tax_sgst_input_ledger_name;
    tax_igst_input_ledger_id;
    tax_igst_input_ledger_name;
    tax_cess_input_ledger_id;
    tax_cess_input_ledger_name;
    tax_is_active;
    tax_is_deleted;
    tax_sync_date;
    tax_created_on;
    tax_created_by;
    tax_modified_on;
    tax_modified_by;
}
exports.ItemTaxPayloadDto = ItemTaxPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], ItemTaxPayloadDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100, example: 'GST 18%' }),
    __metadata("design:type", String)
], ItemTaxPayloadDto.prototype, "tax_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true, example: 'GST18' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, example: 'TAXABLE' }),
    __metadata("design:type", String)
], ItemTaxPayloadDto.prototype, "tax_taxability_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemTaxPayloadDto.prototype, "tax_is_reverse_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_cgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_sgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_igst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_cgst_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_sgst_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_igst_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'NONE' }),
    __metadata("design:type", String)
], ItemTaxPayloadDto.prototype, "tax_cess_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_cess_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_cess_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_cess_pur_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_cess_pur_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18 }),
    __metadata("design:type", Number)
], ItemTaxPayloadDto.prototype, "tax_gst_rate_total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sales_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Sales Account', description: 'Name of the sales ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sales_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sales_return_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Sales Return Account', description: 'Name of the sales return ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sales_return_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_purchase_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Purchase Account', description: 'Name of the purchase ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_purchase_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_purchase_return_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Purchase Return Account', description: 'Name of the purchase return ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_purchase_return_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cgst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'CGST Output', description: 'Name of the CGST output ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cgst_output_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sgst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SGST Output', description: 'Name of the SGST output ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sgst_output_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_igst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'IGST Output', description: 'Name of the IGST output ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_igst_output_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cess_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Cess Output', description: 'Name of the cess output ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cess_output_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cgst_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'CGST Input', description: 'Name of the CGST input ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cgst_input_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sgst_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SGST Input', description: 'Name of the SGST input ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sgst_input_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_igst_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'IGST Input', description: 'Name of the IGST input ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_igst_input_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cess_input_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Cess Input', description: 'Name of the cess input ledger (resolved on the get endpoint)' }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_cess_input_ledger_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemTaxPayloadDto.prototype, "tax_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemTaxPayloadDto.prototype, "tax_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_sync_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemTaxPayloadDto.prototype, "tax_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemTaxPayloadDto.prototype, "tax_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemTaxPayloadDto.prototype, "tax_modified_by", void 0);
class ItemTaxDeleteResultDto {
    tax_id;
    deleted;
}
exports.ItemTaxDeleteResultDto = ItemTaxDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' }),
    __metadata("design:type", String)
], ItemTaxDeleteResultDto.prototype, "tax_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'true when the item tax was soft deleted, false when it was restored',
    }),
    __metadata("design:type", Boolean)
], ItemTaxDeleteResultDto.prototype, "deleted", void 0);
class ItemTaxSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemTaxSuccessSingleDto = ItemTaxSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemTaxSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item tax fetched successfully' }),
    __metadata("design:type", String)
], ItemTaxSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemTaxPayloadDto }),
    __metadata("design:type", ItemTaxPayloadDto)
], ItemTaxSuccessSingleDto.prototype, "data", void 0);
class ItemTaxSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemTaxSuccessDeleteDto = ItemTaxSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemTaxSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item tax deleted successfully' }),
    __metadata("design:type", String)
], ItemTaxSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemTaxDeleteResultDto }),
    __metadata("design:type", ItemTaxDeleteResultDto)
], ItemTaxSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-tax-response.dto.js.map