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
exports.DeactivateStockReasonDto = exports.SaveStockReasonDto = exports.StockReasonRefQueryDto = exports.StockReasonListQueryDto = exports.StockReasonPickerQueryDto = exports.REASON_DIRECTIONS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const stock_adjustment_rules_1 = require("../stock-adjustment.rules");
exports.REASON_DIRECTIONS = ['IN', 'OUT', 'BOTH'];
class StockReasonPickerQueryDto {
    companyId;
    voucherType;
    direction;
}
exports.StockReasonPickerQueryDto = StockReasonPickerQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockReasonPickerQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: stock_adjustment_rules_1.STOCK_ADJUSTMENT_SAVE_KINDS,
        description: 'Filters by the reasons allowed on this kind. BUCKET_MOVE lists only reasons that name BUCKET_OUT / BUCKET_IN (MOVE_DAMAGED, MOVE_SALEABLE and a company\'s own), never an any-movement reason.',
    }),
    (0, class_validator_1.IsIn)(stock_adjustment_rules_1.STOCK_ADJUSTMENT_SAVE_KINDS),
    __metadata("design:type", String)
], StockReasonPickerQueryDto.prototype, "voucherType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['IN', 'OUT'], description: 'Only reasons that move this way (BOTH always qualifies).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['IN', 'OUT']),
    __metadata("design:type", String)
], StockReasonPickerQueryDto.prototype, "direction", void 0);
class StockReasonListQueryDto {
    companyId;
    includeInactive;
}
exports.StockReasonListQueryDto = StockReasonListQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockReasonListQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Include inactive rows.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], StockReasonListQueryDto.prototype, "includeInactive", void 0);
class StockReasonRefQueryDto {
    companyId;
    srmId;
}
exports.StockReasonRefQueryDto = StockReasonRefQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockReasonRefQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], StockReasonRefQueryDto.prototype, "srmId", void 0);
class SaveStockReasonDto {
    srmId;
    companyId;
    code;
    name;
    direction;
    allowedTxnTypes;
    requireRemarks;
    glLedgerId;
    sortOrder;
    remarks;
    isActive;
    userId;
}
exports.SaveStockReasonDto = SaveStockReasonDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update the company\'s own row; absent = create one.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveStockReasonDto.prototype, "srmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company the row belongs to. A SHARED row (company NULL) cannot be written through this route.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveStockReasonDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, description: 'Upper-case code. Immutable once any ledger row cites the reason. The same code as a shared row HIDES the shared row for this company.' }),
    (0, dtoDecorators_1.UpperMaxString)(30),
    __metadata("design:type", String)
], SaveStockReasonDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, dtoDecorators_1.TrimmedString)(150),
    __metadata("design:type", String)
], SaveStockReasonDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.REASON_DIRECTIONS }),
    (0, class_validator_1.IsIn)(exports.REASON_DIRECTIONS),
    __metadata("design:type", String)
], SaveStockReasonDto.prototype, "direction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'Ledger txn types the reason may be cited on; empty = any. A reason that names exactly ONE issue type makes an ISSUE post that type.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(30, { each: true }),
    __metadata("design:type", Array)
], SaveStockReasonDto.prototype, "allowedTxnTypes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockReasonDto.prototype, "requireRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'The expense / income ledger the reason posts to under PERPETUAL; unset, the STOCK_SHORTAGE / STOCK_EXCESS role does.' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveStockReasonDto.prototype, "glLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0, 32000),
    __metadata("design:type", Number)
], SaveStockReasonDto.prototype, "sortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveStockReasonDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveStockReasonDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveStockReasonDto.prototype, "userId", void 0);
class DeactivateStockReasonDto {
    companyId;
    srmId;
    reactivate;
    userId;
}
exports.DeactivateStockReasonDto = DeactivateStockReasonDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeactivateStockReasonDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeactivateStockReasonDto.prototype, "srmId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'true re-activates.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeactivateStockReasonDto.prototype, "reactivate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], DeactivateStockReasonDto.prototype, "userId", void 0);
//# sourceMappingURL=stock-reason.dto.js.map