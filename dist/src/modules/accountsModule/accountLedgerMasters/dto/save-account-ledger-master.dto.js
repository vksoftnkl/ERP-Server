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
exports.SaveAccountLedgerMasterDto = exports.normalizeBankAccountItems = void 0;
const class_transformer_1 = require("class-transformer");
const account_ledger_master_enum_1 = require("../types/account-ledger-master-enum");
const ledger_bank_account_item_dto_1 = require("./ledger-bank-account-item.dto");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_2 = require("class-transformer");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const DtoTransforms_1 = require("../../../../common/dto/DtoTransforms");
const isBlankBankAccountItem = (item) => {
    if (item === null || item === undefined || typeof item !== 'object') {
        return true;
    }
    return Object.values(item).every((value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === ''));
};
const normalizeBankAccountItems = (value) => {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }
    if (!Array.isArray(value)) {
        return value;
    }
    return value.filter((item) => !isBlankBankAccountItem(item));
};
exports.normalizeBankAccountItems = normalizeBankAccountItems;
class SaveAccountLedgerMasterDto {
    ledId;
    ledCompanyId;
    ledBranchId;
    ledGroupId;
    ledName;
    ledAlias;
    ledShort;
    ledTallyName;
    ledTallyGroupName;
    ledTallyGuid;
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
    ledTaxId;
    ledGstPartyType;
    ledTanNo;
    ledCin;
    ledUdyamNo;
    ledMsmeType;
    ledGstDutyHead;
    ledRoundingMethod;
    ledRoundingLimit;
    ledIsTdsApplicable;
    ledTdsDeducteeType;
    ledTdsNatureOfPayment;
    ledIsTcsApplicable;
    ledItcEligibility;
    ledIsReverseCharge;
    ledSortOrder;
    ledIsActive;
    ledAllowEdit;
    ledIsEntry;
    ledAllowSms;
    ledRemarks;
    ledgerBankAccount;
}
exports.SaveAccountLedgerMasterDto = SaveAccountLedgerMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing ledger',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveAccountLedgerMasterDto.prototype, "ledId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveAccountLedgerMasterDto.prototype, "ledCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveAccountLedgerMasterDto.prototype, "ledBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveAccountLedgerMasterDto.prototype, "ledGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveAccountLedgerMasterDto.prototype, "ledName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTallyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTallyGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64, nullable: true }),
    (0, dtoDecorators_1.NullableString)(64),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTallyGuid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30 }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.TrimmedString)(30),
    __metadata("design:type", String)
], SaveAccountLedgerMasterDto.prototype, "ledCategory", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedLedgerType,
        enumName: 'LedLedgerType',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedLedgerType),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledLedgerType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledMailingName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsBillByBill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsCostCenterReq", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsInterestApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    __metadata("design:type", Number)
], SaveAccountLedgerMasterDto.prototype, "ledInterestRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableEmail)(150),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledPhone1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledPhone2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(2),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedGstPartyRegType,
        enumName: 'LedGstPartyRegType',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedGstPartyRegType),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledGstPartyRegType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(15),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledGstinNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(10),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledPanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledAadharNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(15),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledEcommerceGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsSez", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedTypeOfSupply,
        enumName: 'LedTypeOfSupply',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedTypeOfSupply),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTypeOfSupply", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledHsnSac", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The inventory.tax_rate_master row this ledger carries when it appears as a taxable ' +
            'line — a service ledger such as freight or packing. Replaces ledGstRate / ledTaxability ' +
            '/ ledTaxRate, which held a bare percentage and could express neither cess nor ' +
            'taxability. Null on a party or bank ledger.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTaxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableString)(30),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledGstPartyType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(10),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTanNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 21, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(21),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledCin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 25, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, dtoDecorators_1.TrimmedString)(25),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledUdyamNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedMsmeType,
        enumName: 'LedMsmeType',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedMsmeType),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledMsmeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedGstDutyHead,
        enumName: 'LedGstDutyHead',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedGstDutyHead),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledGstDutyHead", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedRoundingMethod,
        enumName: 'LedRoundingMethod',
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedRoundingMethod),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRoundingMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ allowNaN: false, allowInfinity: false }),
    __metadata("design:type", Number)
], SaveAccountLedgerMasterDto.prototype, "ledRoundingLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsTdsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 40, nullable: true }),
    (0, dtoDecorators_1.NullableString)(40),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTdsDeducteeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 80, nullable: true }),
    (0, dtoDecorators_1.NullableString)(80),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledTdsNatureOfPayment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsTcsApplicable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_ledger_master_enum_1.LedItcEligibility,
        enumName: 'LedItcEligibility',
        nullable: true,
        description: 'GST input tax credit eligibility for this purchase or expense ledger. Drives ' +
            'GSTR-3B 4(A) vs 4(D) "Ineligible ITC": without it a blocked s.17(5) credit — ' +
            'motor vehicles, food and beverage, works contract, personal consumption — ' +
            'cannot be told apart from an eligible one, and 4(A) is overstated by exactly ' +
            'that amount. Null on a ledger with no ITC question to answer (bank, cash, ' +
            'party, income). Tally: ledger GST details -> Eligibility for input credit.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, DtoTransforms_1.toNullableUpperString)(value)),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsEnum)(account_ledger_master_enum_1.LedItcEligibility),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledItcEligibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'This party or expense attracts reverse charge — unregistered purchase, GTA, ' +
            "legal services, director's fees, import of services. It belongs here and not " +
            'on inventory.tax_rate_master, because a rate row is shared with ordinary ' +
            'forward-charge sales at the same percentage; the document flag ' +
            'gdr_is_reverse_charge defaults from this one.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsReverseCharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveAccountLedgerMasterDto.prototype, "ledSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledAllowEdit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledIsEntry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAccountLedgerMasterDto.prototype, "ledAllowSms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveAccountLedgerMasterDto.prototype, "ledRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: ledger_bank_account_item_dto_1.LedgerBankAccountItemDto,
        isArray: true,
        description: 'Bank accounts to persist alongside the ledger. On create every item is inserted; ' +
            'on update an item with `lbaId` updates that row, an item without `lbaId` is inserted. ' +
            'Omitting the array (or sending an empty one) leaves existing bank accounts untouched — ' +
            'use the dedicated delete endpoint to remove them.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_2.Transform)(({ value }) => (0, exports.normalizeBankAccountItems)(value)),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ledger_bank_account_item_dto_1.LedgerBankAccountItemDto),
    __metadata("design:type", Array)
], SaveAccountLedgerMasterDto.prototype, "ledgerBankAccount", void 0);
//# sourceMappingURL=save-account-ledger-master.dto.js.map