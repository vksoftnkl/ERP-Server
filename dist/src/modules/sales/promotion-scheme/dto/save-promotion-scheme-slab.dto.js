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
exports.SavePromotionSchemeSlabsDto = exports.PromotionSchemeSlabRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const promotion_scheme_dto_helpers_1 = require("./promotion-scheme-dto.helpers");
const promotion_scheme_utils_1 = require("../utils/promotion-scheme.utils");
class PromotionSchemeSlabRowDto {
    prs_id;
    prs_slno;
    prs_benefit;
    prs_exceeds;
    prs_upto;
    prs_each;
    prs_is_repeat;
    prs_max_repeats;
    prs_free_item_id;
    prs_free_unit_id;
    prs_free_qty;
    prs_free_stock_check;
    prs_disc_perc;
    prs_disc_qty;
    prs_disc_amt;
    prs_fixed_price;
    prs_max_benefit_amt;
    prs_notes;
    prs_is_active;
    prs_created_by;
    prs_modified_by;
}
exports.PromotionSchemeSlabRowDto = PromotionSchemeSlabRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, promotion_scheme_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], PromotionSchemeSlabRowDto.prototype, "prs_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: promotion_scheme_utils_1.PRM_BENEFITS,
        description: "Mirrors the header's prm_benefit and is defaulted from it when omitted. Sending a " +
            'different value is rejected — the composite foreign key would refuse the row anyway.',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], PromotionSchemeSlabRowDto.prototype, "prs_benefit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Lower bound. Rupees for a *_AMOUNT trigger, quantity for a *_QTY one.',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Ceiling. NULL = open-ended.' }),
    (0, promotion_scheme_dto_helpers_1.NullableNumber)(0),
    __metadata("design:type", Object)
], PromotionSchemeSlabRowDto.prototype, "prs_upto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, description: 'Granularity when repeating' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_each", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Give the benefit once per prs_each above prs_exceeds, not once in total',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabRowDto.prototype, "prs_is_repeat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = unlimited within the band' }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_max_repeats", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'FREE_ITEM only' }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], PromotionSchemeSlabRowDto.prototype, "prs_free_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'FREE_ITEM only. Required whenever prs_free_item_id is set, and vice versa.',
    }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], PromotionSchemeSlabRowDto.prototype, "prs_free_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_free_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Refuse the free issue when the branch has no stock of it',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabRowDto.prototype, "prs_free_stock_check", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 100, default: 0, description: 'DISC_PERC only' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'DISC_AMT stated as rupees off PER UNIT',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'DISC_AMT stated as flat rupees off the line',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_disc_amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'FIXED_PRICE only' }),
    (0, promotion_scheme_dto_helpers_1.NullableNumber)(0),
    __metadata("design:type", Object)
], PromotionSchemeSlabRowDto.prototype, "prs_fixed_price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped, per band' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeSlabRowDto.prototype, "prs_max_benefit_amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], PromotionSchemeSlabRowDto.prototype, "prs_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeSlabRowDto.prototype, "prs_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemeSlabRowDto.prototype, "prs_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemeSlabRowDto.prototype, "prs_modified_by", void 0);
class SavePromotionSchemeSlabsDto {
    prm_id;
    slabs;
}
exports.SavePromotionSchemeSlabsDto = SavePromotionSchemeSlabsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, promotion_scheme_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePromotionSchemeSlabsDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeSlabRowDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PromotionSchemeSlabRowDto),
    __metadata("design:type", Array)
], SavePromotionSchemeSlabsDto.prototype, "slabs", void 0);
//# sourceMappingURL=save-promotion-scheme-slab.dto.js.map