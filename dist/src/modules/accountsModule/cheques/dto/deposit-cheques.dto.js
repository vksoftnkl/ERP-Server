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
exports.DepositChequesDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const cheque_keys_dto_1 = require("./cheque-keys.dto");
class DepositChequesDto {
    cheques;
    apdCompanyId;
    apdBranchId;
    bankLedgerId;
    depositDate;
    slipNo;
    remarks;
}
exports.DepositChequesDto = DepositChequesDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => cheque_keys_dto_1.ChequeRefDto,
        isArray: true,
        description: 'The cheques on this slip. Every one must be HELD.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => cheque_keys_dto_1.ChequeRefDto),
    __metadata("design:type", Array)
], DepositChequesDto.prototype, "cheques", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DepositChequesDto.prototype, "apdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DepositChequesDto.prototype, "apdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A live BANK ledger of this company. Overwrites apd_bank_ledger_id: the bank a cheque ' +
            'actually went into may not be the one the receipt guessed when it was taken.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DepositChequesDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-09-15',
        description: "On or after every cheque's own instrument date, and not in the future. Banking a cheque " +
            'before the day written on it is how one comes back marked "post-dated presented early".',
    }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], DepositChequesDto.prototype, "depositDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 50,
        example: 'D-121',
        description: "The bank's own slip number. Also the key /cheques/deposit-slip prints from.",
    }),
    (0, dtoDecorators_1.TrimmedString)(50),
    __metadata("design:type", String)
], DepositChequesDto.prototype, "slipNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", Object)
], DepositChequesDto.prototype, "remarks", void 0);
//# sourceMappingURL=deposit-cheques.dto.js.map