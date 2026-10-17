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
exports.BankListSuccessDeleteDto = exports.BankListSuccessListDto = exports.BankListSuccessSingleDto = exports.BankListDeleteResultDto = exports.BankListPayloadDto = exports.BankListMetaDto = exports.BankListErrorResponseDto = exports.BankListErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "BankListErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "BankListErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
Object.defineProperty(exports, "BankListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.FixedListMetaDto; } });
class BankListPayloadDto {
    bnkId;
    bnkName;
    bnkShortName;
    bnkAlias;
    bnkRbiCode;
    bnkIbanSupported;
    bnkIsActive;
    bnkIsDeleted;
    bnkSyncDate;
    bnkCreatedOn;
    bnkCreatedBy;
    bnkModifiedOn;
    bnkModifiedBy;
}
exports.BankListPayloadDto = BankListPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BankListPayloadDto.prototype, "bnkId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], BankListPayloadDto.prototype, "bnkName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 80, nullable: true }),
    __metadata("design:type", Object)
], BankListPayloadDto.prototype, "bnkShortName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120, nullable: true }),
    __metadata("design:type", Object)
], BankListPayloadDto.prototype, "bnkAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], BankListPayloadDto.prototype, "bnkRbiCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], BankListPayloadDto.prototype, "bnkIbanSupported", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BankListPayloadDto.prototype, "bnkIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], BankListPayloadDto.prototype, "bnkIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BankListPayloadDto.prototype, "bnkSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BankListPayloadDto.prototype, "bnkCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BankListPayloadDto.prototype, "bnkCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BankListPayloadDto.prototype, "bnkModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BankListPayloadDto.prototype, "bnkModifiedBy", void 0);
class BankListDeleteResultDto {
    bnkId;
    deleted;
}
exports.BankListDeleteResultDto = BankListDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BankListDeleteResultDto.prototype, "bnkId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BankListDeleteResultDto.prototype, "deleted", void 0);
class BankListSuccessSingleDto {
    success;
    message;
    data;
}
exports.BankListSuccessSingleDto = BankListSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BankListSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bank fetched successfully' }),
    __metadata("design:type", String)
], BankListSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BankListPayloadDto }),
    __metadata("design:type", BankListPayloadDto)
], BankListSuccessSingleDto.prototype, "data", void 0);
class BankListSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.BankListSuccessListDto = BankListSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BankListSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Banks fetched successfully' }),
    __metadata("design:type", String)
], BankListSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BankListPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], BankListSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.FixedListMetaDto }),
    __metadata("design:type", module_response_dto_1.FixedListMetaDto)
], BankListSuccessListDto.prototype, "meta", void 0);
class BankListSuccessDeleteDto {
    success;
    message;
    data;
}
exports.BankListSuccessDeleteDto = BankListSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BankListSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bank deleted successfully' }),
    __metadata("design:type", String)
], BankListSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BankListDeleteResultDto }),
    __metadata("design:type", BankListDeleteResultDto)
], BankListSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=bank-list-response.dto.js.map