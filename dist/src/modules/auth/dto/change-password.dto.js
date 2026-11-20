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
exports.ChangePasswordResponseDto = exports.ChangePasswordResultDto = exports.ChangePasswordDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ChangePasswordDto {
    currentPassword;
    newPassword;
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "The caller's password today, checked the way /auth/login checks it.",
        example: 'OldPassword1',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The new password: at least 4 characters (leading and trailing spaces not counted), ' +
            'no other rule (U7). Must differ from the current one.',
        example: 'NewPassword1',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
class ChangePasswordResultDto {
    usrId;
    usrPasswordChangedOn;
    usrMustChangePassword;
}
exports.ChangePasswordResultDto = ChangePasswordResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The signed-in user whose password changed' }),
    __metadata("design:type", String)
], ChangePasswordResultDto.prototype, "usrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time', description: 'When the new password was stored (UTC ISO)' }),
    __metadata("design:type", String)
], ChangePasswordResultDto.prototype, "usrPasswordChangedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Always false after a change' }),
    __metadata("design:type", Boolean)
], ChangePasswordResultDto.prototype, "usrMustChangePassword", void 0);
class ChangePasswordResponseDto {
    success;
    message;
    data;
}
exports.ChangePasswordResponseDto = ChangePasswordResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChangePasswordResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Password changed' }),
    __metadata("design:type", String)
], ChangePasswordResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChangePasswordResultDto }),
    __metadata("design:type", ChangePasswordResultDto)
], ChangePasswordResponseDto.prototype, "data", void 0);
//# sourceMappingURL=change-password.dto.js.map