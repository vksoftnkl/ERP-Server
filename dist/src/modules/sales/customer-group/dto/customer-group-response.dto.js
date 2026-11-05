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
exports.CustomerGroupSuccessDeleteDto = exports.CustomerGroupSuccessSingleDto = exports.CustomerGroupDeleteResultDto = exports.CustomerGroupPayloadDto = exports.CustomerGroupErrorResponseDto = exports.CustomerGroupErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "CustomerGroupErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorFieldDto; } });
Object.defineProperty(exports, "CustomerGroupErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.SalesErrorResponseDto; } });
class CustomerGroupPayloadDto {
    cgrId;
    cgrCompanyId;
    cgrBranchId;
    cgrName;
    cgrAlias;
    cgrShort;
    cgrNarration;
    cgrOrder;
    cgrDiscPerc;
    cgrCollectionDays;
    cgrDebitAllowed;
    cgrDebitDays;
    cgrDebitLimit;
    cgrBillsLimit;
    cgrOverdueBilling;
    cgrIsActive;
    cgrIsDeleted;
    cgrCreatedOn;
    cgrModifiedOn;
}
exports.CustomerGroupPayloadDto = CustomerGroupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerGroupPayloadDto.prototype, "cgrId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CustomerGroupPayloadDto.prototype, "cgrCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CustomerGroupPayloadDto.prototype, "cgrBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], CustomerGroupPayloadDto.prototype, "cgrName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], CustomerGroupPayloadDto.prototype, "cgrAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], CustomerGroupPayloadDto.prototype, "cgrShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], CustomerGroupPayloadDto.prototype, "cgrNarration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerGroupPayloadDto.prototype, "cgrOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerGroupPayloadDto.prototype, "cgrDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [Number], example: [] }),
    __metadata("design:type", Array)
], CustomerGroupPayloadDto.prototype, "cgrCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerGroupPayloadDto.prototype, "cgrDebitAllowed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerGroupPayloadDto.prototype, "cgrDebitDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerGroupPayloadDto.prototype, "cgrDebitLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CustomerGroupPayloadDto.prototype, "cgrBillsLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerGroupPayloadDto.prototype, "cgrOverdueBilling", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerGroupPayloadDto.prototype, "cgrIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], CustomerGroupPayloadDto.prototype, "cgrIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CustomerGroupPayloadDto.prototype, "cgrCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CustomerGroupPayloadDto.prototype, "cgrModifiedOn", void 0);
class CustomerGroupDeleteResultDto {
    cgrId;
    deleted;
}
exports.CustomerGroupDeleteResultDto = CustomerGroupDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerGroupDeleteResultDto.prototype, "cgrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerGroupDeleteResultDto.prototype, "deleted", void 0);
class CustomerGroupSuccessSingleDto {
    success;
    message;
    data;
}
exports.CustomerGroupSuccessSingleDto = CustomerGroupSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerGroupSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Customer group fetched successfully' }),
    __metadata("design:type", String)
], CustomerGroupSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CustomerGroupPayloadDto }),
    __metadata("design:type", CustomerGroupPayloadDto)
], CustomerGroupSuccessSingleDto.prototype, "data", void 0);
class CustomerGroupSuccessDeleteDto {
    success;
    message;
    data;
}
exports.CustomerGroupSuccessDeleteDto = CustomerGroupSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerGroupSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Customer group deleted successfully' }),
    __metadata("design:type", String)
], CustomerGroupSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CustomerGroupDeleteResultDto }),
    __metadata("design:type", CustomerGroupDeleteResultDto)
], CustomerGroupSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=customer-group-response.dto.js.map