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
exports.AccountLedgerMasterBankAccountsDeleteDto = exports.AccountLedgerMasterBankAccountsDeleteResultDto = exports.AccountLedgerMasterBankAccountListDto = exports.AccountLedgerMasterBankAccountListDataDto = exports.AccountLedgerMasterBankAccountSingleDto = exports.AccountLedgerMasterSuccessListDto = exports.AccountLedgerMasterSuccessDeleteDto = exports.AccountLedgerMasterSuccessSingleDto = exports.AccountLedgerMasterDeleteResultDto = exports.AccountLedgerMasterPayloadDto = exports.AccountLedgerMasterErrorResponseDto = exports.AccountLedgerMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const account_ledger_master_enum_1 = require("../types/account-ledger-master-enum");
const account_group_enum_1 = require("../../accountsGroup/types/account-group-enum");
const ledger_bank_account_response_dto_1 = require("../../ledgerBankAccount/dto/ledger-bank-account-response.dto");
class AccountLedgerMasterErrorFieldDto {
    field;
    message;
}
exports.AccountLedgerMasterErrorFieldDto = AccountLedgerMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ledName' }),
    __metadata("design:type", String)
], AccountLedgerMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate ledName is not allowed for this company and group' }),
    __metadata("design:type", String)
], AccountLedgerMasterErrorFieldDto.prototype, "message", void 0);
class AccountLedgerMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.AccountLedgerMasterErrorResponseDto = AccountLedgerMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], AccountLedgerMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountLedgerMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], AccountLedgerMasterErrorResponseDto.prototype, "errors", void 0);
class AccountLedgerMasterPayloadDto {
    ledId;
    ledCompanyId;
    ledCompanyName;
    ledBranchId;
    ledBranchName;
    ledGroupId;
    ledGroupName;
    ledGroupLedgerProfile;
    ledName;
    ledAlias;
    ledShort;
    ledTallyName;
    ledTallyGroupName;
    ledTallyGuid;
    ledTallyMasterId;
    ledTallyAlterId;
    ledCategory;
    ledLedgerType;
    ledMailingName;
    ledIsBillByBill;
    ledIsCostCenterReq;
    ledIsInterestApplicable;
    ledInterestRate;
    ledContactPerson;
    ledEmail;
    ledTel;
    ledPhone1;
    ledPhone2;
    ledWhatsappNo;
    ledAddr1;
    ledAddr2;
    ledAddr3;
    ledCity;
    ledDistrict;
    ledStateName;
    ledStateCode;
    ledPin;
    ledCountry;
    ledRegionName;
    ledRegionAddr1;
    ledRegionAddr2;
    ledRegionAddr3;
    ledRegionCity;
    ledRegionDistrict;
    ledRegionStateName;
    ledRegionCountry;
    ledGstPartyRegType;
    ledGstinNo;
    ledPanNo;
    ledAadharNo;
    ledEcommerceGstin;
    ledIsSez;
    ledTypeOfSupply;
    ledHsnSac;
    ledGstRate;
    ledTaxability;
    ledGstPartyType;
    ledTanNo;
    ledCin;
    ledUdyamNo;
    ledMsmeType;
    ledGstDutyHead;
    ledTaxRate;
    ledRoundingMethod;
    ledRoundingLimit;
    ledIsTdsApplicable;
    ledTdsDeducteeType;
    ledTdsNatureOfPayment;
    ledIsTcsApplicable;
    ledObAmount;
    ledObType;
    ledObAsOn;
    ledTotalDr;
    ledTotalCr;
    ledTotalBalance;
    ledSortOrder;
    ledIsActive;
    ledIsDeleted;
    ledAllowEdit;
    ledIsEntry;
    ledAllowSms;
    ledRemarks;
    ledSyncDate;
    ledCreatedOn;
    ledCreatedBy;
    ledModifiedOn;
    ledModifiedBy;
    ledgerBankAccount;
}
exports.AccountLedgerMasterPayloadDto = AccountLedgerMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the company' }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the branch' }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Name of the account group' }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_group_enum_1.AccLedgerProfile,
        enumName: 'AccLedgerProfile',
        nullable: true,
        description: 'Ledger profile inherited from the account group',
    }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGroupLedgerProfile", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTallyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTallyGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTallyGuid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Tally master id (BigInt serialized as string)',
    }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTallyMasterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Tally alter id (BigInt serialized as string)',
    }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTallyAlterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledCategory", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledLedgerType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledMailingName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsBillByBill", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsCostCenterReq", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsInterestApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledInterestRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledPhone1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledPhone2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedGstPartyRegType,
        enumName: 'LedGstPartyRegType',
        nullable: true,
    }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGstPartyRegType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGstinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledAadharNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledEcommerceGstin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsSez", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTypeOfSupply", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledHsnSac", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGstRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTaxability", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGstPartyType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 21, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledCin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 25, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledUdyamNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledMsmeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledGstDutyHead", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTaxRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRoundingMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRoundingLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsTdsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 40, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTdsDeducteeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 80, nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledTdsNatureOfPayment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AccountLedgerMasterPayloadDto.prototype, "ledObAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: account_ledger_master_enum_1.LedObType,
        enumName: 'LedObType',
    }),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledObType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledObAsOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AccountLedgerMasterPayloadDto.prototype, "ledTotalDr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AccountLedgerMasterPayloadDto.prototype, "ledTotalCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AccountLedgerMasterPayloadDto.prototype, "ledTotalBalance", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledAllowEdit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledIsEntry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountLedgerMasterPayloadDto.prototype, "ledAllowSms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AccountLedgerMasterPayloadDto.prototype, "ledModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountLedgerMasterPayloadDto.prototype, "ledModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], AccountLedgerMasterPayloadDto.prototype, "ledgerBankAccount", void 0);
