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
exports.SaveItemReorderDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveItemReorderDto {
    ir_id;
    ir_branch_id;
    ir_item_id;
    ir_unit_id;
    ir_godown_id;
    ir_sl_no;
    ir_min_level;
    ir_max_level;
    ir_reorder_level;
    ir_reorder_qty;
    ir_lead_time_days;
    ir_review_cycle_days;
    ir_reorder_days;
    ir_expiry_buffer_days;
    ir_reorder_type;
    ir_is_active;
    ir_created_by;
    ir_modified_by;
    ir_remarks;
}
exports.SaveItemReorderDto = SaveItemReorderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing item reorder row',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveItemReorderDto.prototype, "ir_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemReorderDto.prototype, "ir_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toTrimmedString)(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveItemReorderDto.prototype, "ir_item_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemReorderDto.prototype, "ir_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveItemReorderDto.prototype, "ir_godown_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_sl_no", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_min_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_max_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_reorder_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_reorder_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_lead_time_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_review_cycle_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_reorder_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveItemReorderDto.prototype, "ir_expiry_buffer_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, default: 'MIN_MAX' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveItemReorderDto.prototype, "ir_reorder_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveItemReorderDto.prototype, "ir_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveItemReorderDto.prototype, "ir_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveItemReorderDto.prototype, "ir_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveItemReorderDto.prototype, "ir_remarks", void 0);
//# sourceMappingURL=save-item-reorder.dto.js.map