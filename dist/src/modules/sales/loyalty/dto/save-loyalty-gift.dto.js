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
exports.SaveLoyaltyGiftDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class SaveLoyaltyGiftDto {
    lsg_id;
    lsg_ls_id;
    lsg_slno;
    lsg_item_id;
    lsg_unit_id;
    lsg_item_qty;
    lsg_redeem_points;
    lsg_repeat;
    lsg_notes;
    lsg_is_active;
    lsg_created_by;
    lsg_updated_by;
}
exports.SaveLoyaltyGiftDto = SaveLoyaltyGiftDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates an existing loyalty gift rule',
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyGiftDto.prototype, "lsg_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((object) => object.lsg_id === undefined || object.lsg_ls_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyGiftDto.prototype, "lsg_ls_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, example: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveLoyaltyGiftDto.prototype, "lsg_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((object) => object.lsg_id === undefined || object.lsg_item_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyGiftDto.prototype, "lsg_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((object) => object.lsg_id === undefined || object.lsg_unit_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyGiftDto.prototype, "lsg_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0.0000001, example: 1 }),
    (0, class_validator_1.ValidateIf)((object) => object.lsg_id === undefined || object.lsg_item_qty !== undefined),
    (0, loyalty_dto_helpers_1.RequiredNumber)(Number.EPSILON),
    __metadata("design:type", Number)
], SaveLoyaltyGiftDto.prototype, "lsg_item_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0, example: 100 }),
    (0, class_validator_1.ValidateIf)((object) => object.lsg_id === undefined || object.lsg_redeem_points !== undefined),
    (0, loyalty_dto_helpers_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltyGiftDto.prototype, "lsg_redeem_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltyGiftDto.prototype, "lsg_repeat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 65535, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], SaveLoyaltyGiftDto.prototype, "lsg_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltyGiftDto.prototype, "lsg_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyGiftDto.prototype, "lsg_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyGiftDto.prototype, "lsg_updated_by", void 0);
//# sourceMappingURL=save-loyalty-gift.dto.js.map