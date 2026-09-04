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
exports.AreaMasterCreateSuccessDto = exports.AreaMasterCreateResultDto = exports.AreaSuccessDeleteDto = exports.AreaSuccessSingleDto = exports.AreaDeleteResultDto = exports.AreaPayloadDto = exports.AreaErrorResponseDto = exports.AreaErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "AreaErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "AreaErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class AreaPayloadDto {
    armId;
    armName;
    armAlias;
    armShort;
    armCityId;
    armCityName;
    armSort;
    armDistanceKm;
    armCollectionDays;
    armDescription;
    armIsActive;
    armIsDeleted;
    armSyncDate;
    armCreatedOn;
    armCreatedBy;
    armModifiedOn;
    armModifiedBy;
}
exports.AreaPayloadDto = AreaPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AreaPayloadDto.prototype, "armId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], AreaPayloadDto.prototype, "armName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armShort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AreaPayloadDto.prototype, "armCityId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Coimbatore',
        description: 'Name of the linked city (resolved on the get endpoint)',
    }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armCityName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], AreaPayloadDto.prototype, "armSort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 10 }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armDistanceKm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [Number], example: [] }),
    __metadata("design:type", Array)
], AreaPayloadDto.prototype, "armCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AreaPayloadDto.prototype, "armIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], AreaPayloadDto.prototype, "armIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AreaPayloadDto.prototype, "armCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AreaPayloadDto.prototype, "armModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AreaPayloadDto.prototype, "armModifiedBy", void 0);
class AreaDeleteResultDto {
    armId;
    deleted;
}
exports.AreaDeleteResultDto = AreaDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AreaDeleteResultDto.prototype, "armId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AreaDeleteResultDto.prototype, "deleted", void 0);
class AreaSuccessSingleDto {
    success;
    message;
    data;
}
exports.AreaSuccessSingleDto = AreaSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AreaSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Area fetched successfully' }),
    __metadata("design:type", String)
], AreaSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AreaPayloadDto }),
    __metadata("design:type", AreaPayloadDto)
], AreaSuccessSingleDto.prototype, "data", void 0);
class AreaSuccessDeleteDto {
    success;
    message;
    data;
}
exports.AreaSuccessDeleteDto = AreaSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AreaSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Area deleted successfully' }),
    __metadata("design:type", String)
], AreaSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AreaDeleteResultDto }),
    __metadata("design:type", AreaDeleteResultDto)
], AreaSuccessDeleteDto.prototype, "data", void 0);
class AreaMasterCreateResultDto {
    areaMaster;
    accGroupId;
}
exports.AreaMasterCreateResultDto = AreaMasterCreateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: AreaPayloadDto }),
    __metadata("design:type", AreaPayloadDto)
], AreaMasterCreateResultDto.prototype, "areaMaster", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Linked account group id (equals armId)' }),
    __metadata("design:type", String)
], AreaMasterCreateResultDto.prototype, "accGroupId", void 0);
class AreaMasterCreateSuccessDto {
    success;
    message;
    data;
}
exports.AreaMasterCreateSuccessDto = AreaMasterCreateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AreaMasterCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Area created successfully' }),
    __metadata("design:type", String)
], AreaMasterCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AreaMasterCreateResultDto }),
    __metadata("design:type", AreaMasterCreateResultDto)
], AreaMasterCreateSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=area-response.dto.js.map