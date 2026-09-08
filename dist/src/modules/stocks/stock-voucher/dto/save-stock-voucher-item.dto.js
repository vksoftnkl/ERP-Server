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
exports.SaveStockVoucherItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_voucher_types_1 = require("../types/stock-voucher.types");
class SaveStockVoucherItemDto {
    lineNo;
    splitNo;
    itemId;
    uomId;
    baseUomId;
    toBaseFactor;
    godownId;
    lotId;
    bucket;
    barcode;
    batchNo;
    mfgDate;
    expiryDate;
    mrp;
    salePrice;
    serialNo;
    supplierId;
    qty;
    baseQty;
    freeQty;
    freeBaseQty;
    weightQty;
    bookQty;
    countedQty;
    costRate;
    costRateWot;
    landedRate;
    taxPerc;
    reasonId;
    syncDate;
    remarks;
}
exports.SaveStockVoucherItemDto = SaveStockVoucherItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, description: 'Position in the grid, 1-based (ck_svi_line_no)' }),
    (0, dtoDecorators_1.RequiredInteger)(),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        default: 1,
        description: 'A second allocation of the same line — one line drawn from three batches is three rows. Only meaningful with a batchNo (ck_svi_batch_split).',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "splitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.item_master.item_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. The unit must belong to this item (iuc_item_id).\n\n' +
            'REQUIRED on every QTY document, and refused on a COUNT: a count line names no unit, because the book figure it is measured against is held in the base unit and is read from the balance row with factor 1. Declared optional here only so the one type that must omit it can, and enforced instead in StockVoucherService.assertPayloadRules, which answers 422 alongside every other per-line problem.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The item's base unit, also an iuc_id — NOT item_unit_master.unit_id.\n\n" +
            'REQUIRED: svi_base_uom_id is NOT NULL and is no longer resolved server-side. Send the base unit the grid converted through; the server writes it verbatim.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "baseUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 0,
        exclusiveMinimum: true,
        example: 12,
        description: 'How many base units one uomId is worth — item_unit_conversion.iuc_to_base_factor as the grid used it.\n\n' +
            'REQUIRED: svi_to_base_factor is NOT NULL and is no longer read from item_unit_conversion. Must be > 0 (ck_svi_to_base_factor). numeric(18,6).',
    }),
    (0, dtoDecorators_1.RequiredNumber)(),
    (0, class_validator_1.IsPositive)({ message: 'toBaseFactor must be greater than 0 (ck_svi_to_base_factor)' }),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "toBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.godown_locations.gdl_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The holding this line is about. REQUIRED, REFUSED or IGNORED depending on the document type — see StockVoucherTypeRules.requiresLot.\n\n' +
            'REQUIRED on a TRANSFER (both halves): a transfer MOVES existing stock, so the destination must receive the same slt_id or ageing resets. The grid is loaded from stock_balance, which carries it.\n\n' +
            'REQUIRED on a COUNT: the line comes from a count sheet that already names the lot its book figure was read from.\n\n' +
            'REFUSED on an OPENING and every other QTY document: fn_slt_resolve owns lot identity there, and a client-chosen lot would let two documents open the same holding under two different lots.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "lotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: stock_voucher_types_1.STOCK_BUCKETS,
        default: 'SALEABLE',
        description: 'ck_svi_bucket',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(stock_voucher_types_1.STOCK_BUCKETS, {
        message: `bucket must be one of ${stock_voucher_types_1.STOCK_BUCKETS.join(', ')}`,
    }),
    __metadata("design:type", String)
], SaveStockVoucherItemDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What the scanner read, verbatim. Never resolved server-side — itemId, batchNo and serialNo are what identify the line, and a barcode that disagrees with them does not override them. Stored so a reprint can show the symbol actually scanned.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'In uomId, not in the base unit. Must not be negative.\n\n' +
            'REQUIRED on every QTY document; absent — or 0 — on a COUNT, whose lines state what was FOUND rather than a quantity to move. Optional here for that one type; a QTY line without it is refused by assertPayloadRules as "has no quantity".',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 0,
        example: 120,
        description: 'The same quantity IN THE BASE UNIT — qty x toBaseFactor as the grid computed it.\n\n' +
            'REQUIRED: svi_base_qty is NOT NULL and is no longer multiplied server-side. It is what svi_value is GENERATED from, so it is the number the document is actually valued on. Must not be negative (ck_svi_qty_sign). numeric(18,6).',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "baseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Free goods, in uomId. They are stock, and they count toward the totals.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'The free quantity IN THE BASE UNIT — freeQty x toBaseFactor as the grid computed it. No longer multiplied server-side.\n\n' +
            'Omit to take the column default of 0; svi_free_base_qty is NOT NULL DEFAULT 0. Counts toward svi_value alongside baseQty. Must not be negative (ck_svi_qty_sign). numeric(18,6).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveStockVoucherItemDto.prototype, "freeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Net weight, for goods sold or held by weight. Carried alongside the quantity rather than derived from it: a 10kg bag that actually weighs 9.7kg opens at the weight on the scale, and the conversion factor cannot know that.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "weightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What the system thought was on the shelf. PHYSICAL only.',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "bookQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What was actually on the shelf. PHYSICAL only. The variance (svi_diff_qty) is GENERATED from these two and cannot be sent — storing only the difference makes it impossible to defend a year later, and storing it generated makes it impossible to fudge.',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "countedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Cost per unit of uomId, inclusive of tax.\n\n' +
            "Absent on a COUNT: an overage is valued from the document's rate source and a shortage at what the stock cost us, stamped by fn_sml_cost_default from the item's valuation policy — never by the counter.",
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "costRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Cost excluding tax. Leave 0 — the engine derives it from taxPerc at post and writes it back (20 ÷ 1.05 = 19.047619).',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "costRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Cost including the freight, duty and handling attributed to the line. Kept beside costRate rather than folded into it, so a valuation can answer both "what did it cost" and "what did it cost to get here".',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "landedRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "taxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'stock.stock_reason_master, per line — a document can be raised for one reason and a single line adjusted for another.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When an offline device synced this line up.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockVoucherItemDto.prototype, "remarks", void 0);
//# sourceMappingURL=save-stock-voucher-item.dto.js.map