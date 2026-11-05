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
exports.SaveTxnHoldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const txn_hold_api_types_1 = require("../types/txn-hold-api.types");
const ACC_YEAR_LENGTH = 9;
class SaveTxnHoldDto {
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
    txhStatus;
    txhHoldReason;
    txhRemarks;
    txhExpiresOn;
    txhIsStockReserved;
    txhPrintCount;
    txhLastPrintedOn;
    txhSyncDate;
    txhCreatedBy;
    txhModifiedBy;
}
exports.SaveTxnHoldDto = SaveTxnHoldDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates that hold; otherwise a new hold is created',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required on create, immutable afterwards' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required on create, immutable afterwards' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: ACC_YEAR_LENGTH,
        maxLength: ACC_YEAR_LENGTH,
        example: '2026-2027',
        description: 'Accounting year the parked work belongs to. Half the primary key and the ' +
            'partition key: required on create, immutable afterwards',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(ACC_YEAR_LENGTH),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: txn_hold_api_types_1.TxnHoldKind,
        enumName: 'TxnHoldKind',
        default: txn_hold_api_types_1.TxnHoldKind.HOLD,
        description: 'HOLD appears in the pick list; AUTOSAVE is the screen’s crash-recovery snapshot and is ' +
            'overwritten in place (one live row per device / operator / document type); TEMPLATE is ' +
            'copied on resume and never consumed',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldKind),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: txn_hold_api_types_1.TxnHoldSrcModule,
        enumName: 'TxnHoldSrcModule',
        description: 'Module the parked screen belongs to. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldSrcModule),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: txn_hold_api_types_1.TxnHoldDocType,
        enumName: 'TxnHoldDocType',
        description: 'Document this hold will become. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(30),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldDocType),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Printed token number, generated by the till. Optional — only a HOLD prints a slip, so ' +
            'an AUTOSAVE or TEMPLATE may leave it null. When present, unique per company / branch / ' +
            'accounting year / document type. Stored upper-cased',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(30),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhHoldNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        nullable: true,
        description: 'Raw per-device counter behind txhHoldNo, so an offline till can number a hold with no ' +
            'server round trip. Optional, and null whenever txhHoldNo is. When present, unique per ' +
            'device / year / document type',
    }),
    (0, dtoDecorators_1.NullableInteger)(1),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhHoldSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        description: 'When the work was parked. Defaults to now',
    }),
    (0, dtoDecorators_1.OptionalDate)(),
    __metadata("design:type", Date)
], SaveTxnHoldDto.prototype, "txhHoldOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'fixed.device_master.dev_id — the till that parked the work and owns its number series. ' +
            'Required on create',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'Till / cash counter' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhCounterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'Shift / day session' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Operator at the screen. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhHeldBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: txn_hold_api_types_1.TxnHoldPartyType,
        enumName: 'TxnHoldPartyType',
        nullable: true,
        description: 'Which master txhPartyId points into; required once txhPartyId is set',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldPartyType),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhPartyType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Customer / supplier / employee / ledger / branch (polymorphic — no FK)',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhPartyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 150,
        nullable: true,
        description: 'Snapshot for the pick list; a walk-in has a name and no party row at all',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhPartyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhPartyMobile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'public.employee_master.emp_id — salesman, buyer or technician on the document',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhStaffId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Free label the floor recognises the hold by: table 7, bay 3, locker 12',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhRefLabel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Lines parked with the hold' }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTxnHoldDto.prototype, "txhItemCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTxnHoldDto.prototype, "txhTotalQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTxnHoldDto.prototype, "txhNetAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'object',
        additionalProperties: true,
        description: 'The module’s own save body, verbatim — header, items, charges, tenders, screen state. ' +
            'Required, and must be an object (ck_txh_payload_object): this module never reads into it',
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhPayload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        default: 1,
        description: 'Version of the payload’s own shape, so an old hold stays readable after upgrade',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveTxnHoldDto.prototype, "txhPayloadVersion", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: txn_hold_api_types_1.TxnHoldStatus,
        enumName: 'TxnHoldStatus',
        default: txn_hold_api_types_1.TxnHoldStatus.HELD,
        description: 'CONVERTED / EXPIRED / CANCELLED / ABANDONED are terminal — a hold in one of them cannot ' +
            'be reopened. The lease endpoints, not this payload, are what normally move it',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(txn_hold_api_types_1.TxnHoldStatus),
    __metadata("design:type", String)
], SaveTxnHoldDto.prototype, "txhStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Why it was parked' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhHoldReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When the sweeper may retire it; must be after txhHoldOn. Null keeps the hold until ' +
            'someone acts on it',
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhExpiresOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Does this hold owe stock back? A flag only — the reserved quantities live in the payload, ' +
            'and the sweeper must release the reservation before it retires the row',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTxnHoldDto.prototype, "txhIsStockReserved", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, default: 0, description: 'Token slips printed' }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTxnHoldDto.prototype, "txhPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Set exactly when txhPrintCount is non-zero (ck_txh_printed)',
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhLastPrintedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When this row was pushed by an offline device; null means still pending',
    }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Actor id or name; defaults to the caller',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Actor id or name; defaults to the caller',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveTxnHoldDto.prototype, "txhModifiedBy", void 0);
//# sourceMappingURL=save-txn-hold.dto.js.map