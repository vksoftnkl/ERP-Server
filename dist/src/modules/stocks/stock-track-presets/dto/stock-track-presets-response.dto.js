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
exports.StockTrackPresetsSuccessGetDto = exports.StockTrackPresetsGetMetaDto = exports.StockTrackPresetsPayloadDto = exports.StockTrackPresetsErrorResponseDto = exports.StockTrackPresetsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class StockTrackPresetsErrorFieldDto {
    field;
    message;
}
exports.StockTrackPresetsErrorFieldDto = StockTrackPresetsErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockTrackPresetsErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockTrackPresetsErrorFieldDto.prototype, "message", void 0);
class StockTrackPresetsErrorResponseDto {
    success;
    message;
    errors;
}
exports.StockTrackPresetsErrorResponseDto = StockTrackPresetsErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockTrackPresetsErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], StockTrackPresetsErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTrackPresetsErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], StockTrackPresetsErrorResponseDto.prototype, "errors", void 0);
class StockTrackPresetsPayloadDto {
    spt_id;
    spt_company_id;
    spt_code;
    spt_name;
    spt_description;
    spt_track_batch;
    spt_track_mrp;
    spt_track_sale_price;
    spt_track_expiry;
    spt_track_serial;
    spt_track_supplier;
    spt_track_signature;
    spt_valuation_method;
    spt_issue_strategy;
    spt_allow_negative;
    spt_shelf_life_days;
    spt_near_expiry_days;
    spt_block_expired_sale;
    spt_ageing_basis;
    spt_sort_order;
    spt_remarks;
    spt_is_company_override;
}
exports.StockTrackPresetsPayloadDto = StockTrackPresetsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01930000-0000-7000-0000-000000000001' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: null,
        description: 'null = shared with every company',
    }),
    __metadata("design:type", Object)
], StockTrackPresetsPayloadDto.prototype, "spt_company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PHARMA' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Pharma (batch + expiry + MRP + supplier)' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTrackPresetsPayloadDto.prototype, "spt_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_track_batch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_track_mrp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_track_sale_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_track_expiry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_track_serial", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_track_supplier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'BMEP',
        description: "B/M/S/E/R/P in that order, 'N' when nothing is tracked. Compare with stp_track_signature to tell which preset a saved policy matches.",
    }),
    __metadata("design:type", Object)
], StockTrackPresetsPayloadDto.prototype, "spt_track_signature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'WAVG' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_valuation_method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'FEFO' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_issue_strategy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ALLOW' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_allow_negative", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], StockTrackPresetsPayloadDto.prototype, "spt_shelf_life_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 90 }),
    __metadata("design:type", Number)
], StockTrackPresetsPayloadDto.prototype, "spt_near_expiry_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_block_expired_sale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'INWARD_DATE' }),
    __metadata("design:type", String)
], StockTrackPresetsPayloadDto.prototype, "spt_ageing_basis", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 70 }),
    __metadata("design:type", Number)
], StockTrackPresetsPayloadDto.prototype, "spt_sort_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTrackPresetsPayloadDto.prototype, "spt_remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'true when this row overrides a shared preset of the same code',
    }),
    __metadata("design:type", Boolean)
], StockTrackPresetsPayloadDto.prototype, "spt_is_company_override", void 0);
class StockTrackPresetsGetMetaDto {
    company_id;
    spt_id;
    spt_code;
    count;
}
exports.StockTrackPresetsGetMetaDto = StockTrackPresetsGetMetaDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StockTrackPresetsGetMetaDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], StockTrackPresetsGetMetaDto.prototype, "spt_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'PHARMA' }),
    __metadata("design:type", String)
], StockTrackPresetsGetMetaDto.prototype, "spt_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 8 }),
    __metadata("design:type", Number)
], StockTrackPresetsGetMetaDto.prototype, "count", void 0);
class StockTrackPresetsSuccessGetDto {
    success;
    message;
    data;
    meta;
}
exports.StockTrackPresetsSuccessGetDto = StockTrackPresetsSuccessGetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockTrackPresetsSuccessGetDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock track presets fetched successfully' }),
    __metadata("design:type", String)
], StockTrackPresetsSuccessGetDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTrackPresetsPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], StockTrackPresetsSuccessGetDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockTrackPresetsGetMetaDto }),
    __metadata("design:type", StockTrackPresetsGetMetaDto)
], StockTrackPresetsSuccessGetDto.prototype, "meta", void 0);
//# sourceMappingURL=stock-track-presets-response.dto.js.map