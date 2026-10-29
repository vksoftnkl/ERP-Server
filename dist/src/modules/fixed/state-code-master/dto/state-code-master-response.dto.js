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
exports.StateCodeMasterSuccessDeleteDto = exports.StateCodeMasterSuccessListDto = exports.StateCodeMasterSuccessSingleDto = exports.StateCodeMasterDeleteResultDto = exports.StateCodeMasterPayloadDto = exports.StateCodeMasterListMetaDto = exports.StateCodeMasterErrorResponseDto = exports.StateCodeMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "StateCodeMasterErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorFieldDto; } });
Object.defineProperty(exports, "StateCodeMasterErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.FixedErrorResponseDto; } });
Object.defineProperty(exports, "StateCodeMasterListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.FixedListMetaDto; } });
class StateCodeMasterPayloadDto {
    stateCode;
    stateName;
    stateUt;
    tinCode;
    isActive;
    isDeleted;
    stateSyncDate;
    createdOn;
    createdBy;
    modifiedOn;
    modifiedBy;
}
exports.StateCodeMasterPayloadDto = StateCodeMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 2, maxLength: 2 }),
    __metadata("design:type", String)
], StateCodeMasterPayloadDto.prototype, "stateCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    __metadata("design:type", String)
], StateCodeMasterPayloadDto.prototype, "stateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StateCodeMasterPayloadDto.prototype, "stateUt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], StateCodeMasterPayloadDto.prototype, "tinCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateCodeMasterPayloadDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StateCodeMasterPayloadDto.prototype, "isDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StateCodeMasterPayloadDto.prototype, "stateSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StateCodeMasterPayloadDto.prototype, "createdOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StateCodeMasterPayloadDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StateCodeMasterPayloadDto.prototype, "modifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StateCodeMasterPayloadDto.prototype, "modifiedBy", void 0);
class StateCodeMasterDeleteResultDto {
    stateCode;
    deleted;
}
exports.StateCodeMasterDeleteResultDto = StateCodeMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 2, maxLength: 2 }),
    __metadata("design:type", String)
], StateCodeMasterDeleteResultDto.prototype, "stateCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateCodeMasterDeleteResultDto.prototype, "deleted", void 0);
class StateCodeMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.StateCodeMasterSuccessSingleDto = StateCodeMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateCodeMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'State code fetched successfully' }),
    __metadata("design:type", String)
], StateCodeMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StateCodeMasterPayloadDto }),
    __metadata("design:type", StateCodeMasterPayloadDto)
], StateCodeMasterSuccessSingleDto.prototype, "data", void 0);
class StateCodeMasterSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.StateCodeMasterSuccessListDto = StateCodeMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateCodeMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'State codes fetched successfully' }),
    __metadata("design:type", String)
], StateCodeMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StateCodeMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], StateCodeMasterSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.FixedListMetaDto }),
    __metadata("design:type", module_response_dto_1.FixedListMetaDto)
], StateCodeMasterSuccessListDto.prototype, "meta", void 0);
class StateCodeMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.StateCodeMasterSuccessDeleteDto = StateCodeMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateCodeMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'State code deleted successfully' }),
    __metadata("design:type", String)
], StateCodeMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StateCodeMasterDeleteResultDto }),
    __metadata("design:type", StateCodeMasterDeleteResultDto)
], StateCodeMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=state-code-master-response.dto.js.map