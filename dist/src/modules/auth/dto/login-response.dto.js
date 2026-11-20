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
exports.LoginResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const check_update_dto_1 = require("../../app-version/dto/check-update.dto");
class LoginResponseDto {
    access_token;
    refresh_token;
    token_type;
    usrId;
    user_type;
    user_name;
    device_id;
    device_name;
    dev_company_id;
    dev_branch_id;
    dev_user_id;
    device_type;
    mustChangePassword;
    usrEditRate;
    usrMaxDiscPerc;
    appUpdate;
}
exports.LoginResponseDto = LoginResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "access_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "refresh_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bearer' }),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "token_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '7a9a4d16-9940-4b65-a7bc-57e83887a112',
        description: 'Authenticated user identifier',
    }),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "usrId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'User type (e.g. ADMIN, USER)' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "user_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'User display name' }),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "user_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Device identifier' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "device_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Device name' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "device_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Company ID linked to the device' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "dev_company_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Branch ID linked to the device' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "dev_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'User ID linked to the device' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "dev_user_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Device type (e.g. Desktop, Mobile)' }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "device_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'Review step 6 (U8): true = an administrator reset this password. The session may call ' +
            'POST /auth/change-password only (every other guarded route answers 403 ' +
            'AUTH_PASSWORD_CHANGE_REQUIRED) until the user changes it. Open Change Password before ' +
            'the main window. On a refresh: still true while the password is not changed.',
    }),
    __metadata("design:type", Boolean)
], LoginResponseDto.prototype, "mustChangePassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'Review step 6: the user\'s "Allow rate / discount change" (user_master.usr_edit_rate) at ' +
            'login / refresh. false = lock the line Rate, the discounts and the price level for this ' +
            'user (the server refuses them on save anyway: SALES_RATE_CHANGE_NOT_ALLOWED, ' +
            'SALES_DISC_NOT_ALLOWED, SALES_PRICE_LEVEL_NOT_ALLOWED).',
    }),
    __metadata("design:type", Boolean)
], LoginResponseDto.prototype, "usrEditRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: String,
        nullable: true,
        example: '7.50',
        description: "Review step 6: the user's max discount % on a Sale Bill (user_master.usr_max_disc_perc) " +
            'as a decimal string, at login / refresh. null = no limit. Over it the save answers ' +
            'SALES_LINE_DISC_OVER_USER_MAX / SALES_BILL_DISC_OVER_USER_MAX.',
    }),
    __metadata("design:type", Object)
], LoginResponseDto.prototype, "usrMaxDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: check_update_dto_1.AppUpdateInfoDto,
        description: 'Login only, and only when the request sent X-App-Platform + X-App-Build: whether a ' +
            'newer build is available. A notice only; the key is absent for every other client.',
    }),
    __metadata("design:type", check_update_dto_1.AppUpdateInfoDto)
], LoginResponseDto.prototype, "appUpdate", void 0);
//# sourceMappingURL=login-response.dto.js.map