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
exports.SaveBillAdjustmentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveBillAdjustmentDto {
    againstBillId;
    againstBillAccYear;
    amount;
    remarks;
    billType;
    adjType;
    settlementMode;
}
exports.SaveBillAdjustmentDto = SaveBillAdjustmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'accounts.acc_bill_balance.abl_id of the credit being adjusted, taken straight from ' +
            'GET /transactions/party-balance. Must be an open CR credit belonging to this bill’s customer.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveBillAdjustmentDto.prototype, "againstBillId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minLength: 9,
        maxLength: 9,
        description: 'The credit’s OWN accounting year (its billAccYear from the same list) — not this bill’s. ' +
            'acc_bill_balance is partitioned by year and keyed on (abl_id, abl_acc_year), so the pair is ' +
            'what the foreign key needs; ck_abj_against_bill_pair rejects one without the other.',
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], SaveBillAdjustmentDto.prototype, "againstBillAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 0.01,
        description: 'How much of the credit this bill takes off it. Must be positive and no more than the ' +
            'credit’s pendingAmount at the moment of saving — which the server re-reads under a row ' +
            'lock, because another counter may have spent it since the panel was fetched.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0.01),
    __metadata("design:type", Number)
], SaveBillAdjustmentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveBillAdjustmentDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        description: 'Echo of the credit’s billType. Ignored — the server reads it off the credit.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveBillAdjustmentDto.prototype, "billType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        description: 'Echo of the derived adjType. Ignored — the server derives it.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveBillAdjustmentDto.prototype, "adjType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        description: 'Echo of the derived settlementMode. Ignored — the server derives it.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], SaveBillAdjustmentDto.prototype, "settlementMode", void 0);
//# sourceMappingURL=save-bill-adjustment.dto.js.map