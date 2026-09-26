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
exports.DeviceListMasterSuccessDeleteDto = exports.DeviceListMasterSuccessListDto = exports.DeviceListMasterSuccessSingleDto = exports.DeviceListMasterDeleteResultDto = exports.DeviceListMasterPayloadDto = exports.DeviceListMasterListMetaDto = exports.DeviceListMasterErrorResponseDto = exports.DeviceListMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "DeviceListMasterErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "DeviceListMasterErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
Object.defineProperty(exports, "DeviceListMasterListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.FixedListMetaDto; } });
const device_list_master_enum_1 = require("../types/device-list-master-enum");
class DeviceListMasterPayloadDto {
    devId;
    devCompanyId;
    devCompanyName;
    devBranchId;
    devBranchName;
    devUserId;
    devUserName;
    devDeviceUid;
    devDeviceName;
    devDeviceType;
    devPlatform;
    devMacAddress;
    devIsBlocked;
    devBlockReason;
    devLastIp;
    devIsActive;
    devIsDeleted;
    devSyncDate;
    devCreatedOn;
    devCreatedBy;
    devModifiedOn;
    devModifiedBy;
}
exports.DeviceListMasterPayloadDto = DeviceListMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DeviceListMasterPayloadDto.prototype, "devId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'John Doe',
        description: 'Display name of the linked user (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devUserName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    __metadata("design:type", String)
], DeviceListMasterPayloadDto.prototype, "devDeviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devDeviceName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: device_list_master_enum_1.DeviceType, enumName: 'DeviceListMasterDeviceType', maxLength: 30 }),
    __metadata("design:type", String)
], DeviceListMasterPayloadDto.prototype, "devDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: device_list_master_enum_1.DevicePlatform,
        enumName: 'DeviceListMasterDevicePlatform',
        maxLength: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devPlatform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devMacAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], DeviceListMasterPayloadDto.prototype, "devIsBlocked", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devBlockReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devLastIp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DeviceListMasterPayloadDto.prototype, "devIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], DeviceListMasterPayloadDto.prototype, "devIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], DeviceListMasterPayloadDto.prototype, "devCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], DeviceListMasterPayloadDto.prototype, "devModifiedBy", void 0);
class DeviceListMasterDeleteResultDto {
    devId;
    deleted;
}
exports.DeviceListMasterDeleteResultDto = DeviceListMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DeviceListMasterDeleteResultDto.prototype, "devId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DeviceListMasterDeleteResultDto.prototype, "deleted", void 0);
class DeviceListMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.DeviceListMasterSuccessSingleDto = DeviceListMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DeviceListMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Device fetched successfully' }),
    __metadata("design:type", String)
], DeviceListMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DeviceListMasterPayloadDto }),
    __metadata("design:type", DeviceListMasterPayloadDto)
], DeviceListMasterSuccessSingleDto.prototype, "data", void 0);
class DeviceListMasterSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.DeviceListMasterSuccessListDto = DeviceListMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DeviceListMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Devices fetched successfully' }),
    __metadata("design:type", String)
], DeviceListMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DeviceListMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], DeviceListMasterSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.FixedListMetaDto }),
    __metadata("design:type", module_response_dto_1.FixedListMetaDto)
], DeviceListMasterSuccessListDto.prototype, "meta", void 0);
class DeviceListMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.DeviceListMasterSuccessDeleteDto = DeviceListMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DeviceListMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Device deleted successfully' }),
    __metadata("design:type", String)
], DeviceListMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DeviceListMasterDeleteResultDto }),
    __metadata("design:type", DeviceListMasterDeleteResultDto)
], DeviceListMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=device-list-master-response.dto.js.map