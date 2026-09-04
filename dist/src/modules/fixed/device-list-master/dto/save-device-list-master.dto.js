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
exports.SaveDeviceListMasterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const device_list_master_enum_1 = require("../types/device-list-master-enum");
const isDeviceUidRequired = (deviceType) => deviceType === device_list_master_enum_1.DeviceType.DESKTOP;
class SaveDeviceListMasterDto {
    devId;
    devCompanyId;
    devBranchId;
    devUserId;
    devDeviceUid;
    devDeviceName;
    devDeviceType;
    devPlatform;
    devMacAddress;
    devIsBlocked;
    devBlockReason;
    devIsActive;
    devEntryBy;
    devcreatedOrModifiedBy;
}
exports.SaveDeviceListMasterDto = SaveDeviceListMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing device row',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDeviceListMasterDto.prototype, "devId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 120,
        description: 'Required when devDeviceType is Desktop',
    }),
    (0, class_validator_1.ValidateIf)((dto) => isDeviceUidRequired(dto.devDeviceType ?? device_list_master_enum_1.DeviceType.DESKTOP)),
    (0, dtoDecorators_1.TrimmedString)(120),
    (0, class_validator_1.IsNotEmpty)({ message: 'devDeviceUid is required when devDeviceType is Desktop' }),
    __metadata("design:type", String)
], SaveDeviceListMasterDto.prototype, "devDeviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    (0, dtoDecorators_1.NullableString)(120),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devDeviceName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: device_list_master_enum_1.DeviceType, enumName: 'DeviceListMasterDeviceType', maxLength: 30 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(30),
    (0, class_validator_1.IsEnum)(device_list_master_enum_1.DeviceType),
    __metadata("design:type", String)
], SaveDeviceListMasterDto.prototype, "devDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: device_list_master_enum_1.DevicePlatform,
        enumName: 'DeviceListMasterDevicePlatform',
        maxLength: 30,
        nullable: true,
    }),
    (0, dtoDecorators_1.NullableString)(30),
    (0, class_validator_1.IsEnum)(device_list_master_enum_1.DevicePlatform),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devPlatform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devMacAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeviceListMasterDto.prototype, "devIsBlocked", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devBlockReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeviceListMasterDto.prototype, "devIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: false }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devEntryBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeviceListMasterDto.prototype, "devcreatedOrModifiedBy", void 0);
//# sourceMappingURL=save-device-list-master.dto.js.map