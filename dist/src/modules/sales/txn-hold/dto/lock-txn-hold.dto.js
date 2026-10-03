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
exports.ConvertTxnHoldDto = exports.LockTxnHoldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const txn_hold_api_types_1 = require("../types/txn-hold-api.types");
class LockTxnHoldDto {
    txhCompanyId;
    txhBranchId;
    txhAccYear;
    lockTtlSeconds;
    txhLockToken;
}
exports.LockTxnHoldDto = LockTxnHoldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Company the hold was parked in' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LockTxnHoldDto.prototype, "txhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Branch the hold was parked in' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LockTxnHoldDto.prototype, "txhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        example: '2026-2027',
        description: 'Accounting year the hold was parked in; prunes the lookup to one partition',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], LockTxnHoldDto.prototype, "txhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: txn_hold_api_types_1.TXN_HOLD_LOCK_TTL_SECONDS_MIN,
        maximum: txn_hold_api_types_1.TXN_HOLD_LOCK_TTL_SECONDS_MAX,
        default: txn_hold_api_types_1.TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT,
        description: 'How long the lease is good for. Once it lapses the next device may resume the hold ' +
            'without a force-release — which is what stops a till that died mid-edit from stranding ' +
            'the cart. Ignored on release',
    }),
    (0, dtoDecorators_1.OptionalInteger)(txn_hold_api_types_1.TXN_HOLD_LOCK_TTL_SECONDS_MIN, txn_hold_api_types_1.TXN_HOLD_LOCK_TTL_SECONDS_MAX),
    __metadata("design:type", Number)
], LockTxnHoldDto.prototype, "lockTtlSeconds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The token resume answered with. Optional — the device must match anyway — but when sent ' +
            'it is checked, so a till cannot spend a lease that was force-released out from under it',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], LockTxnHoldDto.prototype, "txhLockToken", void 0);
class ConvertTxnHoldDto extends LockTxnHoldDto {
    txhConvertedDocId;
    txhConvertedAccYear;
    txhConvertedRefno;
    txhConvertedBy;
}
exports.ConvertTxnHoldDto = ConvertTxnHoldDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'Id of the document the hold became (polymorphic — no FK)',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ConvertTxnHoldDto.prototype, "txhConvertedDocId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        minLength: 9,
        maxLength: 9,
        example: '2026-2027',
        description: 'Accounting year of that document — may differ from the hold’s',
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], ConvertTxnHoldDto.prototype, "txhConvertedAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'That document’s number' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], ConvertTxnHoldDto.prototype, "txhConvertedRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Operator who converted it; defaults to the caller',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ConvertTxnHoldDto.prototype, "txhConvertedBy", void 0);
//# sourceMappingURL=lock-txn-hold.dto.js.map