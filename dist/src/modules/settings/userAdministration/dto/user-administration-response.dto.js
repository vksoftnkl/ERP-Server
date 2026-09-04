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
exports.UserAdminSuccessDeleteDto = exports.UserAdminSuccessSingleDto = exports.UserAdminDeleteResultDto = exports.UserAdminPayloadDto = exports.UserMenuPayloadDto = exports.UserAdminErrorResponseDto = exports.UserAdminErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const user_administration_enum_1 = require("../types/user-administration.enum");
class UserAdminErrorFieldDto {
    field;
    message;
}
exports.UserAdminErrorFieldDto = UserAdminErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'usrLoginName' }),
    __metadata("design:type", String)
], UserAdminErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate login name is not allowed' }),
    __metadata("design:type", String)
], UserAdminErrorFieldDto.prototype, "message", void 0);
class UserAdminErrorResponseDto {
    success;
    message;
    errors;
}
exports.UserAdminErrorResponseDto = UserAdminErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UserAdminErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], UserAdminErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserAdminErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], UserAdminErrorResponseDto.prototype, "errors", void 0);
class UserMenuPayloadDto {
    umId;
    umUserId;
    umMenuId;
    umCanView;
    umCanCreate;
    umCanEdit;
    umCanDelete;
    umCanPrint;
    umCanExport;
    umVisibility;
    umIsFavourite;
    umIsPinned;
    umSortOrder;
    umIsDeleted;
    umSyncDate;
    umCreatedOn;
    umCreatedBy;
    umModifiedOn;
    umModifiedBy;
}
exports.UserMenuPayloadDto = UserMenuPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserMenuPayloadDto.prototype, "umId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserMenuPayloadDto.prototype, "umUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], UserMenuPayloadDto.prototype, "umMenuId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umCanView", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umCanCreate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umCanEdit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umCanDelete", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umCanPrint", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umCanExport", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umVisibility", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umIsFavourite", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umIsPinned", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], UserMenuPayloadDto.prototype, "umSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserMenuPayloadDto.prototype, "umIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserMenuPayloadDto.prototype, "umSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserMenuPayloadDto.prototype, "umCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserMenuPayloadDto.prototype, "umCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserMenuPayloadDto.prototype, "umModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserMenuPayloadDto.prototype, "umModifiedBy", void 0);
class UserAdminPayloadDto {
    usrId;
    usrCompanyId;
    usrCompanyName;
    usrBranchId;
    usrBranchName;
    usrEmployeeId;
    usrLoginName;
    usrDisplayName;
    usrFullName;
    usrMobileNo;
    usrEmail;
    usrAvatarUrl;
    usrTimezone;
    usrLanguage;
    usrMustChangePassword;
    usrPasswordExpiresOn;
    usrPasswordChangedOn;
    usrType;
    usrEditDate;
    usrEditEntry;
    usrEditRate;
    usrDesktopLogin;
    usrWebLogin;
    usrMobileLogin;
    usrIsActive;
    usrIsLocked;
    usrFailedLoginCount;
    usrLastFailedLoginOn;
    usrLockedOn;
    usrLockedBy;
    usrLastLoginOn;
    usrIsDeleted;
    usrNotes;
    usrSyncDate;
    usrCreatedOn;
    usrCreatedBy;
    usrModifiedOn;
    usrModifiedBy;
    menus;
}
exports.UserAdminPayloadDto = UserAdminPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserAdminPayloadDto.prototype, "usrId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Acme Pvt Ltd',
        description: 'Name of the linked company (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Main Branch',
        description: 'Name of the linked branch (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserAdminPayloadDto.prototype, "usrLoginName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserAdminPayloadDto.prototype, "usrDisplayName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrFullName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrMobileNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrAvatarUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserAdminPayloadDto.prototype, "usrTimezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserAdminPayloadDto.prototype, "usrLanguage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrMustChangePassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrPasswordExpiresOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrPasswordChangedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: user_administration_enum_1.UserType, enumName: 'UserType', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrEditDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrEditEntry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrEditRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrDesktopLogin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrWebLogin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrMobileLogin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrIsLocked", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], UserAdminPayloadDto.prototype, "usrFailedLoginCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrLastFailedLoginOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrLockedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrLockedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrLastLoginOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserAdminPayloadDto.prototype, "usrIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserAdminPayloadDto.prototype, "usrCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserAdminPayloadDto.prototype, "usrModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserMenuPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], UserAdminPayloadDto.prototype, "menus", void 0);
class UserAdminDeleteResultDto {
    usrId;
    deleted;
}
exports.UserAdminDeleteResultDto = UserAdminDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserAdminDeleteResultDto.prototype, "usrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserAdminDeleteResultDto.prototype, "deleted", void 0);
class UserAdminSuccessSingleDto {
    success;
    message;
    data;
}
exports.UserAdminSuccessSingleDto = UserAdminSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserAdminSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'User fetched successfully' }),
    __metadata("design:type", String)
], UserAdminSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserAdminPayloadDto }),
    __metadata("design:type", UserAdminPayloadDto)
], UserAdminSuccessSingleDto.prototype, "data", void 0);
class UserAdminSuccessDeleteDto {
    success;
    message;
    data;
}
exports.UserAdminSuccessDeleteDto = UserAdminSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserAdminSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'User deleted successfully' }),
    __metadata("design:type", String)
], UserAdminSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserAdminDeleteResultDto }),
    __metadata("design:type", UserAdminDeleteResultDto)
], UserAdminSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=user-administration-response.dto.js.map