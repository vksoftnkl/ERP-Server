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
exports.TxnHoldSuccessDeleteDto = exports.TxnHoldSuccessListDto = exports.TxnHoldSuccessSingleDto = exports.TxnHoldDeleteResultDto = exports.TxnHoldListMetaDto = exports.TxnHoldPayloadDto = exports.TxnHoldErrorResponseDto = exports.TxnHoldErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const txn_hold_api_types_1 = require("../types/txn-hold-api.types");
class TxnHoldErrorFieldDto {
    field;
    message;
}
exports.TxnHoldErrorFieldDto = TxnHoldErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'txhHoldNo' }),
    __metadata("design:type", String)
], TxnHoldErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'txhHoldNo must be provided when creating a hold' }),
    __metadata("design:type", String)
], TxnHoldErrorFieldDto.prototype, "message", void 0);
class TxnHoldErrorResponseDto {
    success;
    message;
    errors;
}
exports.TxnHoldErrorResponseDto = TxnHoldErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TxnHoldErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], TxnHoldErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TxnHoldErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], TxnHoldErrorResponseDto.prototype, "errors", void 0);
class TxnHoldPayloadDto {
    txhId;
    txhCompanyId;
    txhBranchId;
    txhTenantId;
    txhAccYear;
    txhKind;
    txhSrcModule;
    txhDocType;
    txhHoldNo;
    txhHoldSlno;
    txhHoldOn;
    txhDeviceId;
    txhCounterId;
    txhSessionId;
    txhHeldBy;
    txhPartyType;
    txhPartyId;
    txhPartyName;
    txhPartyMobile;
    txhStaffId;
    txhRefLabel;
    txhItemCount;
    txhTotalQty;
    txhNetAmount;
    txhPayload;
    txhPayloadVersion;
    txhRevision;
    txhStatus;
    txhHoldReason;
    txhRemarks;
    txhExpiresOn;
    txhLockedBy;
    txhLockedDeviceId;
    txhLockedOn;
    txhLockExpiresOn;
    txhLockToken;
    txhResumedBy;
    txhResumedOn;
    txhResumeCount;
    txhConvertedDocId;
    txhConvertedAccYear;
    txhConvertedRefno;
    txhConvertedOn;
    txhConvertedBy;
    txhIsStockReserved;
    txhPrintCount;
    txhLastPrintedOn;
    txhIsDeleted;
    txhSyncDate;
    txhCreatedOn;
    txhCreatedBy;
    txhModifiedOn;
    txhModifiedBy;
}
exports.TxnHoldPayloadDto = TxnHoldPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: 'Accounting year — half the primary key' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: txn_hold_api_types_1.TxnHoldKind, enumName: 'TxnHoldKind' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhKind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: txn_hold_api_types_1.TxnHoldSrcModule, enumName: 'TxnHoldSrcModule' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: txn_hold_api_types_1.TxnHoldDocType, enumName: 'TxnHoldDocType' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Printed on the token slip. Null on a hold that was never numbered',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhHoldNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        nullable: true,
        description: 'Per-device counter behind txhHoldNo. Null whenever txhHoldNo is',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhHoldSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhHoldOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'fixed.device_master.dev_id' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhCounterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhSessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Operator who parked it' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhHeldBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: txn_hold_api_types_1.TxnHoldPartyType, enumName: 'TxnHoldPartyType', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhPartyType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhPartyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhPartyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhPartyMobile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhStaffId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhRefLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhItemCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhTotalQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhNetAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'object',
        additionalProperties: true,
        description: 'The module’s own save body, stored and returned verbatim',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhPayload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1 }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhPayloadVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, description: 'Bumped on every overwrite of the same hold' }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: txn_hold_api_types_1.TxnHoldStatus, enumName: 'TxnHoldStatus' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhHoldReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhExpiresOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Operator holding the lease while txhStatus is LOCKED',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhLockedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Device holding the lease — this is what release and convert match on',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhLockedDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhLockedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'date-time',
        nullable: true,
        description: 'Once past, the next device may resume the hold without a force-release',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhLockExpiresOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Proves the holder; send it back on release / convert',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhLockToken", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhResumedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhResumedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhResumeCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhConvertedDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-2027',
        nullable: true,
        description: 'That document’s year — may differ from txhAccYear',
    }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhConvertedAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhConvertedRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhConvertedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhConvertedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Does this hold still owe stock back?' }),
    __metadata("design:type", Boolean)
], TxnHoldPayloadDto.prototype, "txhIsStockReserved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    __metadata("design:type", Number)
], TxnHoldPayloadDto.prototype, "txhPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhLastPrintedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TxnHoldPayloadDto.prototype, "txhIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    __metadata("design:type", String)
], TxnHoldPayloadDto.prototype, "txhCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], TxnHoldPayloadDto.prototype, "txhModifiedBy", void 0);
class TxnHoldListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.TxnHoldListMetaDto = TxnHoldListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], TxnHoldListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], TxnHoldListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], TxnHoldListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], TxnHoldListMetaDto.prototype, "total_pages", void 0);
class TxnHoldDeleteResultDto {
    txhId;
    deleted;
}
exports.TxnHoldDeleteResultDto = TxnHoldDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TxnHoldDeleteResultDto.prototype, "txhId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TxnHoldDeleteResultDto.prototype, "deleted", void 0);
class TxnHoldSuccessSingleDto {
    success;
    message;
    data;
}
exports.TxnHoldSuccessSingleDto = TxnHoldSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TxnHoldSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Hold fetched successfully' }),
    __metadata("design:type", String)
], TxnHoldSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TxnHoldPayloadDto }),
    __metadata("design:type", TxnHoldPayloadDto)
], TxnHoldSuccessSingleDto.prototype, "data", void 0);
class TxnHoldSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.TxnHoldSuccessListDto = TxnHoldSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TxnHoldSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Holds fetched successfully' }),
    __metadata("design:type", String)
], TxnHoldSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TxnHoldPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], TxnHoldSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TxnHoldListMetaDto }),
    __metadata("design:type", TxnHoldListMetaDto)
], TxnHoldSuccessListDto.prototype, "meta", void 0);
class TxnHoldSuccessDeleteDto {
    success;
    message;
    data;
}
exports.TxnHoldSuccessDeleteDto = TxnHoldSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TxnHoldSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Hold deleted successfully' }),
    __metadata("design:type", String)
], TxnHoldSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TxnHoldDeleteResultDto }),
    __metadata("design:type", TxnHoldDeleteResultDto)
], TxnHoldSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=txn-hold-response.dto.js.map