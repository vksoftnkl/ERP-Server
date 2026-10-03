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
exports.SaveStockTransferDto = exports.SaveStockTransferHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const save_stock_voucher_item_dto_1 = require("../../stock-voucher/dto/save-stock-voucher-item.dto");
const save_stock_voucher_dto_1 = require("../../stock-voucher/dto/save-stock-voucher.dto");
const MAX_LINES = 500;
class SaveStockTransferHeaderDto extends save_stock_voucher_dto_1.SaveStockVoucherHeaderDto {
    voucherType;
}
exports.SaveStockTransferHeaderDto = SaveStockTransferHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['TRANSFER_OUT'],
        description: 'Optional, and only ever "TRANSFER_OUT". The route decides the type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['TRANSFER_OUT'], {
        message: 'voucherType must be TRANSFER_OUT on this route. A receipt is raised at the destination through /stock/transfer/receive.',
    }),
    __metadata("design:type", String)
], SaveStockTransferHeaderDto.prototype, "voucherType", void 0);
class SaveStockTransferDto {
    header;
    lines;
}
exports.SaveStockTransferDto = SaveStockTransferDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveStockTransferHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveStockTransferHeaderDto),
    __metadata("design:type", SaveStockTransferHeaderDto)
], SaveStockTransferDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: save_stock_voucher_item_dto_1.SaveStockVoucherItemDto,
        isArray: true,
        description: 'A full replace on update. Every line names the lot it moves and the SOURCE godown it moves from.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, {
        message: `lines may not exceed ${MAX_LINES} rows in one document`,
    }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_stock_voucher_item_dto_1.SaveStockVoucherItemDto),
    __metadata("design:type", Array)
], SaveStockTransferDto.prototype, "lines", void 0);
//# sourceMappingURL=save-stock-transfer.dto.js.map