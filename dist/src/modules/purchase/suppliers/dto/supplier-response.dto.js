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
exports.SupplierSuccessDeleteDto = exports.SupplierSuccessSingleDto = exports.SupplierDeleteResultDto = exports.SupplierPayloadDto = exports.SupplierErrorResponseDto = exports.SupplierErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const ledger_bank_account_response_dto_1 = require("../../../accountsModule/ledgerBankAccount/dto/ledger-bank-account-response.dto");
class SupplierErrorFieldDto {
    field;
    message;
}
exports.SupplierErrorFieldDto = SupplierErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'supName' }),
    __metadata("design:type", String)
], SupplierErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate supplier name is not allowed for this company' }),
    __metadata("design:type", String)
], SupplierErrorFieldDto.prototype, "message", void 0);
class SupplierErrorResponseDto {
    success;
    message;
    errors;
}
exports.SupplierErrorResponseDto = SupplierErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SupplierErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], SupplierErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SupplierErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], SupplierErrorResponseDto.prototype, "errors", void 0);
class SupplierPayloadDto {
    supId;
    supCompanyId;
    supCompanyName;
    supBranchId;
    supBranchName;
    supGroupId;
    supGroupName;
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
    supIsDeleted;
    supSyncDate;
    supCreatedOn;
    supCreatedBy;
    supModifiedOn;
    supModifiedBy;
    ledgerBankAccount;
}
exports.SupplierPayloadDto = SupplierPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Wholesale Suppliers',
        description: 'Name of the linked supplier group (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supGroupName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supPurchaseType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supDistrict", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supPincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supTel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supMailId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supWebsiteAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supChequePreName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supNotes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SupplierPayloadDto.prototype, "supCreditDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SupplierPayloadDto.prototype, "supCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [Number], example: [] }),
    __metadata("design:type", Array)
], SupplierPayloadDto.prototype, "supCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supGstNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 2, maxLength: 2 }),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supPanNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30 }),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 25, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supSupCst", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supDrugLiscenceNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supRegionCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supBilledDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SupplierPayloadDto.prototype, "supIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SupplierPayloadDto.prototype, "supIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SupplierPayloadDto.prototype, "supModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierPayloadDto.prototype, "supModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], SupplierPayloadDto.prototype, "ledgerBankAccount", void 0);
class SupplierDeleteResultDto {
    supId;
    deleted;
}
exports.SupplierDeleteResultDto = SupplierDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SupplierDeleteResultDto.prototype, "supId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SupplierDeleteResultDto.prototype, "deleted", void 0);
class SupplierSuccessSingleDto {
    success;
    message;
    data;
}
exports.SupplierSuccessSingleDto = SupplierSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SupplierSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Supplier fetched successfully' }),
    __metadata("design:type", String)
], SupplierSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SupplierPayloadDto }),
    __metadata("design:type", SupplierPayloadDto)
], SupplierSuccessSingleDto.prototype, "data", void 0);
class SupplierSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SupplierSuccessDeleteDto = SupplierSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SupplierSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Supplier deleted successfully' }),
    __metadata("design:type", String)
], SupplierSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SupplierDeleteResultDto }),
    __metadata("design:type", SupplierDeleteResultDto)
], SupplierSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=supplier-response.dto.js.map