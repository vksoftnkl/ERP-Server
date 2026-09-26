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
exports.LoginAuthDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const toOptionalTrimmedString = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
class LoginAuthDto {
    usrLoginName;
    usrPassword;
    device_id;
    app_version;
    ip_address;
    device_type;
}
exports.LoginAuthDto = LoginAuthDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'john.doe', maxLength: 50 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], LoginAuthDto.prototype, "usrLoginName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'StrongPassword123!' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginAuthDto.prototype, "usrPassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'string',
        description: 'Stable client device identifier for the login session row',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalTrimmedString(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LoginAuthDto.prototype, "device_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 40,
        description: 'Client application version for the login session row',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalTrimmedString(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], LoginAuthDto.prototype, "app_version", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '192.168.1.1',
        description: 'Client IP address; server-detected IP is used when omitted',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalTrimmedString(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsIP)(),
    __metadata("design:type", String)
], LoginAuthDto.prototype, "ip_address", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Mobile',
        maxLength: 30,
        description: 'Device type (e.g. Desktop, Mobile, Tablet)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toOptionalTrimmedString(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], LoginAuthDto.prototype, "device_type", void 0);
//# sourceMappingURL=login-auth.dto.js.map