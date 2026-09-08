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
exports.SavePhysicalStockVoucherDto = exports.SavePhysicalStockVoucherHeaderDto = exports.SavePhysicalStockVoucherItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_stock_voucher_dto_1 = require("../../stock-voucher/dto/save-stock-voucher.dto");
const stock_voucher_types_1 = require("../../stock-voucher/types/stock-voucher.types");
const MAX_LINES = 2000;
class SavePhysicalStockVoucherItemDto {
    lineNo;
    splitNo;
    itemId;
    godownId;
    bucket;
    lotId;
    countedQty;
    reasonId;
    remarks;
}
exports.SavePhysicalStockVoucherItemDto = SavePhysicalStockVoucherItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 1,
        description: 'Position on the sheet, 1-based. Assigned by GET /stock/physical/count-sheet.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SavePhysicalStockVoucherItemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        default: 1,
        description: 'Always 1 on a generated sheet: one line already means one holding.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SavePhysicalStockVoucherItemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.item_master.item_id, from the count sheet.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'inventory.godown_locations.gdl_id. Must equal the godown the header names — a count is per godown.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        default: 'SALEABLE',
        description: 'Part of the holding key, from the count sheet.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
        message: `bucket must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'stock.stock_lot.slt_id — THE HOLDING THIS LINE IS ABOUT, taken verbatim from the count sheet.\n\n' +
            'Required, and the one place a count breaks the rule that the engine owns lot identity: the lot is WHERE THE BOOK FIGURE CAME FROM. A count line is generated from a stock_balance row, which is keyed by sbl_lot_id, and fn_svh_post uses it as given rather than resolving a new one. A lot with no live balance row in this godown is a 422 telling you to regenerate the sheet — which is also what happens when someone sells the last of a lot mid-count.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePhysicalStockVoucherItemDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        minimum: 0,
        description: 'WHAT WAS FOUND ON THE SHELF — the one number the operator types.\n\n' +
            'A magnitude: only the derived svi_diff_qty (counted − book, GENERATED) is signed. Send 0 to record that nothing was found.\n\n' +
            'ABSENT IS NOT "0 FOUND", IT IS NOT COUNTED YET, and it is refused with a 422 naming the line. Declared optional here rather than required so that refusal carries that sentence instead of a bare field error: posting an uncounted line as a total shortage is the single most expensive mistake this screen can make.',
    }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherItemDto.prototype, "countedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'stock.stock_reason_master — overrides the header reason for the one pallet that was damaged rather than shrunk. Must be scoped to PHYSICAL, or to nothing at all.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherItemDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SavePhysicalStockVoucherItemDto.prototype, "remarks", void 0);
class SavePhysicalStockVoucherHeaderDto extends save_stock_voucher_dto_1.SaveStockVoucherHeaderDto {
    voucherType;
    lineCount = undefined;
    totalQty = undefined;
    totalValue = undefined;
    totalValueWot = undefined;
}
exports.SavePhysicalStockVoucherHeaderDto = SavePhysicalStockVoucherHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['PHYSICAL'],
        description: 'Optional, and only ever "PHYSICAL". The route decides the type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['PHYSICAL'], {
        message: 'voucherType must be PHYSICAL on this route. Other document types have their own routes because they state a quantity to move rather than what was found.',
    }),
    __metadata("design:type", String)
], SavePhysicalStockVoucherHeaderDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
    }),
    (0, class_validator_1.IsEmpty)({
        message: 'lineCount is not accepted on a count. The header carries the net variance, read off the ledger at post.',
    }),
    __metadata("design:type", void 0)
], SavePhysicalStockVoucherHeaderDto.prototype, "lineCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
    }),
    (0, class_validator_1.IsEmpty)({
        message: 'totalQty is not accepted on a count. The header carries the net variance, read off the ledger at post.',
    }),
    __metadata("design:type", void 0)
], SavePhysicalStockVoucherHeaderDto.prototype, "totalQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
    }),
    (0, class_validator_1.IsEmpty)({
        message: 'totalValue is not accepted on a count. The header carries the net variance, read off the ledger at post.',
    }),
    __metadata("design:type", void 0)
], SavePhysicalStockVoucherHeaderDto.prototype, "totalValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'NOT ACCEPTED on a count — sending it is a 400. Inherited from the shared header, where it is the screen\'s own total. A count header carries the NET VARIANCE, read off the ledger by fn_svh_recompute at post, and nothing on the count sheet adds up to it.',
    }),
    (0, class_validator_1.IsEmpty)({
        message: 'totalValueWot is not accepted on a count. The header carries the net variance, read off the ledger at post.',
    }),
    __metadata("design:type", void 0)
], SavePhysicalStockVoucherHeaderDto.prototype, "totalValueWot", void 0);
class SavePhysicalStockVoucherDto {
    header;
    lines;
}
exports.SavePhysicalStockVoucherDto = SavePhysicalStockVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SavePhysicalStockVoucherHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SavePhysicalStockVoucherHeaderDto),
    __metadata("design:type", SavePhysicalStockVoucherHeaderDto)
], SavePhysicalStockVoucherDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SavePhysicalStockVoucherItemDto,
        isArray: true,
        description: 'A full replace on update. NOTE that a re-save also refreshes every svi_book_qty from the current balance — right for a sheet still being filled in, and worth a confirmation on one being re-counted.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES, { message: `lines may not exceed ${MAX_LINES} rows in one document` }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SavePhysicalStockVoucherItemDto),
    __metadata("design:type", Array)
], SavePhysicalStockVoucherDto.prototype, "lines", void 0);
//# sourceMappingURL=save-physical-stock-voucher.dto.js.map