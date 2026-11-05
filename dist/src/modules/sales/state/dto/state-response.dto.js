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
exports.StateMasterCreateSuccessDto = exports.StateMasterCreateResultDto = exports.StateSuccessDeleteDto = exports.StateSuccessSingleDto = exports.StateDeleteResultDto = exports.StatePayloadDto = exports.StateErrorResponseDto = exports.StateErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "StateErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "StateErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class StatePayloadDto {
    stmId;
    stmName;
    stmAlias;
    stmShort;
    stmOrder;
    stmDescription;
    stmIsActive;
    stmIsDeleted;
    stmSyncDate;
    stmCreatedOn;
    stmCreatedBy;
    stmModifiedOn;
    stmModifiedBy;
}
exports.StatePayloadDto = StatePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StatePayloadDto.prototype, "stmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    __metadata("design:type", String)
], StatePayloadDto.prototype, "stmName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], StatePayloadDto.prototype, "stmAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], StatePayloadDto.prototype, "stmShort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], StatePayloadDto.prototype, "stmOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StatePayloadDto.prototype, "stmDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StatePayloadDto.prototype, "stmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StatePayloadDto.prototype, "stmIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StatePayloadDto.prototype, "stmSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StatePayloadDto.prototype, "stmCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StatePayloadDto.prototype, "stmCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StatePayloadDto.prototype, "stmModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], StatePayloadDto.prototype, "stmModifiedBy", void 0);
class StateDeleteResultDto {
    stmId;
    deleted;
}
exports.StateDeleteResultDto = StateDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], StateDeleteResultDto.prototype, "stmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateDeleteResultDto.prototype, "deleted", void 0);
class StateSuccessSingleDto {
    success;
    message;
    data;
}
exports.StateSuccessSingleDto = StateSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'State fetched successfully' }),
    __metadata("design:type", String)
], StateSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StatePayloadDto }),
    __metadata("design:type", StatePayloadDto)
], StateSuccessSingleDto.prototype, "data", void 0);
class StateSuccessDeleteDto {
    success;
    message;
    data;
}
exports.StateSuccessDeleteDto = StateSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'State deleted successfully' }),
    __metadata("design:type", String)
], StateSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StateDeleteResultDto }),
    __metadata("design:type", StateDeleteResultDto)
], StateSuccessDeleteDto.prototype, "data", void 0);
class StateMasterCreateResultDto {
    stateMaster;
    accGroupId;
}
exports.StateMasterCreateResultDto = StateMasterCreateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: StatePayloadDto }),
    __metadata("design:type", StatePayloadDto)
], StateMasterCreateResultDto.prototype, "stateMaster", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Linked account group id (equals stmId)' }),
    __metadata("design:type", String)
], StateMasterCreateResultDto.prototype, "accGroupId", void 0);
class StateMasterCreateSuccessDto {
    success;
    message;
    data;
}
exports.StateMasterCreateSuccessDto = StateMasterCreateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StateMasterCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'State created successfully' }),
    __metadata("design:type", String)
], StateMasterCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StateMasterCreateResultDto }),
    __metadata("design:type", StateMasterCreateResultDto)
], StateMasterCreateSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=state-response.dto.js.map