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
exports.DeactivateStockTrackPresetDto = exports.SaveStockTrackPresetDto = exports.PRESET_TRACK_FIELDS = exports.PRESET_AGEING_BASES = exports.PRESET_ALLOW_NEGATIVE = exports.PRESET_ISSUE_STRATEGIES = exports.PRESET_VALUATION_METHODS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
exports.PRESET_VALUATION_METHODS = ['WAVG', 'FIFO', 'LOT_ACTUAL'];
exports.PRESET_ISSUE_STRATEGIES = ['FIFO', 'FEFO', 'LIFO', 'MANUAL'];
exports.PRESET_ALLOW_NEGATIVE = ['ALLOW', 'WARN', 'BLOCK'];
exports.PRESET_AGEING_BASES = ['INWARD_DATE', 'MFG_DATE', 'LAST_IN_DATE'];
exports.PRESET_TRACK_FIELDS = [
    'trackBatch',
    'trackMrp',
    'trackSalePrice',
    'trackExpiry',
    'trackSerial',
    'trackSupplier',
];
class SaveStockTrackPresetDto {
    sptId;
    companyId;
    code;
    name;
    description;
    trackBatch;
    trackMrp;
    trackSalePrice;
    trackExpiry;
    trackSerial;
    trackSupplier;
    valuationMethod;
    issueStrategy;
    allowNegative;
    shelfLifeDays;
    nearExpiryDays;
    blockExpiredSale;
    ageingBasis;
    sortOrder;
    remarks;
}
exports.SaveStockTrackPresetDto = SaveStockTrackPresetDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: "Present = update the company's own preset; absent = create one." }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "sptId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company the preset belongs to.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        example: 'DAIRY',
        description: 'Upper-cased; letters, digits, _ and -. Required on a create. The code of a shared preset OVERRIDES it for this company. Unique per company; locked once the preset is used.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(30),
    (0, class_validator_1.Matches)(/^[A-Z0-9_-]+$/, { message: 'code may hold only letters, digits, _ and -' }),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, description: 'Required on a create.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(150),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockTrackPresetDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Locked once used.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "trackBatch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Locked once used.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "trackMrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Locked once used.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "trackSalePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Needs trackBatch. Locked once used.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "trackExpiry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Locked once used.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "trackSerial", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Locked once used.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "trackSupplier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.PRESET_VALUATION_METHODS,
        description: 'LOT_ACTUAL when any flag is on, else WAVG; derived when left out. Locked once used.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PRESET_VALUATION_METHODS),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "valuationMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.PRESET_ISSUE_STRATEGIES,
        description: 'FEFO needs trackExpiry when batches are tracked. Default on a create: FEFO, or FIFO when batches are tracked without expiry.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PRESET_ISSUE_STRATEGIES),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "issueStrategy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PRESET_ALLOW_NEGATIVE, description: 'Default ALLOW.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PRESET_ALLOW_NEGATIVE),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "allowNegative", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, nullable: true, description: 'null = no shelf life.' }),
    (0, dtoDecorators_1.NullableInteger)(1),
    __metadata("design:type", Object)
], SaveStockTrackPresetDto.prototype, "shelfLifeDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: 'Default 30.' }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveStockTrackPresetDto.prototype, "nearExpiryDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default false.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockTrackPresetDto.prototype, "blockExpiredSale", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PRESET_AGEING_BASES, description: 'Default INWARD_DATE.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PRESET_AGEING_BASES),
    __metadata("design:type", String)
], SaveStockTrackPresetDto.prototype, "ageingBasis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default 0.' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveStockTrackPresetDto.prototype, "sortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockTrackPresetDto.prototype, "remarks", void 0);
class DeactivateStockTrackPresetDto {
    companyId;
    sptId;
    reactivate;
}
exports.DeactivateStockTrackPresetDto = DeactivateStockTrackPresetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeactivateStockTrackPresetDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeactivateStockTrackPresetDto.prototype, "sptId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'true = reactivate instead.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], DeactivateStockTrackPresetDto.prototype, "reactivate", void 0);
//# sourceMappingURL=save-stock-track-preset.dto.js.map