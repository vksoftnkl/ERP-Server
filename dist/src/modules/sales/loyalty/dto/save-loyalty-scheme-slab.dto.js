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
exports.LoyaltySchemeSlabRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class LoyaltySchemeSlabRowDto {
    lss_id;
    lss_slno;
    lss_item_id;
    lss_unit_id;
    lss_exceeds;
    lss_upto;
    lss_each;
    lss_points;
    lss_factor;
    lss_max_points;
    lss_notes;
    lss_is_active;
    lss_created_by;
    lss_modified_by;
}
exports.LoyaltySchemeSlabRowDto = LoyaltySchemeSlabRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeSlabRowDto.prototype, "lss_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], LoyaltySchemeSlabRowDto.prototype, "lss_slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'inventory.item_master(item_id). NULL = the band applies to the whole bill.',
    }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], LoyaltySchemeSlabRowDto.prototype, "lss_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'inventory.item_unit_conversion(iuc_id) — the same target a bill line uses, NOT ' +
            'item_unit_master(unit_id).',
    }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], LoyaltySchemeSlabRowDto.prototype, "lss_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Band lower bound. Rupees for an *_AMOUNT trigger, quantity for a *_QTY one.',
    }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeSlabRowDto.prototype, "lss_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        description: 'Band ceiling. NULL = open-ended.',
    }),
    (0, loyalty_dto_helpers_1.NullableNumber)(0),
    __metadata("design:type", Object)
], LoyaltySchemeSlabRowDto.prototype, "lss_upto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, description: 'Granularity — points are awarded per this' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeSlabRowDto.prototype, "lss_each", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Awarded per lss_each' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeSlabRowDto.prototype, "lss_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeSlabRowDto.prototype, "lss_factor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeSlabRowDto.prototype, "lss_max_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], LoyaltySchemeSlabRowDto.prototype, "lss_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemeSlabRowDto.prototype, "lss_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemeSlabRowDto.prototype, "lss_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemeSlabRowDto.prototype, "lss_modified_by", void 0);
//# sourceMappingURL=save-loyalty-scheme-slab.dto.js.map