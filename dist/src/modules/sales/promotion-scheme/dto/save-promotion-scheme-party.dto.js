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
exports.PromotionSchemePartyRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const promotion_scheme_dto_helpers_1 = require("./promotion-scheme-dto.helpers");
const promotion_scheme_utils_1 = require("../utils/promotion-scheme.utils");
class PromotionSchemePartyRowDto {
    prp_id;
    prp_slno;
    prp_kind;
    prp_scope_id;
    prp_is_exclude;
    prp_match_priority;
    prp_notes;
    prp_is_active;
    prp_created_by;
    prp_modified_by;
}
exports.PromotionSchemePartyRowDto = PromotionSchemePartyRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, promotion_scheme_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], PromotionSchemePartyRowDto.prototype, "prp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], PromotionSchemePartyRowDto.prototype, "prp_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: promotion_scheme_utils_1.PRP_KINDS, example: 'CUSTOMER_GROUP' }),
    (0, class_validator_1.ValidateIf)((o) => o.prp_id === undefined || o.prp_kind !== undefined),
    (0, promotion_scheme_dto_helpers_1.TrimmedString)(20),
    __metadata("design:type", String)
], PromotionSchemePartyRowDto.prototype, "prp_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'The customer, customer group, area or city — whichever prp_kind names',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.prp_id === undefined || o.prp_scope_id !== undefined),
    (0, promotion_scheme_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], PromotionSchemePartyRowDto.prototype, "prp_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'An EXCLUDE row beats an INCLUDE row at equal priority',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemePartyRowDto.prototype, "prp_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 9,
        description: 'Narrowest wins. Defaults by kind when omitted: CUSTOMER 4, AREA 3, CITY 2, ' +
            'CUSTOMER_GROUP 1.',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(0, 9),
    __metadata("design:type", Number)
], PromotionSchemePartyRowDto.prototype, "prp_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], PromotionSchemePartyRowDto.prototype, "prp_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemePartyRowDto.prototype, "prp_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemePartyRowDto.prototype, "prp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemePartyRowDto.prototype, "prp_modified_by", void 0);
//# sourceMappingURL=save-promotion-scheme-party.dto.js.map