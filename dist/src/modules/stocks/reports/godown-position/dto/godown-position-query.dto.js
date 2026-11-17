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
exports.GodownPositionBehindDto = exports.GodownPositionExportDto = exports.GodownPositionQueryDto = exports.GodownPositionScopeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../../common/dto/dtoDecorators");
const godown_position_types_1 = require("../types/godown-position.types");
const upper = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
const trimmed = ({ value }) => typeof value === 'string' ? value.trim() : value;
const LowerCaseId = () => (0, class_transformer_1.Transform)(lower);
class GodownPositionScopeDto {
    companyId;
    branchId;
    qtyIn;
    bucket;
}
exports.GodownPositionScopeDto = GodownPositionScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Any company (as the Stock Summary).' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionScopeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'One branch: branch_master.br_comp_id must be companyId.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionScopeDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: godown_position_types_1.POSITION_QTY_IN,
        default: 'SELLING',
        description: "SELLING = each item's selling unit (iuc_is_default_unit, else the base unit; Q16), BASE = the base unit.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(godown_position_types_1.POSITION_QTY_IN),
    __metadata("design:type", String)
], GodownPositionScopeDto.prototype, "qtyIn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: godown_position_types_1.POSITION_BUCKETS,
        default: 'SALEABLE',
        description: 'The stock bucket the figures count. ALL = every bucket.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(godown_position_types_1.POSITION_BUCKETS),
    __metadata("design:type", String)
], GodownPositionScopeDto.prototype, "bucket", void 0);
class GodownPositionQueryDto extends GodownPositionScopeDto {
    godownId;
    groupId;
    brandId;
    onlyToGive;
    hideZero;
    find;
}
exports.GodownPositionQueryDto = GodownPositionQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'One godown of the branch (gdl_branch_id). Absent = all godowns of the branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionQueryDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Item filter: the group and its subtree.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionQueryDto.prototype, "groupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Item filter: the brand and its subtree.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionQueryDto.prototype, "brandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Only rows with goods to give (Billed not delivered ≠ 0).',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GodownPositionQueryDto.prototype, "onlyToGive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Hide rows whose Owned, Billed not delivered, Reserved and Challan out are all 0.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GodownPositionQueryDto.prototype, "hideZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        description: 'Item code / name / barcode contains (any case).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(trimmed),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GodownPositionQueryDto.prototype, "find", void 0);
class GodownPositionExportDto extends GodownPositionQueryDto {
}
exports.GodownPositionExportDto = GodownPositionExportDto;
class GodownPositionBehindDto extends GodownPositionScopeDto {
    itemId;
    godownId;
    kind;
}
exports.GodownPositionBehindDto = GodownPositionBehindDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionBehindDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'A godown of the branch.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    LowerCaseId(),
    __metadata("design:type", String)
], GodownPositionBehindDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: godown_position_types_1.BEHIND_KINDS,
        description: 'BND = the open bill lines behind Billed not delivered; CHALLAN = the open challan lines.',
    }),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(godown_position_types_1.BEHIND_KINDS),
    __metadata("design:type", String)
], GodownPositionBehindDto.prototype, "kind", void 0);
//# sourceMappingURL=godown-position-query.dto.js.map