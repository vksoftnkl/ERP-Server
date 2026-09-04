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
//# sourceMappingURL=login-response.dto.js.map