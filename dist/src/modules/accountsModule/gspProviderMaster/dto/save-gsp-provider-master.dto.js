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
exports.SaveGspProviderMasterDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveGspProviderMasterDto {
    gspProviderId;
    gspProviderCode;
    gspProviderName;
    gspBaseUrl;
    gspRoute;
    gspIpAddress;
    gspUserName;
    gspUserPassword;
    gspIsActive;
}
exports.SaveGspProviderMasterDto = SaveGspProviderMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing GSP provider',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspProviderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspProviderCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, dtoDecorators_1.TrimmedString)(150),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspProviderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Base URL for provider API' }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspBaseUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Route path for provider API' }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspRoute", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Provider server IP address' }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsIP)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspIpAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspUserName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGspProviderMasterDto.prototype, "gspUserPassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGspProviderMasterDto.prototype, "gspIsActive", void 0);
//# sourceMappingURL=save-gsp-provider-master.dto.js.map