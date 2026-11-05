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
exports.ListTxnHoldQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const txn_hold_api_types_1 = require("../types/txn-hold-api.types");
class ListTxnHoldQueryDto {
    search;
    txhCompanyId;
    txhBranchId;
    txhAccYear;
    txhKind;
    txhSrcModule;
    txhDocType;
    txhStatus;
    txhDeviceId;
    txhCounterId;
    txhSessionId;
    txhHeldBy;
    txhPartyType;
    txhPartyId;
    txhPartyMobile;
    txhStaffId;
    holdOnFrom;
    holdOnTo;
    expired;
    stockReserved;
    page;
    limit;
}
exports.ListTxnHoldQueryDto = ListTxnHoldQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Free-text search on hold no / party name / party mobile / ref label / remarks',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: txn_hold_api_types_1.TxnHoldKind,
        enumName: 'TxnHoldKind',
        description: 'Defaults to no filter — pass HOLD for the operator-facing pick list',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldKind),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: txn_hold_api_types_1.TxnHoldSrcModule, enumName: 'TxnHoldSrcModule' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldSrcModule),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: txn_hold_api_types_1.TxnHoldDocType, enumName: 'TxnHoldDocType' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(30),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldDocType),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: txn_hold_api_types_1.TxnHoldStatus, enumName: 'TxnHoldStatus' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldStatus),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Only work parked on this device' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Only holds taken on this till' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhCounterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Shift close reads this one' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Operator who parked it' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhHeldBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: txn_hold_api_types_1.TxnHoldPartyType, enumName: 'TxnHoldPartyType' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldPartyType),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhPartyType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhPartyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        description: 'Exact match — asked at the counter as often as the name',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhPartyMobile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "txhStaffId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        description: 'Only work parked on or after this instant',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "holdOnFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        description: 'Only work parked on or before this instant',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListTxnHoldQueryDto.prototype, "holdOnTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'true → only holds whose txhExpiresOn has passed; false → only those still valid',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListTxnHoldQueryDto.prototype, "expired", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'true → only holds that still owe stock back (the sweeper’s queue)',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListTxnHoldQueryDto.prototype, "stockReserved", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], ListTxnHoldQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 100, default: 20 }),
    (0, dtoDecorators_1.OptionalInteger)(1, 100),
    __metadata("design:type", Number)
], ListTxnHoldQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=list-txn-hold-query.dto.js.map