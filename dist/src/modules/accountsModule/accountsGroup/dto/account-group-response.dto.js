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
exports.AccountGroupSuccessDeleteDto = exports.AccountGroupSuccessSingleDto = exports.AccountGroupDeleteResultDto = exports.AccountGroupPayloadDto = exports.AccountGroupErrorResponseDto = exports.AccountGroupErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const account_group_enum_1 = require("../types/account-group-enum");
class AccountGroupErrorFieldDto {
    field;
    message;
}
exports.AccountGroupErrorFieldDto = AccountGroupErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'accGroupName' }),
    __metadata("design:type", String)
], AccountGroupErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate accGroupName is not allowed for this company' }),
    __metadata("design:type", String)
], AccountGroupErrorFieldDto.prototype, "message", void 0);
class AccountGroupErrorResponseDto {
    success;
    message;
    errors;
}
exports.AccountGroupErrorResponseDto = AccountGroupErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AccountGroupErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], AccountGroupErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountGroupErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], AccountGroupErrorResponseDto.prototype, "errors", void 0);
class AccountGroupPayloadDto {
    accGroupId;
    accGroupCompanyId;
    accGroupCompanyName;
    accGroupName;
    accGroupAlias;
    accGroupShort;
    accGroupDescription;
    accGroupTallyName;
    accGroupPrimaryName;
    accGroupNature;
    accGroupTallyGuid;
    accGroupTallyMasterId;
    accGroupTallyAlterId;
    accGroupParentId;
    accGroupParentName;
    accGroupSort;
    accGroupChildIds;
    accGroupType;
    accGroupIsDefault;
    accLedgerProfile;
}
exports.AccountGroupPayloadDto = AccountGroupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccountGroupPayloadDto.prototype, "accGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], AccountGroupPayloadDto.prototype, "accGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupTallyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupPrimaryName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: account_group_enum_1.AccountGroupNature,
        enumName: 'AccountGroupNature',
        maxLength: 20,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupNature", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64, nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupTallyGuid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Tally master id (BigInt serialized as string)',
    }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupTallyMasterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Tally alter id (BigInt serialized as string)',
    }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupTallyAlterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupParentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 150,
        nullable: true,
        description: 'Name of the parent account group',
    }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupParentName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccountGroupPayloadDto.prototype, "accGroupSort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], AccountGroupPayloadDto.prototype, "accGroupChildIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: account_group_enum_1.AccountGroupType, enumName: 'AccountGroupType', maxLength: 20 }),
    __metadata("design:type", String)
], AccountGroupPayloadDto.prototype, "accGroupType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccountGroupPayloadDto.prototype, "accGroupIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AccountGroupPayloadDto.prototype, "accLedgerProfile", void 0);
class AccountGroupDeleteResultDto {
    accGroupId;
    deleted;
}
exports.AccountGroupDeleteResultDto = AccountGroupDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccountGroupDeleteResultDto.prototype, "accGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountGroupDeleteResultDto.prototype, "deleted", void 0);
class AccountGroupSuccessSingleDto {
    success;
    message;
    data;
}
exports.AccountGroupSuccessSingleDto = AccountGroupSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountGroupSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account group fetched successfully' }),
    __metadata("design:type", String)
], AccountGroupSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountGroupPayloadDto }),
    __metadata("design:type", AccountGroupPayloadDto)
], AccountGroupSuccessSingleDto.prototype, "data", void 0);
class AccountGroupSuccessDeleteDto {
    success;
    message;
    data;
}
exports.AccountGroupSuccessDeleteDto = AccountGroupSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccountGroupSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account group deleted successfully' }),
    __metadata("design:type", String)
], AccountGroupSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountGroupDeleteResultDto }),
    __metadata("design:type", AccountGroupDeleteResultDto)
], AccountGroupSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=account-group-response.dto.js.map