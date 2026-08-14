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
exports.SaveAccountGroupDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveAccountGroupDto {
    accGroupId;
    accGroupName;
    accGroupAlias;
    accGroupShort;
    accGroupDescription;
    accGroupParentId;
    accGroupSort;
}
exports.SaveAccountGroupDto = SaveAccountGroupDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing account group',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveAccountGroupDto.prototype, "accGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, dtoDecorators_1.TrimmedString)(150),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveAccountGroupDto.prototype, "accGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountGroupDto.prototype, "accGroupAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50 }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveAccountGroupDto.prototype, "accGroupShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveAccountGroupDto.prototype, "accGroupDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveAccountGroupDto.prototype, "accGroupParentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveAccountGroupDto.prototype, "accGroupSort", void 0);
//# sourceMappingURL=save-account-group.dto.js.map