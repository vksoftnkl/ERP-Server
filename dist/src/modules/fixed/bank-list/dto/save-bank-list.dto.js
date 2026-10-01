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
exports.SaveBankListDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveBankListDto {
    bnkId;
    bnkName;
    bnkShortName;
    bnkAlias;
    bnkRbiCode;
    bnkIbanSupported;
    bnkIsActive;
    bnkCreatedBy;
    bnkModifiedBy;
}
exports.SaveBankListDto = SaveBankListDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing bank row',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveBankListDto.prototype, "bnkId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveBankListDto.prototype, "bnkName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 80, nullable: true }),
    (0, dtoDecorators_1.NullableString)(80),
    __metadata("design:type", Object)
], SaveBankListDto.prototype, "bnkShortName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableString)(120),
    __metadata("design:type", Object)
], SaveBankListDto.prototype, "bnkAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveBankListDto.prototype, "bnkRbiCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBankListDto.prototype, "bnkIbanSupported", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveBankListDto.prototype, "bnkIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBankListDto.prototype, "bnkCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveBankListDto.prototype, "bnkModifiedBy", void 0);
//# sourceMappingURL=save-bank-list.dto.js.map