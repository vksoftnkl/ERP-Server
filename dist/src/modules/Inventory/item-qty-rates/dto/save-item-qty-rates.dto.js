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
exports.SaveItemQtyRatesDto = exports.SaveQtyRatesCardDto = exports.SaveQtyRatesCardRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_selling_price_bulk_dto_1 = require("../../../stocks/selling-price-bulk/dto/save-selling-price-bulk.dto");
const save_item_qty_price_dto_1 = require("../../items-qty-price-master/dto/save-item-qty-price.dto");
const item_qty_rates_types_1 = require("../types/item-qty-rates.types");
class SaveQtyRatesCardRowDto extends (0, swagger_1.OmitType)(save_selling_price_bulk_dto_1.SaveSellingPriceRowDto, ['itemId']) {
}
exports.SaveQtyRatesCardRowDto = SaveQtyRatesCardRowDto;
class SaveQtyRatesCardDto {
    rows;
}
exports.SaveQtyRatesCardDto = SaveQtyRatesCardDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SaveQtyRatesCardRowDto,
        isArray: true,
        description: 'CHANGED rows only, each as get-with-rates loaded it (uomId, bucketId, priceScope, mrp and ' +
            'salePrice echoed) with what was typed. On a Plain-stock row send costPrice always (typed, ' +
            'or as loaded — C4). maxPrice (a typed MRP) and costPrice on a Plain-stock item only. Saved ' +
            'at THIS branch from today, as Quick Rate saves (D3).',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(item_qty_rates_types_1.MAX_QTY_RATES_CARD_ROWS),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveQtyRatesCardRowDto),
    __metadata("design:type", Array)
], SaveQtyRatesCardDto.prototype, "rows", void 0);
class SaveItemQtyRatesDto {
    companyId;
    branchId;
    itemId;
    confirmed;
    rates;
    slabs;
    deleteSlabIds;
}
exports.SaveItemQtyRatesDto = SaveItemQtyRatesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveItemQtyRatesDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveItemQtyRatesDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The one item the form saves; every slab must be its.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveItemQtyRatesDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'The popup\'s "Save anyway": answers every ASK problem (below cost under "warning", By User ' +
            'prices kept) at once (C8). Every check runs again; refusals are never confirmable.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemQtyRatesDto.prototype, "confirmed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: SaveQtyRatesCardDto,
        nullable: true,
        description: 'Null / absent when no card cell changed. Needs menu 30 EDIT (STOCK_PRICE_RIGHT_EDIT).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SaveQtyRatesCardDto),
    __metadata("design:type", Object)
], SaveItemQtyRatesDto.prototype, "rates", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_item_qty_price_dto_1.SaveItemQtyPriceDto,
        isArray: true,
        description: "CHANGED or NEW slabs only, exactly /item-qty-prices/create's keys; iqp_item_id = itemId. A " +
            'row without iqp_id needs menu 244 CREATE, with one EDIT.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(item_qty_rates_types_1.MAX_QTY_RATES_SLABS),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_item_qty_price_dto_1.SaveItemQtyPriceDto),
    __metadata("design:type", Array)
], SaveItemQtyRatesDto.prototype, "slabs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        isArray: true,
        description: 'Slabs removed by this Save (C2), soft-deleted first. Needs menu 244 DELETE.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(item_qty_rates_types_1.MAX_QTY_RATES_SLABS),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], SaveItemQtyRatesDto.prototype, "deleteSlabIds", void 0);
//# sourceMappingURL=save-item-qty-rates.dto.js.map