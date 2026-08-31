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
exports.LoyaltySchemePartyRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
const loyalty_utils_1 = require("../utils/loyalty.utils");
class LoyaltySchemePartyRowDto {
    lsp_id;
    lsp_slno;
    lsp_kind;
    lsp_scope_id;
    lsp_is_exclude;
    lsp_match_priority;
    lsp_notes;
    lsp_is_active;
    lsp_created_by;
    lsp_modified_by;
}
exports.LoyaltySchemePartyRowDto = LoyaltySchemePartyRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltySchemePartyRowDto.prototype, "lsp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], LoyaltySchemePartyRowDto.prototype, "lsp_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: loyalty_utils_1.LSP_KINDS, example: 'CUSTOMER_GROUP' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsp_id === undefined || o.lsp_kind !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(20),
    __metadata("design:type", String)
], LoyaltySchemePartyRowDto.prototype, "lsp_kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'The customer or the customer group — whichever lsp_kind names',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.lsp_id === undefined || o.lsp_scope_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltySchemePartyRowDto.prototype, "lsp_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'An EXCLUDE row beats an INCLUDE row at equal priority',
    }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemePartyRowDto.prototype, "lsp_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        maximum: 9,
        description: 'Narrowest wins. Defaults by kind when omitted: CUSTOMER 2, CUSTOMER_GROUP 1.',
    }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(0, 9),
    __metadata("design:type", Number)
], LoyaltySchemePartyRowDto.prototype, "lsp_match_priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], LoyaltySchemePartyRowDto.prototype, "lsp_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemePartyRowDto.prototype, "lsp_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemePartyRowDto.prototype, "lsp_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemePartyRowDto.prototype, "lsp_modified_by", void 0);
//# sourceMappingURL=save-loyalty-scheme-party.dto.js.map