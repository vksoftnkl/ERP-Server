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
exports.SaveOpeningStockVoucherDto = exports.SaveOpeningStockVoucherHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const save_stock_voucher_item_dto_1 = require("../../stock-voucher/dto/save-stock-voucher-item.dto");
const save_stock_voucher_dto_1 = require("../../stock-voucher/dto/save-stock-voucher.dto");
class SaveOpeningStockVoucherHeaderDto extends save_stock_voucher_dto_1.SaveStockVoucherHeaderDto {
    voucherType;
}
exports.SaveOpeningStockVoucherHeaderDto = SaveOpeningStockVoucherHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['OPENING'],
        description: 'Optional, and only ever "OPENING". The route decides the type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['OPENING'], {
        message: 'voucherType must be OPENING on this route. Other document types have their own routes because they write tables this one does not.',
    }),
    __metadata("design:type", String)
], SaveOpeningStockVoucherHeaderDto.prototype, "voucherType", void 0);
class SaveOpeningStockVoucherDto {
    header;
    lines;
}
exports.SaveOpeningStockVoucherDto = SaveOpeningStockVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaveOpeningStockVoucherHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveOpeningStockVoucherHeaderDto),
    __metadata("design:type", SaveOpeningStockVoucherHeaderDto)
], SaveOpeningStockVoucherDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: save_stock_voucher_item_dto_1.SaveStockVoucherItemDto,
        isArray: true,
        description: 'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(2000, { message: 'lines may not exceed 2000 rows in one document' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_stock_voucher_item_dto_1.SaveStockVoucherItemDto),
    __metadata("design:type", Array)
], SaveOpeningStockVoucherDto.prototype, "lines", void 0);
//# sourceMappingURL=save-opening-stock-voucher.dto.js.map