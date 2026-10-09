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
exports.TillDenominationListQueryDto = exports.TillMasterKeyQueryDto = exports.SaveTillApprovalAuthorityDto = exports.SaveTillApprovalRuleDto = exports.SaveTillDenominationDto = exports.SaveTillReasonDto = exports.SaveTillSafeDto = exports.SaveTillCounterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
class SaveTillCounterDto {
    tcnId;
    tcnCompanyId;
    tcnBranchId;
    tcnCode;
    tcnName;
    tcnKind;
    tcnDrawerMode;
    tcnDeviceId;
    tcnSafeId;
    tcnDefaultFloat;
    tcnCashAlertLimit;
    tcnCashBlockLimit;
    tcnRequiresSession;
    tcnSortOrder;
    tcnRemarks;
    tcnIsActive;
}
exports.SaveTillCounterDto = SaveTillCounterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'C01',
        description: 'Unique in the branch; printed in every session number.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Counter 1' }),
    (0, dtoDecorators_1.TrimmedString)(100),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: [
            'POS',
            'EXPRESS',
            'RETURNS_DESK',
            'SERVICE_DESK',
            'CASH_OFFICE',
            'MOBILE',
            'SELF_CHECKOUT',
        ],
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['DRAWER', 'TRAY', 'NONE'],
        description: 'TRAY = a cash insert that travels with the cashier; NONE = a cashless lane (nothing counted).',
    }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", String)
], SaveTillCounterDto.prototype, "tcnDrawerMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'fixed.device_master — Desktop / Mobile only, one counter per device. NULL = unlinked: a device picks it from the free list for one session at a time, and nothing is written here.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTillCounterDto.prototype, "tcnDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Where its cash goes; NULL = the branch default safe.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTillCounterDto.prototype, "tcnSafeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 2000,
        description: 'The float an ISSUED open counts out by default.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillCounterDto.prototype, "tcnDefaultFloat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0 = off; above it the till shows "pickup due".' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillCounterDto.prototype, "tcnCashAlertLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '0 = off; above it billing stops until a pickup. Not below the alert limit.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillCounterDto.prototype, "tcnCashBlockLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'false = money may be taken here with no session (rare).' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillCounterDto.prototype, "tcnRequiresSession", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTillCounterDto.prototype, "tcnSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveTillCounterDto.prototype, "tcnRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillCounterDto.prototype, "tcnIsActive", void 0);
class SaveTillSafeDto {
    tsfId;
    tsfCompanyId;
    tsfBranchId;
    tsfCode;
    tsfName;
    tsfLedgerId;
    tsfInsuredLimit;
    tsfIsDefault;
    tsfRemarks;
    tsfIsActive;
}
exports.SaveTillSafeDto = SaveTillSafeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillSafeDto.prototype, "tsfId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillSafeDto.prototype, "tsfCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillSafeDto.prototype, "tsfBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'SAFE1' }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    __metadata("design:type", String)
], SaveTillSafeDto.prototype, "tsfCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Main safe' }),
    (0, dtoDecorators_1.TrimmedString)(100),
    __metadata("design:type", String)
], SaveTillSafeDto.prototype, "tsfName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The ledger the safe posts to. Left out on a new safe = the SAFE_CASH role’s ledger (Ledger Map).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillSafeDto.prototype, "tsfLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0 = none; above it the day close asks for a remittance.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillSafeDto.prototype, "tsfInsuredLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The branch default safe; setting it takes the flag off the old default.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillSafeDto.prototype, "tsfIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveTillSafeDto.prototype, "tsfRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillSafeDto.prototype, "tsfIsActive", void 0);
class SaveTillReasonDto {
    trsId;
    trsCompanyId;
    trsCategory;
    trsCode;
    trsName;
    trsLedgerId;
    trsNeedsNote;
    trsNeedsRef;
    trsMaxAmount;
    trsSortOrder;
    trsIsActive;
}
exports.SaveTillReasonDto = SaveTillReasonDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update (a company row only; shipped rows are read-only).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillReasonDto.prototype, "trsId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The owning company. Shipped (shared) rows are not edited here.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillReasonDto.prototype, "trsCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'VARIANCE' }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    __metadata("design:type", String)
], SaveTillReasonDto.prototype, "trsCategory", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'COUNT_ERROR' }),
    (0, dtoDecorators_1.UpperMaxString)(30),
    __metadata("design:type", String)
], SaveTillReasonDto.prototype, "trsCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Counting error' }),
    (0, dtoDecorators_1.TrimmedString)(100),
    __metadata("design:type", String)
], SaveTillReasonDto.prototype, "trsName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'EXPENSE / PAID_IN: the default ledger.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTillReasonDto.prototype, "trsLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillReasonDto.prototype, "trsNeedsNote", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillReasonDto.prototype, "trsNeedsRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0 = no cap of its own.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillReasonDto.prototype, "trsMaxAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTillReasonDto.prototype, "trsSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillReasonDto.prototype, "trsIsActive", void 0);
class SaveTillDenominationDto {
    tdnId;
    tdnCompanyId;
    tdnCurrency;
    tdnValue;
    tdnKind;
    tdnLabel;
    tdnBundleQty;
    tdnSortOrder;
    tdnValidTo;
    tdnIsActive;
}
exports.SaveTillDenominationDto = SaveTillDenominationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update (a company row only).' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillDenominationDto.prototype, "tdnId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillDenominationDto.prototype, "tdnCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'INR' }),
    (0, dtoDecorators_1.NullableString)(3),
    __metadata("design:type", String)
], SaveTillDenominationDto.prototype, "tdnCurrency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 500 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], SaveTillDenominationDto.prototype, "tdnValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['NOTE', 'COIN'] }),
    (0, class_validator_1.IsIn)(['NOTE', 'COIN']),
    __metadata("design:type", String)
], SaveTillDenominationDto.prototype, "tdnKind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '₹500' }),
    (0, dtoDecorators_1.TrimmedString)(20),
    __metadata("design:type", String)
], SaveTillDenominationDto.prototype, "tdnLabel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Notes per strapped bundle; 0 = not bundled.' }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTillDenominationDto.prototype, "tdnBundleQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTillDenominationDto.prototype, "tdnSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2027-03-31',
        description: 'A withdrawn note stops being offered after this.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTillDenominationDto.prototype, "tdnValidTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillDenominationDto.prototype, "tdnIsActive", void 0);
