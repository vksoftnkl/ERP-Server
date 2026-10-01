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
exports.RunConfiguredGridQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../dto/dtoDecorators");
class RunConfiguredGridQueryDto {
    grid_id;
    search;
    page;
    limit;
    grid_param;
    sort_by;
    sort_dir;
}
exports.RunConfiguredGridQueryDto = RunConfiguredGridQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Numeric grid id', example: '1' }),
    (0, class_validator_1.IsNumberString)({ no_symbols: true }),
    __metadata("design:type", String)
], RunConfiguredGridQueryDto.prototype, "grid_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(200),
    __metadata("design:type", String)
], RunConfiguredGridQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], RunConfiguredGridQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 100, default: 20 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 100),
    __metadata("design:type", Number)
], RunConfiguredGridQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'JSON parameters object to pass dynamic filter values',
        example: '{"branch_id":1,"company_id":2}',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RunConfiguredGridQueryDto.prototype, "grid_param", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Column field name to sort by', example: 'created_at' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z_][a-z0-9_$]*$/i, { message: 'sort_by must be a valid identifier' }),
    __metadata("design:type", String)
], RunConfiguredGridQueryDto.prototype, "sort_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['asc', 'desc'], description: 'Sort direction', default: 'asc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], RunConfiguredGridQueryDto.prototype, "sort_dir", void 0);
//# sourceMappingURL=run-configured-grid-query.dto.js.map