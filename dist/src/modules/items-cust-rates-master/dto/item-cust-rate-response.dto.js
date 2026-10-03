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
exports.ItemCustRateSuccessDeleteDto = exports.ItemCustRateSuccessListDto = exports.ItemCustRateSuccessSingleDto = exports.ItemCustRateDeleteResultDto = exports.ItemCustRatePayloadDto = exports.ItemCustRateListMetaDto = exports.ItemCustRateErrorResponseDto = exports.ItemCustRateErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../common/utils/module-response.dto");
Object.defineProperty(exports, "ItemCustRateErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorFieldDto; } });
Object.defineProperty(exports, "ItemCustRateErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorResponseDto; } });
Object.defineProperty(exports, "ItemCustRateListMetaDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleListMetaDto; } });
class ItemCustRatePayloadDto {
    csr_id;
    csr_branch_id;
    csr_customer_id;
    csr_unit_rate_id;
    csr_rate_type;
    csr_item_rate;
    csr_disc_perc;
    csr_disc_qty;
    csr_price_level;
    csr_valid_from;
    csr_valid_to;
    csr_priority;
    csr_is_active;
    csr_is_deleted;
    csr_created_on;
    csr_created_by;
    csr_modified_on;
    csr_modified_by;
    csr_uploaded_at;
    csr_uploaded_by;
    csr_remarks;
}
exports.ItemCustRatePayloadDto = ItemCustRatePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemCustRatePayloadDto.prototype, "csr_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemCustRatePayloadDto.prototype, "csr_customer_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemCustRatePayloadDto.prototype, "csr_unit_rate_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'FIXED' }),
    __metadata("design:type", String)
], ItemCustRatePayloadDto.prototype, "csr_rate_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemCustRatePayloadDto.prototype, "csr_item_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemCustRatePayloadDto.prototype, "csr_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemCustRatePayloadDto.prototype, "csr_disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1, nullable: true, example: 'A' }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_price_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_valid_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_valid_to", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemCustRatePayloadDto.prototype, "csr_priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCustRatePayloadDto.prototype, "csr_is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ItemCustRatePayloadDto.prototype, "csr_is_deleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemCustRatePayloadDto.prototype, "csr_created_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemCustRatePayloadDto.prototype, "csr_modified_on", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_modified_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_uploaded_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_uploaded_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ItemCustRatePayloadDto.prototype, "csr_remarks", void 0);
class ItemCustRateDeleteResultDto {
    csr_id;
    deleted;
}
exports.ItemCustRateDeleteResultDto = ItemCustRateDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemCustRateDeleteResultDto.prototype, "csr_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCustRateDeleteResultDto.prototype, "deleted", void 0);
class ItemCustRateSuccessSingleDto {
    success;
    message;
    data;
}
exports.ItemCustRateSuccessSingleDto = ItemCustRateSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCustRateSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item customer rate fetched successfully' }),
    __metadata("design:type", String)
], ItemCustRateSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCustRatePayloadDto }),
    __metadata("design:type", ItemCustRatePayloadDto)
], ItemCustRateSuccessSingleDto.prototype, "data", void 0);
class ItemCustRateSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.ItemCustRateSuccessListDto = ItemCustRateSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCustRateSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item customer rates fetched successfully' }),
    __metadata("design:type", String)
], ItemCustRateSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCustRatePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ItemCustRateSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: module_response_dto_1.ModuleListMetaDto }),
    __metadata("design:type", module_response_dto_1.ModuleListMetaDto)
], ItemCustRateSuccessListDto.prototype, "meta", void 0);
class ItemCustRateSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ItemCustRateSuccessDeleteDto = ItemCustRateSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemCustRateSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item customer rate deleted successfully' }),
    __metadata("design:type", String)
], ItemCustRateSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemCustRateDeleteResultDto }),
    __metadata("design:type", ItemCustRateDeleteResultDto)
], ItemCustRateSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=item-cust-rate-response.dto.js.map