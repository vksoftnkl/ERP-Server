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
exports.SavePromotionSchemeBranchesDto = exports.PromotionSchemeBranchRowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const promotion_scheme_dto_helpers_1 = require("./promotion-scheme-dto.helpers");
class PromotionSchemeBranchRowDto {
    prb_id;
    prb_slno;
    prb_branch_id;
    prb_is_exclude;
    prb_notes;
    prb_is_active;
    prb_created_by;
    prb_modified_by;
}
exports.PromotionSchemeBranchRowDto = PromotionSchemeBranchRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that row, absent = insert a new one' }),
    (0, promotion_scheme_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], PromotionSchemeBranchRowDto.prototype, "prb_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, promotion_scheme_dto_helpers_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], PromotionSchemeBranchRowDto.prototype, "prb_slno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, class_validator_1.ValidateIf)((o) => o.prb_id === undefined || o.prb_branch_id !== undefined),
    (0, promotion_scheme_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], PromotionSchemeBranchRowDto.prototype, "prb_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'An EXCLUDE row always beats an INCLUDE row for the same branch',
    }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchRowDto.prototype, "prb_is_exclude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, promotion_scheme_dto_helpers_1.NullableString)(65535),
    __metadata("design:type", Object)
], PromotionSchemeBranchRowDto.prototype, "prb_notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, promotion_scheme_dto_helpers_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PromotionSchemeBranchRowDto.prototype, "prb_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemeBranchRowDto.prototype, "prb_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, promotion_scheme_dto_helpers_1.OptionalTrimmedString)(50),
    __metadata("design:type", String)
], PromotionSchemeBranchRowDto.prototype, "prb_modified_by", void 0);
class SavePromotionSchemeBranchesDto {
    prm_id;
    branches;
}
exports.SavePromotionSchemeBranchesDto = SavePromotionSchemeBranchesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, promotion_scheme_dto_helpers_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePromotionSchemeBranchesDto.prototype, "prm_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PromotionSchemeBranchRowDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PromotionSchemeBranchRowDto),
    __metadata("design:type", Array)
], SavePromotionSchemeBranchesDto.prototype, "branches", void 0);
//# sourceMappingURL=save-promotion-scheme-branch.dto.js.map