class SaveTillApprovalRuleDto {
    tarId;
    tarCompanyId;
    tarBranchId;
    tarEventCode;
    tarMode;
    tarThresholdAmount;
    tarThresholdCount;
    tarThresholdPercent;
    tarChannel;
    tarMinRole;
    tarTwoPerson;
    tarAllowSelf;
    tarBlocksTill;
    tarExpireMinutes;
    tarEffectiveFrom;
    tarRemarks;
    tarIsActive;
}
exports.SaveTillApprovalRuleDto = SaveTillApprovalRuleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update (a company / branch row only).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Set = this branch only (it beats the company row).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTillApprovalRuleDto.prototype, "tarBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CASH_VARIANCE' }),
    (0, dtoDecorators_1.UpperMaxString)(30),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarEventCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['NEVER', 'ALWAYS', 'OVER_AMOUNT', 'OVER_COUNT', 'OVER_PERCENT'] }),
    (0, dtoDecorators_1.UpperMaxString)(12),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillApprovalRuleDto.prototype, "tarThresholdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Per session.' }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTillApprovalRuleDto.prototype, "tarThresholdCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SaveTillApprovalRuleDto.prototype, "tarThresholdPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['COUNTER', 'REMOTE', 'EITHER'] }),
    (0, dtoDecorators_1.NullableString)(12),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarChannel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['SUPERVISOR', 'STORE_MANAGER', 'CASH_OFFICE', 'AREA_MANAGER', 'HO_FINANCE'],
    }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarMinRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillApprovalRuleDto.prototype, "tarTwoPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillApprovalRuleDto.prototype, "tarAllowSelf", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'false = record now, review later.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillApprovalRuleDto.prototype, "tarBlocksTill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0 = a PENDING request never expires.' }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveTillApprovalRuleDto.prototype, "tarExpireMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-01' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveTillApprovalRuleDto.prototype, "tarEffectiveFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveTillApprovalRuleDto.prototype, "tarRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillApprovalRuleDto.prototype, "tarIsActive", void 0);
class SaveTillApprovalAuthorityDto {
    taaId;
    taaUserId;
    taaCompanyId;
    taaBranchId;
    taaRole;
    taaEventCode;
    taaMaxAmount;
    taaCanRemote;
    taaValidFrom;
    taaValidTo;
    taaRemarks;
    taaIsActive;
}
exports.SaveTillApprovalAuthorityDto = SaveTillApprovalAuthorityDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTillApprovalAuthorityDto.prototype, "taaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'user_master.usr_id of the approver.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTillApprovalAuthorityDto.prototype, "taaUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = every company (group finance).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTillApprovalAuthorityDto.prototype, "taaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = every branch of the company.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveTillApprovalAuthorityDto.prototype, "taaBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['SUPERVISOR', 'STORE_MANAGER', 'CASH_OFFICE', 'AREA_MANAGER', 'HO_FINANCE'],
    }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    __metadata("design:type", String)
], SaveTillApprovalAuthorityDto.prototype, "taaRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'NULL = every event.' }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveTillApprovalAuthorityDto.prototype, "taaEventCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'NULL = no ceiling.' }),
    (0, dtoDecorators_1.NullableNumber)(0),
    __metadata("design:type", Object)
], SaveTillApprovalAuthorityDto.prototype, "taaMaxAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'May approve from the inbox / mobile, not only at the counter.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillApprovalAuthorityDto.prototype, "taaCanRemote", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-08' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], SaveTillApprovalAuthorityDto.prototype, "taaValidFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveTillApprovalAuthorityDto.prototype, "taaValidTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveTillApprovalAuthorityDto.prototype, "taaRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTillApprovalAuthorityDto.prototype, "taaIsActive", void 0);
class TillMasterKeyQueryDto {
    id;
    companyId;
}
exports.TillMasterKeyQueryDto = TillMasterKeyQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillMasterKeyQueryDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The caller’s company: a row of another company is not found.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillMasterKeyQueryDto.prototype, "companyId", void 0);
class TillDenominationListQueryDto {
    companyId;
}
exports.TillDenominationListQueryDto = TillDenominationListQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TillDenominationListQueryDto.prototype, "companyId", void 0);
//# sourceMappingURL=save-till-masters.dto.js.map