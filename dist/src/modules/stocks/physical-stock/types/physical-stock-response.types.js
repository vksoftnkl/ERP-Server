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
exports.PhysicalStockSuccessDeleteDto = exports.PhysicalStockSuccessSingleDto = exports.PhysicalStockDeleteResponseDto = exports.PhysicalStockDocumentResponseDto = exports.PhysicalStockDetailResponseDto = exports.PhysicalStockBatchDetailResponseDto = exports.PhysicalStockHeaderResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PhysicalStockHeaderResponseDto {
    psc_id;
    psc_refno;
    psc_date;
}
exports.PhysicalStockHeaderResponseDto = PhysicalStockHeaderResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11' }),
    __metadata("design:type", String)
], PhysicalStockHeaderResponseDto.prototype, "psc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PHY-STK-1001' }),
    __metadata("design:type", String)
], PhysicalStockHeaderResponseDto.prototype, "psc_refno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-07' }),
    __metadata("design:type", String)
], PhysicalStockHeaderResponseDto.prototype, "psc_date", void 0);
class PhysicalStockBatchDetailResponseDto {
    psb_id;
    psb_psd_id;
    psb_row_no;
}
exports.PhysicalStockBatchDetailResponseDto = PhysicalStockBatchDetailResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a12' }),
    __metadata("design:type", String)
], PhysicalStockBatchDetailResponseDto.prototype, "psb_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a13' }),
    __metadata("design:type", String)
], PhysicalStockBatchDetailResponseDto.prototype, "psb_psd_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PhysicalStockBatchDetailResponseDto.prototype, "psb_row_no", void 0);
class PhysicalStockDetailResponseDto {
    psd_id;
    psd_psc_id;
    psd_row_no;
    batch_details;
}
exports.PhysicalStockDetailResponseDto = PhysicalStockDetailResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a13' }),
    __metadata("design:type", String)
], PhysicalStockDetailResponseDto.prototype, "psd_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11' }),
    __metadata("design:type", String)
], PhysicalStockDetailResponseDto.prototype, "psd_psc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PhysicalStockDetailResponseDto.prototype, "psd_row_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockBatchDetailResponseDto, isArray: true }),
    __metadata("design:type", Array)
], PhysicalStockDetailResponseDto.prototype, "batch_details", void 0);
class PhysicalStockDocumentResponseDto {
    header;
    details;
}
exports.PhysicalStockDocumentResponseDto = PhysicalStockDocumentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockHeaderResponseDto }),
    __metadata("design:type", Object)
], PhysicalStockDocumentResponseDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockDetailResponseDto, isArray: true }),
    __metadata("design:type", Array)
], PhysicalStockDocumentResponseDto.prototype, "details", void 0);
class PhysicalStockDeleteResponseDto {
    ps_id;
    deleted;
}
exports.PhysicalStockDeleteResponseDto = PhysicalStockDeleteResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11' }),
    __metadata("design:type", String)
], PhysicalStockDeleteResponseDto.prototype, "ps_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockDeleteResponseDto.prototype, "deleted", void 0);
class PhysicalStockSuccessSingleDto {
    success;
    message;
    data;
}
exports.PhysicalStockSuccessSingleDto = PhysicalStockSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock fetched successfully' }),
    __metadata("design:type", String)
], PhysicalStockSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockDocumentResponseDto }),
    __metadata("design:type", Object)
], PhysicalStockSuccessSingleDto.prototype, "data", void 0);
class PhysicalStockSuccessDeleteDto {
    success;
    message;
    data;
}
exports.PhysicalStockSuccessDeleteDto = PhysicalStockSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PhysicalStockSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical stock deleted successfully' }),
    __metadata("design:type", String)
], PhysicalStockSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PhysicalStockDeleteResponseDto }),
    __metadata("design:type", Object)
], PhysicalStockSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=physical-stock-response.types.js.map