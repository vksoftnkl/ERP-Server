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
exports.OpeningStockSuccessDeleteDto = exports.OpeningStockSuccessListDto = exports.OpeningStockSuccessSingleDto = exports.OpeningStockDeleteResultDto = exports.OpeningStockListMetaDto = exports.OpeningStockDocumentPayloadDto = exports.OpeningStockDetailPayloadDto = exports.OpeningStockHeaderPayloadDto = exports.OpeningStockErrorResponseDto = exports.OpeningStockErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class OpeningStockErrorFieldDto {
    field;
    message;
}
exports.OpeningStockErrorFieldDto = OpeningStockErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'avh_voucher_id' }),
    __metadata("design:type", String)
], OpeningStockErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock document not found' }),
    __metadata("design:type", String)
], OpeningStockErrorFieldDto.prototype, "message", void 0);
class OpeningStockErrorResponseDto {
    success;
    message;
    errors;
}
exports.OpeningStockErrorResponseDto = OpeningStockErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], OpeningStockErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], OpeningStockErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockErrorResponseDto.prototype, "errors", void 0);
class OpeningStockHeaderPayloadDto {
    avh_voucher_id;
    avh_voucher_refno;
    avh_voucher_type_id;
    avh_bill_refno;
    avh_user_refno;
    avh_user_name;
    avh_bill_date;
    avh_party_id;
    avh_opposite_ledger_id;
    avh_employee_id;
    avh_pay_notes;
    avh_remarks;
    avh_voucher_status;
    avh_user_id;
    avh_session_id;
    avh_device_type;
    avh_device_id;
    avh_counter_id;
    osh_id;
    osh_acc_year;
    osh_company_id;
    osh_branch_id;
    osh_voucher_no;
    osh_voucher_date;
    osh_ref_no;
    osh_narration;
    osh_total_lines;
    osh_total_qty;
    osh_total_value;
    osh_status;
    osh_user_name;
    osh_user_id;
    osh_session_id;
    osh_device_type;
    osh_device_id;
    osh_counter_id;
    osh_is_active;
    osh_is_deleted;
    osh_created_on;
    osh_created_by;
    osh_updated_on;
    osh_updated_by;
}
exports.OpeningStockHeaderPayloadDto = OpeningStockHeaderPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_voucher_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_voucher_refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockHeaderPayloadDto.prototype, "avh_voucher_type_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_bill_refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_user_refno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_user_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_bill_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_party_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_opposite_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], OpeningStockHeaderPayloadDto.prototype, "avh_employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_pay_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_voucher_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_user_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_session_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_device_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "avh_device_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "avh_counter_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_acc_year", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_voucher_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_voucher_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_ref_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_narration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockHeaderPayloadDto.prototype, "osh_total_lines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockHeaderPayloadDto.prototype, "osh_total_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockHeaderPayloadDto.prototype, "osh_total_value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_user_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_user_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_session_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_device_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_device_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_counter_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], OpeningStockHeaderPayloadDto.prototype, "osh_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], OpeningStockHeaderPayloadDto.prototype, "osh_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockHeaderPayloadDto.prototype, "osh_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_updated_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockHeaderPayloadDto.prototype, "osh_updated_by", void 0);
class OpeningStockDetailPayloadDto {
    osl_id;
    osl_voucher_id;
    osl_opening_id;
    osl_line_no;
    osl_item_id;
    osl_item_code;
    osl_item_name;
    osl_unit_id;
    osl_unit_name;
    osl_base_uom_id;
    osl_base_uom_name;
    osl_godown_id;
    osl_godown_name;
    osl_tracking_type;
    osl_barcode;
    osl_batch_no;
    osl_batch_id;
    osl_batch_date;
    osl_mfg_date;
    osl_expiry_date;
    osl_serial_no;
    osl_qty;
    osl_base_qty;
    osl_free_qty;
    osl_free_base_qty;
    osl_conv_factor;
    osl_tax_id;
    osl_tax_name;
    osl_tax_perc;
    osl_cess_type;
    osl_cess_perc;
    osl_cess_per_unit;
    osl_cost_rate;
    osl_cost_rate_wot;
    osl_stock_value;
    osl_stock_value_wot;
    osl_sale_rate_a;
    osl_sale_rate_b;
    osl_sale_rate_c;
    osl_sale_rate_d;
    osl_sale_rate_a_wot;
    osl_sale_rate_b_wot;
    osl_sale_rate_c_wot;
    osl_sale_rate_d_wot;
    osl_markup_perc_a;
    osl_markup_perc_b;
    osl_markup_perc_c;
    osl_markup_perc_d;
    osl_mrp_rate;
    osl_min_rate;
    osl_remarks;
}
exports.OpeningStockDetailPayloadDto = OpeningStockDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_voucher_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_opening_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_line_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_item_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_item_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_unit_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_base_uom_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_base_uom_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_godown_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_tracking_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_batch_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_batch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_batch_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_mfg_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_expiry_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_serial_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_free_base_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_conv_factor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_tax_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_tax_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_tax_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], OpeningStockDetailPayloadDto.prototype, "osl_cess_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_cess_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_cess_per_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_cost_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_cost_rate_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_stock_value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_stock_value_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_a", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_b", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_c", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_d", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_a_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_b_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_c_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_sale_rate_d_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_markup_perc_a", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_markup_perc_b", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_markup_perc_c", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_markup_perc_d", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_mrp_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], OpeningStockDetailPayloadDto.prototype, "osl_min_rate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], OpeningStockDetailPayloadDto.prototype, "osl_remarks", void 0);
class OpeningStockDocumentPayloadDto {
    header;
    details;
}
exports.OpeningStockDocumentPayloadDto = OpeningStockDocumentPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockHeaderPayloadDto }),
    __metadata("design:type", OpeningStockHeaderPayloadDto)
], OpeningStockDocumentPayloadDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockDocumentPayloadDto.prototype, "details", void 0);
class OpeningStockListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.OpeningStockListMetaDto = OpeningStockListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], OpeningStockListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], OpeningStockListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], OpeningStockListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], OpeningStockListMetaDto.prototype, "total_pages", void 0);
class OpeningStockDeleteResultDto {
    avh_voucher_id;
    deleted;
}
exports.OpeningStockDeleteResultDto = OpeningStockDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], OpeningStockDeleteResultDto.prototype, "avh_voucher_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockDeleteResultDto.prototype, "deleted", void 0);
class OpeningStockSuccessSingleDto {
    success;
    message;
    data;
}
exports.OpeningStockSuccessSingleDto = OpeningStockSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock fetched successfully' }),
    __metadata("design:type", String)
], OpeningStockSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockDocumentPayloadDto }),
    __metadata("design:type", OpeningStockDocumentPayloadDto)
], OpeningStockSuccessSingleDto.prototype, "data", void 0);
class OpeningStockSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.OpeningStockSuccessListDto = OpeningStockSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock documents fetched successfully' }),
    __metadata("design:type", String)
], OpeningStockSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockHeaderPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], OpeningStockSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockListMetaDto }),
    __metadata("design:type", OpeningStockListMetaDto)
], OpeningStockSuccessListDto.prototype, "meta", void 0);
class OpeningStockSuccessDeleteDto {
    success;
    message;
    data;
}
exports.OpeningStockSuccessDeleteDto = OpeningStockSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], OpeningStockSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Opening stock deleted successfully' }),
    __metadata("design:type", String)
], OpeningStockSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: OpeningStockDeleteResultDto }),
    __metadata("design:type", OpeningStockDeleteResultDto)
], OpeningStockSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=opening-stock-response.dto.js.map