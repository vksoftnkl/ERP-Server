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
exports.CityMasterCreateSuccessDto = exports.CityMasterCreateResultDto = exports.CitySuccessDeleteDto = exports.CitySuccessSingleDto = exports.CityDeleteResultDto = exports.CityPayloadDto = exports.CityErrorResponseDto = exports.CityErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "CityErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "CityErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class CityPayloadDto {
    ctmId;
    ctmName;
    ctmAlias;
    ctmShort;
    ctmStateId;
    ctmStateName;
    ctmOrder;
    ctmDescription;
    ctmIsActive;
    ctmIsDeleted;
    ctmSyncDate;
    ctmCreatedOn;
    ctmCreatedBy;
    ctmModifiedOn;
    ctmModifiedBy;
}
exports.CityPayloadDto = CityPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CityPayloadDto.prototype, "ctmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], CityPayloadDto.prototype, "ctmName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmShort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CityPayloadDto.prototype, "ctmStateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Tamil Nadu',
        description: 'Name of the linked state (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmStateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], CityPayloadDto.prototype, "ctmOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CityPayloadDto.prototype, "ctmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CityPayloadDto.prototype, "ctmIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CityPayloadDto.prototype, "ctmCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CityPayloadDto.prototype, "ctmModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], CityPayloadDto.prototype, "ctmModifiedBy", void 0);
class CityDeleteResultDto {
    ctmId;
    deleted;
}
exports.CityDeleteResultDto = CityDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CityDeleteResultDto.prototype, "ctmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CityDeleteResultDto.prototype, "deleted", void 0);
class CitySuccessSingleDto {
    success;
    message;
    data;
}
exports.CitySuccessSingleDto = CitySuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CitySuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'City fetched successfully' }),
    __metadata("design:type", String)
], CitySuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CityPayloadDto }),
    __metadata("design:type", CityPayloadDto)
], CitySuccessSingleDto.prototype, "data", void 0);
class CitySuccessDeleteDto {
    success;
    message;
    data;
}
exports.CitySuccessDeleteDto = CitySuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CitySuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'City deleted successfully' }),
    __metadata("design:type", String)
], CitySuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CityDeleteResultDto }),
    __metadata("design:type", CityDeleteResultDto)
], CitySuccessDeleteDto.prototype, "data", void 0);
class CityMasterCreateResultDto {
    cityMaster;
    accGroupId;
}
exports.CityMasterCreateResultDto = CityMasterCreateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: CityPayloadDto }),
    __metadata("design:type", CityPayloadDto)
], CityMasterCreateResultDto.prototype, "cityMaster", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Linked account group id (equals ctmId)' }),
    __metadata("design:type", String)
], CityMasterCreateResultDto.prototype, "accGroupId", void 0);
class CityMasterCreateSuccessDto {
    success;
    message;
    data;
}
exports.CityMasterCreateSuccessDto = CityMasterCreateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CityMasterCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'City created successfully' }),
    __metadata("design:type", String)
], CityMasterCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CityMasterCreateResultDto }),
    __metadata("design:type", CityMasterCreateResultDto)
], CityMasterCreateSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=city-response.dto.js.map