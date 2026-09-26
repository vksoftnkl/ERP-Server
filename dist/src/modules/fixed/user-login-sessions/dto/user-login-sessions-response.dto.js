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
exports.UserLoginSessionsSuccessDeleteDto = exports.UserLoginSessionsSuccessListDto = exports.UserLoginSessionsSuccessSingleDto = exports.UserLoginSessionsDeleteResultDto = exports.UserLoginSessionsPayloadDto = exports.UserLoginSessionsListMetaDto = exports.UserLoginSessionsErrorResponseDto = exports.UserLoginSessionsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "UserLoginSessionsErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "UserLoginSessionsErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
Object.defineProperty(exports, "UserLoginSessionsListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.FixedListMetaDto; } });
class UserLoginSessionsPayloadDto {
    ulsId;
    ulsCompanyId;
    ulsBranchId;
    ulsUserId;
    ulsDeviceId;
    ulsSessionId;
    ulsSessionToken;
    ulsRefreshTokenId;
    ulsLoginOn;
    ulsLogoutOn;
    ulsLogoutType;
    ulsLoginStatus;
    ulsFailReason;
    ulsIpAddress;
    ulsUserAgent;
    ulsAppVersion;
    ulsIsActiveSession;
    ulsIsActive;
    ulsIsDeleted;
    ulsSyncDate;
    ulsCreatedOn;
    ulsCreatedBy;
    ulsModifiedOn;
    ulsModifiedBy;
}
exports.UserLoginSessionsPayloadDto = UserLoginSessionsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserLoginSessionsPayloadDto.prototype, "ulsId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserLoginSessionsPayloadDto.prototype, "ulsUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsSessionToken", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsRefreshTokenId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserLoginSessionsPayloadDto.prototype, "ulsLoginOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsLogoutOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsLogoutType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'SUCCESS' }),
    __metadata("design:type", String)
], UserLoginSessionsPayloadDto.prototype, "ulsLoginStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsFailReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '192.168.1.22' }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsIpAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsUserAgent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 40, nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsAppVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserLoginSessionsPayloadDto.prototype, "ulsIsActiveSession", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserLoginSessionsPayloadDto.prototype, "ulsIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UserLoginSessionsPayloadDto.prototype, "ulsIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserLoginSessionsPayloadDto.prototype, "ulsCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserLoginSessionsPayloadDto.prototype, "ulsModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], UserLoginSessionsPayloadDto.prototype, "ulsModifiedBy", void 0);
class UserLoginSessionsDeleteResultDto {
    ulsId;
    deleted;
}
exports.UserLoginSessionsDeleteResultDto = UserLoginSessionsDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], UserLoginSessionsDeleteResultDto.prototype, "ulsId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserLoginSessionsDeleteResultDto.prototype, "deleted", void 0);
class UserLoginSessionsSuccessSingleDto {
    success;
    message;
    data;
}
exports.UserLoginSessionsSuccessSingleDto = UserLoginSessionsSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserLoginSessionsSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'User login session fetched successfully' }),
    __metadata("design:type", String)
], UserLoginSessionsSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserLoginSessionsPayloadDto }),
    __metadata("design:type", UserLoginSessionsPayloadDto)
], UserLoginSessionsSuccessSingleDto.prototype, "data", void 0);
class UserLoginSessionsSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.UserLoginSessionsSuccessListDto = UserLoginSessionsSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserLoginSessionsSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'User login sessions fetched successfully' }),
    __metadata("design:type", String)
], UserLoginSessionsSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserLoginSessionsPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], UserLoginSessionsSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.FixedListMetaDto }),
    __metadata("design:type", module_response_dto_1.FixedListMetaDto)
], UserLoginSessionsSuccessListDto.prototype, "meta", void 0);
class UserLoginSessionsSuccessDeleteDto {
    success;
    message;
    data;
}
exports.UserLoginSessionsSuccessDeleteDto = UserLoginSessionsSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserLoginSessionsSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'User login session deleted successfully' }),
    __metadata("design:type", String)
], UserLoginSessionsSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserLoginSessionsDeleteResultDto }),
    __metadata("design:type", UserLoginSessionsDeleteResultDto)
], UserLoginSessionsSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=user-login-sessions-response.dto.js.map