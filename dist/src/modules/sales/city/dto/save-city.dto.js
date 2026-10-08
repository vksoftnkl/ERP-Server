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
exports.SaveCityDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveCityDto {
    ctmId;
    ctmName;
    ctmAlias;
    ctmShort;
    ctmStateId;
    ctmOrder;
    ctmDescription;
    ctmIsActive;
    ctmCreatedBy;
    ctmModifiedBy;
}
exports.SaveCityDto = SaveCityDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing city',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveCityDto.prototype, "ctmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, dtoDecorators_1.TrimmedString)(150),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveCityDto.prototype, "ctmName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCityDto.prototype, "ctmAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveCityDto.prototype, "ctmShort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveCityDto.prototype, "ctmStateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Number)
], SaveCityDto.prototype, "ctmOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Free-text description' }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveCityDto.prototype, "ctmDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCityDto.prototype, "ctmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCityDto.prototype, "ctmCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveCityDto.prototype, "ctmModifiedBy", void 0);
//# sourceMappingURL=save-city.dto.js.map