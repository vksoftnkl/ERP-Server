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
exports.DepositSlipKeyDto = exports.ChequeRemarksDto = exports.ChequeAllocationDto = exports.ChequeRefDto = exports.ChequeKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class ChequeKeysDto {
    apdId;
    apdAccYear;
    apdCompanyId;
    apdBranchId;
}
exports.ChequeKeysDto = ChequeKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_pdc_register.apd_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeKeysDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The year the cheque was RECEIVED in — the partition key, not the year it clears in.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ChequeKeysDto.prototype, "apdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeKeysDto.prototype, "apdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeKeysDto.prototype, "apdBranchId", void 0);
class ChequeRefDto {
    apdId;
    apdAccYear;
}
exports.ChequeRefDto = ChequeRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeRefDto.prototype, "apdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ChequeRefDto.prototype, "apdAccYear", void 0);
class ChequeAllocationDto {
    billId;
    billAccYear;
    amount;
    discount;
    writeoff;
    writeoffApprovedBy;
}
exports.ChequeAllocationDto = ChequeAllocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ChequeAllocationDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The bill is keyed on (id, year) — the table is partitioned, so both travel.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ChequeAllocationDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 12500,
        minimum: 0,
        description: "This bill's settlement by this cheque, EXCLUDING discount and write-off.",
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], ChequeAllocationDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], ChequeAllocationDto.prototype, "discount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], ChequeAllocationDto.prototype, "writeoff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        required: false,
        format: 'uuid',
        nullable: true,
        description: 'Who authorised the write-off. Required whenever writeoff > 0 and above ' +
            'accounts.writeoff_approval_above — whose default of 0 means always.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], ChequeAllocationDto.prototype, "writeoffApprovedBy", void 0);
class ChequeRemarksDto {
    remarks;
}
exports.ChequeRemarksDto = ChequeRemarksDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", Object)
], ChequeRemarksDto.prototype, "remarks", void 0);
class DepositSlipKeyDto {
    slipNo;
}
exports.DepositSlipKeyDto = DepositSlipKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, example: 'D-121' }),
    (0, dtoDecorators_1.TrimmedString)(50),
    __metadata("design:type", String)
], DepositSlipKeyDto.prototype, "slipNo", void 0);
//# sourceMappingURL=cheque-keys.dto.js.map