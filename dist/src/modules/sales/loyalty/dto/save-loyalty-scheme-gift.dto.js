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
exports.LoyaltySchemeGiftRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class LoyaltySchemeGiftRowDto {
    lsg_id;
    lsg_slno;
    lsg_item_id;
    lsg_unit_id;
    lsg_item_qty;
    lsg_redeem_points;
    lsg_repeat;
    lsg_max_qty_per_bill;
    lsg_stock_check;
    lsg_valid_from;
    lsg_valid_upto;
    lsg_notes;
    lsg_is_active;
    lsg_created_by;
    lsg_modified_by;
}
exports.LoyaltySchemeGiftRowDto = LoyaltySchemeGiftRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftRowDto.prototype, "lsg_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], LoyaltySchemeGiftRowDto.prototype, "lsg_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((o) => o.lsg_id === undefined || o.lsg_item_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftRowDto.prototype, "lsg_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'inventory.item_unit_conversion(iuc_id), as on a bill line',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.lsg_id === undefined || o.lsg_unit_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltySchemeGiftRowDto.prototype, "lsg_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, description: 'How much stock one claim hands over' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeGiftRowDto.prototype, "lsg_item_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'What the claim costs in points' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeGiftRowDto.prototype, "lsg_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Claimable more than once' }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftRowDto.prototype, "lsg_repeat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: '0 = uncapped' }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], LoyaltySchemeGiftRowDto.prototype, "lsg_max_qty_per_bill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Refuse the claim when the issuing branch has no stock of it — a gift the shop cannot ' +
            'hand over is worse than one it never offered',
    }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftRowDto.prototype, "lsg_stock_check", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2025-10-01' }),
    (0, loyalty_dto_helpers_1.NullableDateString)(),
    __metadata("design:type", Object)
], LoyaltySchemeGiftRowDto.prototype, "lsg_valid_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2025-10-31' }),
    (0, loyalty_dto_helpers_1.NullableDateString)(),
    __metadata("design:type", Object)
], LoyaltySchemeGiftRowDto.prototype, "lsg_valid_upto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], LoyaltySchemeGiftRowDto.prototype, "lsg_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltySchemeGiftRowDto.prototype, "lsg_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemeGiftRowDto.prototype, "lsg_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, loyalty_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], LoyaltySchemeGiftRowDto.prototype, "lsg_modified_by", void 0);
//# sourceMappingURL=save-loyalty-scheme-gift.dto.js.map