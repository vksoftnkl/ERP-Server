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
exports.SaveLoyaltyPartyDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
const LOYALTY_PARTY_SCOPE_TYPES = ['CUSTOMER_GROUP', 'CUSTOMER'];
class SaveLoyaltyPartyDto {
    lps_id;
    lps_ls_id;
    lps_slno;
    lps_scope_type;
    lps_scope_id;
    lps_is_exclude;
    lps_notes;
    lps_is_active;
    lps_created_by;
    lps_updated_by;
}
exports.SaveLoyaltyPartyDto = SaveLoyaltyPartyDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates an existing loyalty party scope row',
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyPartyDto.prototype, "lps_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyPartyDto.prototype, "lps_ls_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, example: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveLoyaltyPartyDto.prototype, "lps_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CUSTOMER_GROUP', enum: LOYALTY_PARTY_SCOPE_TYPES }),
    (0, class_validator_1.ValidateIf)((object) => object.lps_id === undefined || object.lps_scope_type !== undefined),
    (0, loyalty_dto_helpers_1.TrimmedString)(30),
    (0, class_validator_1.IsIn)(LOYALTY_PARTY_SCOPE_TYPES),
    __metadata("design:type", String)
], SaveLoyaltyPartyDto.prototype, "lps_scope_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((object) => object.lps_id === undefined || object.lps_scope_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyPartyDto.prototype, "lps_scope_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltyPartyDto.prototype, "lps_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 65535, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], SaveLoyaltyPartyDto.prototype, "lps_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltyPartyDto.prototype, "lps_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyPartyDto.prototype, "lps_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyPartyDto.prototype, "lps_updated_by", void 0);
//# sourceMappingURL=save-loyalty-party.dto.js.map