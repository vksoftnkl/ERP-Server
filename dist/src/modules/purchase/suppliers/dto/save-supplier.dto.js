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
exports.SaveSupplierDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const ledger_bank_account_item_dto_1 = require("../../../accountsModule/accountLedgerMasters/dto/ledger-bank-account-item.dto");
const save_account_ledger_master_dto_1 = require("../../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto");
class SaveSupplierDto {
    supId;
    supCompanyId;
    supBranchId;
    supGroupId;
    supPurchaseType;
    supName;
    supShort;
    supAddr1;
    supAddr2;
    supAddr3;
    supCity;
    supDistrict;
    supStateName;
    supCountry;
    supPincode;
    supTel;
    supPhone;
    supMailId;
    supWhatsappNo;
    supWebsiteAddress;
    supChequePreName;
    supNotes;
    supCreditDays;
    supCashDiscPerc;
    supCollectionDays;
    supGstNo;
    supStateCode;
    supPanNo;
    supGstType;
    supSupCst;
    supDrugLiscenceNo;
    supRegionName;
    supRegionAddr1;
    supRegionAddr2;
    supRegionAddr3;
    supRegionCity;
    supRegionDistrict;
    supRegionStateName;
    supRegionCountry;
    supBilledDate;
    supSortOrder;
    supIsActive;
    supCreatedBy;
    supModifiedBy;
    ledgerBankAccount;
}
exports.SaveSupplierDto = SaveSupplierDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing supplier',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, dtoDecorators_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supPurchaseType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supDistrict", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supPincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableString)(120),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supMailId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supWebsiteAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supChequePreName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveSupplierDto.prototype, "supCreditDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveSupplierDto.prototype, "supCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [Number],
        description: 'Collection days as integer array (JSON array or comma-separated values)',
    }),
    (0, dtoDecorators_1.OptionalIntegerArray)(),
    __metadata("design:type", Array)
], SaveSupplierDto.prototype, "supCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableString)(15),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supGstNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 2, maxLength: 2 }),
    (0, dtoDecorators_1.UpperString)(2),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supPanNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30 }),
    (0, dtoDecorators_1.TrimmedString)(30),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveSupplierDto.prototype, "supGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 25, nullable: true }),
    (0, dtoDecorators_1.NullableString)(25),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supSupCst", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supDrugLiscenceNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableString)(200),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    (0, dtoDecorators_1.NullableString)(60),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supBilledDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSupplierDto.prototype, "supIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveSupplierDto.prototype, "supModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: ledger_bank_account_item_dto_1.LedgerBankAccountItemDto,
        isArray: true,
        description: "Bank accounts to persist on the supplier's linked account ledger. On create every item " +
            'is inserted; on update an item with `lbaId` updates that row, an item without `lbaId` is ' +
            'inserted. Omitting the array (or sending an empty one) leaves existing bank accounts ' +
            'untouched — use the ledger bank account delete endpoint to remove them.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, save_account_ledger_master_dto_1.normalizeBankAccountItems)(value)),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ledger_bank_account_item_dto_1.LedgerBankAccountItemDto),
    __metadata("design:type", Array)
], SaveSupplierDto.prototype, "ledgerBankAccount", void 0);
//# sourceMappingURL=save-supplier.dto.js.map