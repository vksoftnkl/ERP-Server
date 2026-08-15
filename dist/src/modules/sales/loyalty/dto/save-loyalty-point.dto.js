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
exports.SaveLoyaltyPointDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class SaveLoyaltyPointDto {
    lspt_id;
    lspt_ls_id;
    lspt_slno;
    lspt_item_id;
    lspt_unit_id;
    lspt_exceeds;
    lspt_each;
    lspt_factor;
    lspt_points;
    lspt_is_active;
    lspt_notes;
    lspt_created_by;
    lspt_updated_by;
}
exports.SaveLoyaltyPointDto = SaveLoyaltyPointDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When provided, updates an existing loyalty point slab',
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    }),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyPointDto.prototype, "lspt_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((object) => object.lspt_id === undefined || object.lspt_ls_id !== undefined),
    (0, loyalty_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLoyaltyPointDto.prototype, "lspt_ls_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, example: 1 }),
    (0, loyalty_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveLoyaltyPointDto.prototype, "lspt_slno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyPointDto.prototype, "lspt_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyPointDto.prototype, "lspt_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltyPointDto.prototype, "lspt_exceeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0.0000001, default: 1 }),
    (0, loyalty_dto_helpers_1.OptionalNumber)(Number.EPSILON),
    __metadata("design:type", Number)
], SaveLoyaltyPointDto.prototype, "lspt_each", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, loyalty_dto_helpers_1.toOptionalNumber)(value)),
    __metadata("design:type", Number)
], SaveLoyaltyPointDto.prototype, "lspt_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0, example: 10 }),
    (0, class_validator_1.ValidateIf)((object) => object.lspt_id === undefined || object.lspt_points !== undefined),
    (0, loyalty_dto_helpers_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveLoyaltyPointDto.prototype, "lspt_points", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, loyalty_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaveLoyaltyPointDto.prototype, "lspt_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 65535, nullable: true }),
    (0, loyalty_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], SaveLoyaltyPointDto.prototype, "lspt_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyPointDto.prototype, "lspt_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, loyalty_dto_helpers_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLoyaltyPointDto.prototype, "lspt_updated_by", void 0);
//# sourceMappingURL=save-loyalty-point.dto.js.map