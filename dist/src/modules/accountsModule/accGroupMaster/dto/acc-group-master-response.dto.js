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
exports.AccGroupMasterSuccessDeleteDto = exports.AccGroupMasterSuccessSingleDto = exports.AccGroupMasterDeleteResultDto = exports.AccGroupMasterPayloadDto = exports.AccGroupMasterErrorResponseDto = exports.AccGroupMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const acc_group_master_enum_1 = require("../types/acc-group-master-enum");
class AccGroupMasterErrorFieldDto {
    field;
    message;
}
exports.AccGroupMasterErrorFieldDto = AccGroupMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'accGroupName' }),
    __metadata("design:type", String)
], AccGroupMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate accGroupName is not allowed for this company' }),
    __metadata("design:type", String)
], AccGroupMasterErrorFieldDto.prototype, "message", void 0);
class AccGroupMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.AccGroupMasterErrorResponseDto = AccGroupMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AccGroupMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], AccGroupMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccGroupMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], AccGroupMasterErrorResponseDto.prototype, "errors", void 0);
class AccGroupMasterPayloadDto {
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
exports.AccGroupMasterPayloadDto = AccGroupMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccGroupMasterPayloadDto.prototype, "accGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], AccGroupMasterPayloadDto.prototype, "accGroupName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupTallyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupPrimaryName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: acc_group_master_enum_1.AccGroupMasterNature,
        enumName: 'AccountGroupNature',
        maxLength: 20,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupNature", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 64, nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupTallyGuid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Tally master id (BigInt serialized as string)',
    }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupTallyMasterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Tally alter id (BigInt serialized as string)',
    }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupTallyAlterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupParentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 150,
        nullable: true,
        description: 'Name of the parent account group',
    }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupParentName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AccGroupMasterPayloadDto.prototype, "accGroupSort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], example: [] }),
    __metadata("design:type", Array)
], AccGroupMasterPayloadDto.prototype, "accGroupChildIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: acc_group_master_enum_1.AccGroupMasterType, enumName: 'AccountGroupType', maxLength: 20 }),
    __metadata("design:type", String)
], AccGroupMasterPayloadDto.prototype, "accGroupType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AccGroupMasterPayloadDto.prototype, "accGroupIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AccGroupMasterPayloadDto.prototype, "accLedgerProfile", void 0);
class AccGroupMasterDeleteResultDto {
    accGroupId;
    deleted;
}
exports.AccGroupMasterDeleteResultDto = AccGroupMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AccGroupMasterDeleteResultDto.prototype, "accGroupId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccGroupMasterDeleteResultDto.prototype, "deleted", void 0);
class AccGroupMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.AccGroupMasterSuccessSingleDto = AccGroupMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccGroupMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account group fetched successfully' }),
    __metadata("design:type", String)
], AccGroupMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccGroupMasterPayloadDto }),
    __metadata("design:type", AccGroupMasterPayloadDto)
], AccGroupMasterSuccessSingleDto.prototype, "data", void 0);
class AccGroupMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.AccGroupMasterSuccessDeleteDto = AccGroupMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AccGroupMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Account group deleted successfully' }),
    __metadata("design:type", String)
], AccGroupMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccGroupMasterDeleteResultDto }),
    __metadata("design:type", AccGroupMasterDeleteResultDto)
], AccGroupMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=acc-group-master-response.dto.js.map