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
exports.ChargeMasterSuccessDeleteDto = exports.ChargeMasterSuccessListDto = exports.ChargeMasterSuccessSingleDto = exports.ChargeMasterDeleteResultDto = exports.ChargeMasterListMetaDto = exports.ChargeMasterSuccessManyDto = exports.ChargeMasterPayloadDto = exports.ChargeMasterErrorResponseDto = exports.ChargeMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const charge_master_api_types_1 = require("../types/charge-master-api.types");
class ChargeMasterErrorFieldDto {
    field;
    message;
}
exports.ChargeMasterErrorFieldDto = ChargeMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'chgName' }),
    __metadata("design:type", String)
], ChargeMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'chgName must not be empty' }),
    __metadata("design:type", String)
], ChargeMasterErrorFieldDto.prototype, "message", void 0);
class ChargeMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.ChargeMasterErrorResponseDto = ChargeMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ChargeMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ChargeMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ChargeMasterErrorResponseDto.prototype, "errors", void 0);
class ChargeMasterPayloadDto {
    chgId;
    chgName;
    chgCode;
    chgModule;
    chgRole;
    chgMethod;
    chgType;
    chgApplyOn;
    chgDefaultRate;
    chgLandingCost;
    chgCostAlloc;
    chgLedgerCode;
    chgLedgerName;
    ledHsnSac;
    ledGstRate;
    ledTaxability;
    chgTaxApl;
    chgBeforeTax;
    chgSepPost;
    chgManParty;
    chgDispOrder;
    chgAutoApply;
    chgIsActive;
    chgIsDeleted;
    chgSyncDate;
    chgCreatedOn;
    chgCreatedBy;
    chgModifiedOn;
    chgModifiedBy;
}
exports.ChargeMasterPayloadDto = ChargeMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_MODULES }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_master_api_types_1.CHARGE_ROLES, nullable: true }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_METHODS }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_TYPES }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_APPLY_ONS }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgApplyOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgDefaultRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgLandingCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_master_api_types_1.CHARGE_COST_ALLOCS, nullable: true }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgCostAlloc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgLedgerCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true, description: 'Name of the mapped GL ledger' }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 10,
        nullable: true,
        description: 'HSN/SAC code of the mapped GL ledger',
    }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "ledHsnSac", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        description: 'GST rate of the mapped GL ledger',
    }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "ledGstRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 15,
        nullable: true,
        description: 'Taxability of the mapped GL ledger',
    }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "ledTaxability", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgTaxApl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgSepPost", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgManParty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgDispOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgAutoApply", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeMasterPayloadDto.prototype, "chgIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ChargeMasterPayloadDto.prototype, "chgCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ChargeMasterPayloadDto.prototype, "chgModifiedBy", void 0);
class ChargeMasterSuccessManyDto {
    success;
    message;
    data;
}
exports.ChargeMasterSuccessManyDto = ChargeMasterSuccessManyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeMasterSuccessManyDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charges fetched successfully' }),
    __metadata("design:type", String)
], ChargeMasterSuccessManyDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ChargeMasterSuccessManyDto.prototype, "data", void 0);
class ChargeMasterListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.ChargeMasterListMetaDto = ChargeMasterListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ChargeMasterListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], ChargeMasterListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], ChargeMasterListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ChargeMasterListMetaDto.prototype, "total_pages", void 0);
class ChargeMasterDeleteResultDto {
    chgId;
    deleted;
}
exports.ChargeMasterDeleteResultDto = ChargeMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeMasterDeleteResultDto.prototype, "chgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeMasterDeleteResultDto.prototype, "deleted", void 0);
class ChargeMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.ChargeMasterSuccessSingleDto = ChargeMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charge fetched successfully' }),
    __metadata("design:type", String)
], ChargeMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeMasterPayloadDto }),
    __metadata("design:type", ChargeMasterPayloadDto)
], ChargeMasterSuccessSingleDto.prototype, "data", void 0);
class ChargeMasterSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ChargeMasterSuccessListDto = ChargeMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charges fetched successfully' }),
    __metadata("design:type", String)
], ChargeMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ChargeMasterSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeMasterListMetaDto }),
    __metadata("design:type", ChargeMasterListMetaDto)
], ChargeMasterSuccessListDto.prototype, "meta", void 0);
class ChargeMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ChargeMasterSuccessDeleteDto = ChargeMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charge deleted successfully' }),
    __metadata("design:type", String)
], ChargeMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeMasterDeleteResultDto }),
    __metadata("design:type", ChargeMasterDeleteResultDto)
], ChargeMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=charge-master-response.dto.js.map