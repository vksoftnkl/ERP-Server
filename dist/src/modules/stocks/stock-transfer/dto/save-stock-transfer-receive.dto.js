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
exports.SaveStockTransferReceiveDto = exports.SaveStockTransferReceiveHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_stock_voucher_item_dto_1 = require("../../stock-voucher/dto/save-stock-voucher-item.dto");
const save_stock_voucher_dto_1 = require("../../stock-voucher/dto/save-stock-voucher.dto");
const MAX_LINES = 500;
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class SaveStockTransferReceiveHeaderDto extends save_stock_voucher_dto_1.SaveStockVoucherHeaderDto {
    voucherType;
}
exports.SaveStockTransferReceiveHeaderDto = SaveStockTransferReceiveHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['TRANSFER_IN'],
        description: 'Optional, and only ever "TRANSFER_IN". The route decides the type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['TRANSFER_IN'], {
        message: 'voucherType must be TRANSFER_IN on this route. A despatch is raised at the sending branch through /stock/transfer.',
    }),
    __metadata("design:type", String)
], SaveStockTransferReceiveHeaderDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The TRANSFER_OUT this receipt is against. Required — ck_svh_transfer_in_link, and the engine refuses a receipt that links nothing.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockTransferReceiveHeaderDto.prototype, "linkSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        minLength: 9,
        maxLength: 9,
        description: "The DESPATCH's accounting year, which is not always the receipt's: a lorry that leaves on 29 March arrives in the next year. stock_transit carries both halves' years separately for exactly this reason.",
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'linkSrcAccYear must be YYYY-YYYY, e.g. 2026-2027' }),
    __metadata("design:type", String)
], SaveStockTransferReceiveHeaderDto.prototype, "linkSrcAccYear", void 0);
class SaveStockTransferReceiveDto {
    header;
    lines;
}
exports.SaveStockTransferReceiveDto = SaveStockTransferReceiveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveStockTransferReceiveHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveStockTransferReceiveHeaderDto),
    __metadata("design:type", SaveStockTransferReceiveHeaderDto)
], SaveStockTransferReceiveDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: save_stock_voucher_item_dto_1.SaveStockVoucherItemDto,
        isArray: true,
        description: 'One line per transit row actually received. godownId is the DESTINATION here. What never arrived gets no line at all.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, {
        message: `lines may not exceed ${MAX_LINES} rows in one document`,
    }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_stock_voucher_item_dto_1.SaveStockVoucherItemDto),
    __metadata("design:type", Array)
], SaveStockTransferReceiveDto.prototype, "lines", void 0);
//# sourceMappingURL=save-stock-transfer-receive.dto.js.map