class AccountLedgerMasterDeleteResultDto {
    ledId;
    deleted;
}
exports.AccountLedgerMasterDeleteResultDto = AccountLedgerMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccountLedgerMasterDeleteResultDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterDeleteResultDto.prototype, "deleted", void 0);
class AccountLedgerMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.AccountLedgerMasterSuccessSingleDto = AccountLedgerMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account ledger fetched successfully' }),
    __metadata("design:type", String)
], AccountLedgerMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountLedgerMasterPayloadDto }),
    __metadata("design:type", AccountLedgerMasterPayloadDto)
], AccountLedgerMasterSuccessSingleDto.prototype, "data", void 0);
class AccountLedgerMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.AccountLedgerMasterSuccessDeleteDto = AccountLedgerMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account ledger deleted successfully' }),
    __metadata("design:type", String)
], AccountLedgerMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountLedgerMasterDeleteResultDto }),
    __metadata("design:type", AccountLedgerMasterDeleteResultDto)
], AccountLedgerMasterSuccessDeleteDto.prototype, "data", void 0);
class AccountLedgerMasterSuccessListDto {
    success;
    message;
    data;
}
exports.AccountLedgerMasterSuccessListDto = AccountLedgerMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account ledgers saved successfully' }),
    __metadata("design:type", String)
], AccountLedgerMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountLedgerMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], AccountLedgerMasterSuccessListDto.prototype, "data", void 0);
class AccountLedgerMasterBankAccountSingleDto {
    success;
    message;
    data;
}
exports.AccountLedgerMasterBankAccountSingleDto = AccountLedgerMasterBankAccountSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterBankAccountSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger bank account fetched successfully' }),
    __metadata("design:type", String)
], AccountLedgerMasterBankAccountSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountPayloadDto }),
    __metadata("design:type", ledger_bank_account_response_dto_1.LedgerBankAccountPayloadDto)
], AccountLedgerMasterBankAccountSingleDto.prototype, "data", void 0);
class AccountLedgerMasterBankAccountListDataDto {
    data;
    total;
}
exports.AccountLedgerMasterBankAccountListDataDto = AccountLedgerMasterBankAccountListDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], AccountLedgerMasterBankAccountListDataDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Number of active bank accounts for the ledger' }),
    __metadata("design:type", Number)
], AccountLedgerMasterBankAccountListDataDto.prototype, "total", void 0);
class AccountLedgerMasterBankAccountListDto {
    success;
    message;
    data;
}
exports.AccountLedgerMasterBankAccountListDto = AccountLedgerMasterBankAccountListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterBankAccountListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger bank accounts fetched successfully' }),
    __metadata("design:type", String)
], AccountLedgerMasterBankAccountListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountLedgerMasterBankAccountListDataDto }),
    __metadata("design:type", AccountLedgerMasterBankAccountListDataDto)
], AccountLedgerMasterBankAccountListDto.prototype, "data", void 0);
class AccountLedgerMasterBankAccountsDeleteResultDto {
    lbaId;
    deleted;
}
exports.AccountLedgerMasterBankAccountsDeleteResultDto = AccountLedgerMasterBankAccountsDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccountLedgerMasterBankAccountsDeleteResultDto.prototype, "lbaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterBankAccountsDeleteResultDto.prototype, "deleted", void 0);
class AccountLedgerMasterBankAccountsDeleteDto {
    success;
    message;
    data;
}
exports.AccountLedgerMasterBankAccountsDeleteDto = AccountLedgerMasterBankAccountsDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountLedgerMasterBankAccountsDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger bank account deleted successfully' }),
    __metadata("design:type", String)
], AccountLedgerMasterBankAccountsDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountLedgerMasterBankAccountsDeleteResultDto }),
    __metadata("design:type", AccountLedgerMasterBankAccountsDeleteResultDto)
], AccountLedgerMasterBankAccountsDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=account-ledger-master-response.dto.js.map