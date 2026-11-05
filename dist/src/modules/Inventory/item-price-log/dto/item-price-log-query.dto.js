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
exports.ItemPriceLogGapsQueryDto = exports.ItemPriceHistoryQueryDto = exports.GetItemPriceLogQueryDto = exports.ListItemPriceLogQueryDto = exports.ItemPriceLogFilterDto = exports.PRICE_TABLE_FILTERS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const price_change_log_types_1 = require("../types/price-change-log.types");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
exports.PRICE_TABLE_FILTERS = ['IPM', 'IQP', 'BOTH'];
class ItemPriceLogFilterDto {
    companyId;
    branchId;
    fromDate;
    toDate;
    priceTable;
    itemId;
    userId;
    deviceId;
    field;
    source;
    action;
    search;
}
exports.ItemPriceLogFilterDto = ItemPriceLogFilterDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'One branch (with the all-branches prices). Omit for every branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-01', description: 'First day, by the change date.' }),
    (0, class_validator_1.Matches)(DAY, { message: 'fromDate must be yyyy-MM-dd' }),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-23', description: 'Last day, inclusive.' }),
    (0, class_validator_1.Matches)(DAY, { message: 'toDate must be yyyy-MM-dd' }),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PRICE_TABLE_FILTERS, default: 'BOTH' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PRICE_TABLE_FILTERS),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "priceTable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Who made the change.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Notes 145 — made on this device.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'ipm_sales_price_b',
        description: 'Notes 145 — only changes that touched this column (a raw column name, as fields[].column ' +
            'and ipcl_changed name it): e.g. only the Price B changes.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(ipm|iqp)_[a-z0-9_]{1,60}$/, {
        message: 'field must be a price column name, such as ipm_sales_price_b',
    }),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: price_change_log_types_1.PRICE_CHANGE_SOURCES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(price_change_log_types_1.PRICE_CHANGE_SOURCES),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: price_change_log_types_1.PRICE_CHANGE_ACTIONS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(price_change_log_types_1.PRICE_CHANGE_ACTIONS),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Item code or name, as it was at the time.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], ItemPriceLogFilterDto.prototype, "search", void 0);
class ListItemPriceLogQueryDto extends ItemPriceLogFilterDto {
    page;
    limit;
}
exports.ListItemPriceLogQueryDto = ListItemPriceLogQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], ListItemPriceLogQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 100, minimum: 1, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], ListItemPriceLogQueryDto.prototype, "limit", void 0);
class GetItemPriceLogQueryDto {
    ipclId;
}
exports.GetItemPriceLogQueryDto = GetItemPriceLogQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GetItemPriceLogQueryDto.prototype, "ipclId", void 0);
class ItemPriceHistoryQueryDto {
    itemId;
    companyId;
    branchId;
    priceTable;
    limit;
}
exports.ItemPriceHistoryQueryDto = ItemPriceHistoryQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ItemPriceHistoryQueryDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'With the shared prices. Omit for every company.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceHistoryQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'With the all-branches prices. Omit for every branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceHistoryQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PRICE_TABLE_FILTERS, default: 'BOTH' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PRICE_TABLE_FILTERS),
    __metadata("design:type", String)
], ItemPriceHistoryQueryDto.prototype, "priceTable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, minimum: 1, maximum: 1000 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 1000),
    __metadata("design:type", Number)
], ItemPriceHistoryQueryDto.prototype, "limit", void 0);
class ItemPriceLogGapsQueryDto {
    companyId;
}
exports.ItemPriceLogGapsQueryDto = ItemPriceLogGapsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Only this company’s (and shared) price rows.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLogGapsQueryDto.prototype, "companyId", void 0);
//# sourceMappingURL=item-price-log-query.dto.js.map