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
exports.PromotionSchemeItemRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const promotion_scheme_dto_helpers_1 = require("./promotion-scheme-dto.helpers");
const promotion_scheme_utils_1 = require("../utils/promotion-scheme.utils");
class PromotionSchemeItemRowDto {
    pri_id;
    pri_slno;
    pri_kind;
    pri_scope_id;
    pri_unit_id;
    pri_is_exclude;
    pri_disc_perc;
    pri_disc_qty;
    pri_disc_amt;
    pri_min_qty;
    pri_factor;
    pri_max_benefit;
    pri_match_priority;
    pri_notes;
    pri_is_active;
    pri_created_by;
    pri_modified_by;
}
exports.PromotionSchemeItemRowDto = PromotionSchemeItemRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, promotion_scheme_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], PromotionSchemeItemRowDto.prototype, "pri_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: promotion_scheme_utils_1.PRI_KINDS, example: 'ITEM_BRAND' }),
    (0, class_validator_1.ValidateIf)((o) => o.pri_id === undefined || o.pri_kind !== undefined),
    (0, promotion_scheme_dto_helpers_1.TrimmedString)(20),
    __metadata("design:type", String)
], PromotionSchemeItemRowDto.prototype, "pri_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'The item, group, category, brand or section — whichever pri_kind names',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.pri_id === undefined || o.pri_scope_id !== undefined),
    (0, promotion_scheme_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], PromotionSchemeItemRowDto.prototype, "pri_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'inventory.item_unit_conversion(iuc_id). REQUIRED when pri_kind is ITEM — ten pieces, ' +
            'ten boxes and ten cases are three different offers — and must be null for every other kind.',
    }),
    (0, promotion_scheme_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], PromotionSchemeItemRowDto.prototype, "pri_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Kills the line regardless of any broader rule. Forbids any rate on the same row.',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeItemRowDto.prototype, "pri_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 100, default: 0, description: '% off the line' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Rupees off PER UNIT' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Flat rupees off the line' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_disc_amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Quantity floor for THIS item' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_min_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 1,
        description: 'Scales whatever the band computed for the line. 2.0 = double it.',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_factor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped, per line' }),
    (0, promotion_scheme_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_max_benefit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 9,
        description: 'Most specific wins. Defaults by kind when omitted: ITEM 4, ITEM_BRAND 3, ' +
            'ITEM_CATEGORY 2, ITEM_SECTION 1, ITEM_GROUP 0.',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(0, 9),
    __metadata("design:type", Number)
], PromotionSchemeItemRowDto.prototype, "pri_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], PromotionSchemeItemRowDto.prototype, "pri_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeItemRowDto.prototype, "pri_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemeItemRowDto.prototype, "pri_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemeItemRowDto.prototype, "pri_modified_by", void 0);
//# sourceMappingURL=save-promotion-scheme-item.dto.js.map