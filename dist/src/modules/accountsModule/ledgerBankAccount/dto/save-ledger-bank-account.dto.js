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
exports.SaveLedgerBankAccountDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const class_transformer_1 = require("class-transformer");
const DtoTransforms_1 = require("../../../../common/dto/DtoTransforms");
const dtoDecorators_2 = require("../../../../common/dto/dtoDecorators");
const class_validator_2 = require("class-validator");
class SaveLedgerBankAccountDto {
    lbaId;
    lbaCompanyId;
    lbaLedgerId;
    lbaAccountHolder;
    lbaBankName;
    lbaBranchName;
    lbaAccountNo;
    lbaIfscCode;
    lbaMicrCode;
    lbaAccountType;
    lbaUpiId;
    lbaChequeName;
    lbaIsDefault;
    lbaIsActive;
    lbaRemarks;
}
exports.SaveLedgerBankAccountDto = SaveLedgerBankAccountDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing ledger bank account',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLedgerBankAccountDto.prototype, "lbaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLedgerBankAccountDto.prototype, "lbaLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveLedgerBankAccountDto.prototype, "lbaAccountHolder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveLedgerBankAccountDto.prototype, "lbaBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveLedgerBankAccountDto.prototype, "lbaAccountNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 11, minLength: 11, nullable: true }),
    (0, class_validator_2.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_2.SkipOnNullish)(),
    (0, class_validator_2.IsString)(),
    (0, class_validator_1.Length)(11, 11),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaIfscCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableString)(15),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaMicrCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, class_validator_2.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_2.SkipOnNullish)(),
    (0, class_validator_2.IsString)(),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaAccountType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaUpiId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaChequeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveLedgerBankAccountDto.prototype, "lbaIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveLedgerBankAccountDto.prototype, "lbaIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveLedgerBankAccountDto.prototype, "lbaRemarks", void 0);
//# sourceMappingURL=save-ledger-bank-account.dto.js.map