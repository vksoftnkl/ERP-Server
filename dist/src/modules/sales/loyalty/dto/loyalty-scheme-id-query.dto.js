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
exports.LoyaltySchemeEligibilityQueryDto = exports.DeleteLoyaltySchemeQueryDto = exports.LoyaltySchemeIdQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class LoyaltySchemeIdQueryDto {
    lsc_id;
}
exports.LoyaltySchemeIdQueryDto = LoyaltySchemeIdQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeIdQueryDto.prototype, "lsc_id", void 0);
class DeleteLoyaltySchemeQueryDto extends LoyaltySchemeIdQueryDto {
    lsc_modified_by;
}
exports.DeleteLoyaltySchemeQueryDto = DeleteLoyaltySchemeQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        description: 'Stamped onto lsc_modified_by; falls back to the authenticated user',
    }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], DeleteLoyaltySchemeQueryDto.prototype, "lsc_modified_by", void 0);
class LoyaltySchemeEligibilityQueryDto extends LoyaltySchemeIdQueryDto {
    cus_id;
}
exports.LoyaltySchemeEligibilityQueryDto = LoyaltySchemeEligibilityQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'sales.customers(cus_id) — the customer on the bill',
    }),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeEligibilityQueryDto.prototype, "cus_id", void 0);
//# sourceMappingURL=loyalty-scheme-id-query.dto.js.map