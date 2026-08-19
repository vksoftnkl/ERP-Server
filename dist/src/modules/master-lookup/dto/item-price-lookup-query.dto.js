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
exports.ItemPriceLookupQueryDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const DtoTransforms_1 = require("../../../common/dto/DtoTransforms");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const master_lookup_constants_1 = require("../master-lookup.constants");
const OptionalChargeMode = (field, values) => (0, common_1.applyDecorators)((0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(({ value }) => (0, DtoTransforms_1.toOptionalTrimmedString)(value)?.toLowerCase()), (0, class_validator_1.IsIn)(values, {
    message: `${field} must be one of: ${values.join(', ')}`,
}));
class ItemPriceLookupQueryDto {
    item_id;
    unit_id;
    company_id;
    branch_id;
    customer_id;
    godown_id;
    acccyear;
    regional;
    loading_type;
    freight_type;
    price_level;
}
exports.ItemPriceLookupQueryDto = ItemPriceLookupQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Scopes the company-driven values (GST applicability, negative-stock rule, stock). When omitted, the item is resolved without a company scope.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Scopes the item and its price rows to a branch. When omitted, the item is resolved across all branches.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "customer_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Sale godown override (legacy isale_no). When supplied, resolves the godown row and scopes stock to this godown instead of the rate\'s own godown.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "godown_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, description: 'Accounting year, e.g. 2024-2025' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "acccyear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Regional name (legacy iregional). When true, returns item_name_ta, else the English name.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ItemPriceLookupQueryDto.prototype, "regional", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: master_lookup_constants_1.LOADING_TYPES,
        default: master_lookup_constants_1.DEFAULT_LOADING_TYPE,
        description: "Voucher-level loading mode the loading charge is resolved with. manual = nothing resolved (user types it in); item_basis = the item price row's own charge; auto = the weight slab in sale_loading_charges, which also requires company_id and branch_id. Omitted is manual.",
    }),
    OptionalChargeMode('loading_type', master_lookup_constants_1.LOADING_TYPES),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "loading_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: master_lookup_constants_1.FREIGHT_TYPES,
        default: master_lookup_constants_1.DEFAULT_FREIGHT_TYPE,
        description: "Voucher-level freight mode the freight charge is resolved with. manual = nothing resolved (user types it in); item_basis = the item price row's own ipm_freight_charge. Omitted is manual. There is no auto: freight slabs are matched on distance, which this lookup is not given.",
    }),
    OptionalChargeMode('freight_type', master_lookup_constants_1.FREIGHT_TYPES),
    __metadata("design:type", String)
], ItemPriceLookupQueryDto.prototype, "freight_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 1,
        maximum: 7,
        description: 'Price column to use: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1, 7),
    __metadata("design:type", Number)
], ItemPriceLookupQueryDto.prototype, "price_level", void 0);
//# sourceMappingURL=item-price-lookup-query.dto.js.map