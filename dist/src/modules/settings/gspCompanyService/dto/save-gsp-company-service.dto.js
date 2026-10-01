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
exports.SaveGspCompanyServiceDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveGspCompanyServiceDto {
    csgCompanyServiceId;
    csgCompanyId;
    csgGspProviderId;
    csgServiceType;
    csgEuserName;
    csgEuserPassword;
    csgAuthToken;
    csgAuthTokenValidTill;
    csgIsActive;
}
exports.SaveGspCompanyServiceDto = SaveGspCompanyServiceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing GSP company service',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveGspCompanyServiceDto.prototype, "csgCompanyServiceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, example: 'c7f8c0c0-0000-0000-0000-000000000001' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveGspCompanyServiceDto.prototype, "csgCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveGspCompanyServiceDto.prototype, "csgGspProviderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspCompanyServiceDto.prototype, "csgServiceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspCompanyServiceDto.prototype, "csgEuserName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspCompanyServiceDto.prototype, "csgEuserPassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveGspCompanyServiceDto.prototype, "csgAuthToken", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDate)(),
    __metadata("design:type", Object)
], SaveGspCompanyServiceDto.prototype, "csgAuthTokenValidTill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGspCompanyServiceDto.prototype, "csgIsActive", void 0);
//# sourceMappingURL=save-gsp-company-service.dto.js.map