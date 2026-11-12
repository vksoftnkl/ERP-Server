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
exports.MergeDto = exports.MergePreviewDto = exports.FiguresDto = exports.StockCoverDto = exports.SaleOrderDeskOrderRefDto = exports.CloseOpenLinesDto = exports.PriorityDto = exports.DeliveryHoldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const sale_order_lifecycle_dto_1 = require("../../sale-order/dto/sale-order-lifecycle.dto");
const sale_order_desk_types_1 = require("../types/sale-order-desk.types");
class DeliveryHoldDto extends sale_order_lifecycle_dto_1.SaleOrderKeysDto {
    soDeliveryHold;
    reason;
}
exports.DeliveryHoldDto = DeliveryHoldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The state wanted: true = put on delivery hold, false = release' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeliveryHoldDto.prototype, "soDeliveryHold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 250,
        description: 'Why — required both ways (400 SALES_ORDER_REASON_REQUIRED when blank)',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(250),
    __metadata("design:type", String)
], DeliveryHoldDto.prototype, "reason", void 0);
class PriorityDto extends sale_order_lifecycle_dto_1.SaleOrderKeysDto {
    soPriority;
}
exports.PriorityDto = PriorityDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: sale_order_desk_types_1.SALE_ORDER_DESK_PRIORITIES,
        description: 'The priority wanted (ck_so_priority). The desk sends URGENT (quick) or NORMAL',
    }),
    (0, class_validator_1.IsIn)([...sale_order_desk_types_1.SALE_ORDER_DESK_PRIORITIES]),
    __metadata("design:type", String)
], PriorityDto.prototype, "soPriority", void 0);
class CloseOpenLinesDto extends sale_order_lifecycle_dto_1.SaleOrderKeysDto {
    reason;
}
exports.CloseOpenLinesDto = CloseOpenLinesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 250,
        description: 'Why the rest is not wanted (400 SALES_ORDER_REASON_REQUIRED when blank)',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(250),
    __metadata("design:type", String)
], CloseOpenLinesDto.prototype, "reason", void 0);
class SaleOrderDeskOrderRefDto {
    soId;
    soAccYear;
}
exports.SaleOrderDeskOrderRefDto = SaleOrderDeskOrderRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleOrderDeskOrderRefDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaleOrderDeskOrderRefDto.prototype, "soAccYear", void 0);
class SaleOrderDeskScopeDto {
    soCompanyId;
    soBranchId;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleOrderDeskScopeDto.prototype, "soCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleOrderDeskScopeDto.prototype, "soBranchId", void 0);
class StockCoverDto extends SaleOrderDeskScopeDto {
    orders;
    itemId;
}
exports.StockCoverDto = StockCoverDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderDeskOrderRefDto, isArray: true, minItems: 1, maxItems: 500 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(sale_order_desk_types_1.SALE_ORDER_DESK_COVER_MAX),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleOrderDeskOrderRefDto),
    __metadata("design:type", Array)
], StockCoverDto.prototype, "orders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: "The desk's item filter, or null for every item",
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], StockCoverDto.prototype, "itemId", void 0);
class FiguresDto extends SaleOrderDeskScopeDto {
    itemId;
    orders;
    custIds;
}
exports.FiguresDto = FiguresDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'openValue counts this item only; orderOpenValue is always the whole order',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], FiguresDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderDeskOrderRefDto, isArray: true, maxItems: 2000 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(sale_order_desk_types_1.SALE_ORDER_DESK_FIGURES_MAX),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleOrderDeskOrderRefDto),
    __metadata("design:type", Array)
], FiguresDto.prototype, "orders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        isArray: true,
        maxItems: 2000,
        description: "More customers to read dues for (e.g. the strip's current customer)",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(sale_order_desk_types_1.SALE_ORDER_DESK_FIGURES_MAX),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], FiguresDto.prototype, "custIds", void 0);
class MergePreviewDto extends SaleOrderDeskScopeDto {
    orders;
}
exports.MergePreviewDto = MergePreviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SaleOrderDeskOrderRefDto,
        isArray: true,
        maxItems: 20,
        description: 'The orders to merge (fewer than 2 distinct → refusal SALES_ORDER_MERGE_TOO_FEW)',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(sale_order_desk_types_1.SALE_ORDER_DESK_MERGE_MAX),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleOrderDeskOrderRefDto),
    __metadata("design:type", Array)
], MergePreviewDto.prototype, "orders", void 0);
class MergeDto extends MergePreviewDto {
    soAccYear;
    soDeviceId;
    soSessionId;
    fingerprint;
    reason;
}
exports.MergeDto = MergeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        minLength: 9,
        maxLength: 9,
        example: '2026-2027',
        description: "The NEW order's year",
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MergeDto.prototype, "soAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "fixed.device_master.dev_id — the session's registered device; numbers the new order",
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MergeDto.prototype, "soDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], MergeDto.prototype, "soSessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The fingerprint merge-preview answered (409 SOURCE_CHANGED if stale)',
    }),
    (0, dtoDecorators_1.TrimmedString)(64),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MergeDto.prototype, "fingerprint", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, description: "Default 'Merged on the order desk'" }),
    (0, dtoDecorators_1.OptionalTrimmedString)(250),
    __metadata("design:type", String)
], MergeDto.prototype, "reason", void 0);
//# sourceMappingURL=sale-order-desk.dto.js.map