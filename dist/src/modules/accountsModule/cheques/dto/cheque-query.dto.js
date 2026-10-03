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
exports.DepositSlipQueryDto = exports.ChequeHistoryQueryDto = exports.GetChequeQueryDto = exports.ListChequesQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const cheque_keys_dto_1 = require("./cheque-keys.dto");
class ListChequesQueryDto {
    apdCompanyId;
    apdBranchId;
    apdAccYear;
    status;
    from;
    to;
    bankLedgerId;
    partyId;
    search;
    limit;
    offset;
}
exports.ListChequesQueryDto = ListChequesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "apdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "apdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'HELD,DEPOSITED',
        description: 'Comma-separated ck_apd_status values. Blank means every status.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(120),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-01', description: 'On the INSTRUMENT date.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2027-03-31', description: 'On the INSTRUMENT date.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Cheque number, party name, drawer or drawn-on bank.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], ListChequesQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, minimum: 1, maximum: 2000 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 2000),
    __metadata("design:type", Number)
], ListChequesQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], ListChequesQueryDto.prototype, "offset", void 0);
class GetChequeQueryDto extends cheque_keys_dto_1.ChequeKeysDto {
}
exports.GetChequeQueryDto = GetChequeQueryDto;
class ChequeHistoryQueryDto extends cheque_keys_dto_1.ChequeKeysDto {
}
exports.ChequeHistoryQueryDto = ChequeHistoryQueryDto;
class DepositSlipQueryDto {
    apdCompanyId;
    apdBranchId;
    bankLedgerId;
    depositDate;
    slipNo;
}
exports.DepositSlipQueryDto = DepositSlipQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DepositSlipQueryDto.prototype, "apdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DepositSlipQueryDto.prototype, "apdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DepositSlipQueryDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-15' }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    __metadata("design:type", String)
], DepositSlipQueryDto.prototype, "depositDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, example: 'D-121' }),
    (0, dtoDecorators_1.TrimmedString)(50),
    __metadata("design:type", String)
], DepositSlipQueryDto.prototype, "slipNo", void 0);
//# sourceMappingURL=cheque-query.dto.js.map