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
exports.LoyaltySchemeItemRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
const loyalty_utils_1 = require("../utils/loyalty.utils");
class LoyaltySchemeItemRowDto {
    lsi_id;
    lsi_slno;
    lsi_kind;
    lsi_scope_id;
    lsi_is_exclude;
    lsi_factor;
    lsi_points;
    lsi_max_points;
    lsi_match_priority;
    lsi_notes;
    lsi_is_active;
    lsi_created_by;
    lsi_modified_by;
}
exports.LoyaltySchemeItemRowDto = LoyaltySchemeItemRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeItemRowDto.prototype, "lsi_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], LoyaltySchemeItemRowDto.prototype, "lsi_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: loyalty_utils_1.LSI_KINDS, example: 'ITEM_BRAND' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsi_id === undefined || o.lsi_kind !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(20),
    __metadata("design:type", String)
], LoyaltySchemeItemRowDto.prototype, "lsi_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'The item, group, category, brand or section — whichever lsi_kind names',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.lsi_id === undefined || o.lsi_scope_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeItemRowDto.prototype, "lsi_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Earns nothing regardless of any broader rule. Forbids any rate on the same row.',
    }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemeItemRowDto.prototype, "lsi_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 1,
        description: 'Multiplies whatever the slab computed for the line. 2.0 = double points.',
    }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeItemRowDto.prototype, "lsi_factor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 0,
        description: 'Non-zero REPLACES the slab result outright instead of scaling it',
    }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeItemRowDto.prototype, "lsi_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped, per line' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeItemRowDto.prototype, "lsi_max_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 9,
        description: 'Most specific wins. Defaults by kind when omitted: ITEM 4, ITEM_BRAND 3, ' +
            'ITEM_CATEGORY 2, ITEM_SECTION 1, ITEM_GROUP 0.',
    }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(0, 9),
    __metadata("design:type", Number)
], LoyaltySchemeItemRowDto.prototype, "lsi_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], LoyaltySchemeItemRowDto.prototype, "lsi_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemeItemRowDto.prototype, "lsi_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemeItemRowDto.prototype, "lsi_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemeItemRowDto.prototype, "lsi_modified_by", void 0);
//# sourceMappingURL=save-loyalty-scheme-item.dto.js.map