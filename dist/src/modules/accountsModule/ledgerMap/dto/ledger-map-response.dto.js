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
exports.LedgerMapSuccessDeleteDto = exports.LedgerMapSuccessSingleDto = exports.LedgerMapRolesSuccessDto = exports.LedgerMapDeleteResultDto = exports.LedgerMapRolePayloadDto = exports.LedgerMapErrorResponseDto = exports.LedgerMapErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class LedgerMapErrorFieldDto {
    field;
    message;
}
exports.LedgerMapErrorFieldDto = LedgerMapErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ledgerId' }),
    __metadata("design:type", String)
], LedgerMapErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Discount allowed needs a EXPENSE ledger, but "HDFC Current A/c" is "BANK"',
    }),
    __metadata("design:type", String)
], LedgerMapErrorFieldDto.prototype, "message", void 0);
class LedgerMapErrorResponseDto {
    success;
    message;
    errors;
}
exports.LedgerMapErrorResponseDto = LedgerMapErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LedgerMapErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], LedgerMapErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerMapErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], LedgerMapErrorResponseDto.prototype, "errors", void 0);
class LedgerMapRolePayloadDto {
    role;
    label;
    group;
    sortOrder;
    expectedLedgerType;
    expectedDutyHead;
    expectedGroupNature;
    roleIsActive;
    usedBy;
    almId;
    ledgerId;
    ledgerName;
    ledgerIsActive;
    ledgerIsDeleted;
    isActive;
    remarks;
}
exports.LedgerMapRolePayloadDto = LedgerMapRolePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DISCOUNT_ALLOWED', maxLength: 30 }),
    __metadata("design:type", String)
], LedgerMapRolePayloadDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Discount allowed', maxLength: 60 }),
    __metadata("design:type", String)
], LedgerMapRolePayloadDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'SHARED',
        enum: ['REVENUE', 'OUTPUT_TAX', 'PURCHASE', 'INPUT_TAX', 'SHARED', 'RECEIPT', 'FUTURE'],
    }),
    __metadata("design:type", String)
], LedgerMapRolePayloadDto.prototype, "group", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 220 }),
    __metadata("design:type", Number)
], LedgerMapRolePayloadDto.prototype, "sortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'EXPENSE',
        description: 'The ledger type this role demands. Null = not checked on this axis',
    }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "expectedLedgerType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "expectedDutyHead", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Expenses' }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "expectedGroupNature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerMapRolePayloadDto.prototype, "roleIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        isArray: true,
        type: String,
        example: ['RECEIPT'],
        description: 'The documents that post this role today. Non-empty, and /delete refuses',
    }),
    __metadata("design:type", Array)
], LedgerMapRolePayloadDto.prototype, "usedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid', description: 'Null = unmapped' }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "almId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid', description: 'Null = unmapped' }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Discount Allowed' }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "ledgerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: true }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "ledgerIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: false }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "ledgerIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: true }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerMapRolePayloadDto.prototype, "remarks", void 0);
class LedgerMapDeleteResultDto {
    almId;
    role;
    deleted;
}
exports.LedgerMapDeleteResultDto = LedgerMapDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], LedgerMapDeleteResultDto.prototype, "almId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PURCHASE_RETURN' }),
    __metadata("design:type", String)
], LedgerMapDeleteResultDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerMapDeleteResultDto.prototype, "deleted", void 0);
class LedgerMapRolesSuccessDto {
    success;
    message;
    data;
}
exports.LedgerMapRolesSuccessDto = LedgerMapRolesSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerMapRolesSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Posting roles fetched successfully' }),
    __metadata("design:type", String)
], LedgerMapRolesSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerMapRolePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], LedgerMapRolesSuccessDto.prototype, "data", void 0);
class LedgerMapSuccessSingleDto {
    success;
    message;
    data;
}
exports.LedgerMapSuccessSingleDto = LedgerMapSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerMapSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Posting ledger mapped successfully' }),
    __metadata("design:type", String)
], LedgerMapSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerMapRolePayloadDto }),
    __metadata("design:type", LedgerMapRolePayloadDto)
], LedgerMapSuccessSingleDto.prototype, "data", void 0);
class LedgerMapSuccessDeleteDto {
    success;
    message;
    data;
}
exports.LedgerMapSuccessDeleteDto = LedgerMapSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerMapSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Posting ledger mapping removed successfully' }),
    __metadata("design:type", String)
], LedgerMapSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerMapDeleteResultDto }),
    __metadata("design:type", LedgerMapDeleteResultDto)
], LedgerMapSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=ledger-map-response.dto.js.map