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
exports.SaveCustomerGroupDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveCustomerGroupDto {
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
}
exports.SaveCustomerGroupDto = SaveCustomerGroupDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing customer group',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveCustomerGroupDto.prototype, "cgrId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCustomerGroupDto.prototype, "cgrCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveCustomerGroupDto.prototype, "cgrBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveCustomerGroupDto.prototype, "cgrName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveCustomerGroupDto.prototype, "cgrAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveCustomerGroupDto.prototype, "cgrShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveCustomerGroupDto.prototype, "cgrNarration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveCustomerGroupDto.prototype, "cgrOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveCustomerGroupDto.prototype, "cgrDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [Number],
        description: 'Collection days as integer array (JSON array or comma-separated values)',
    }),
    (0, dtoDecorators_1.OptionalIntegerArray)(),
    __metadata("design:type", Array)
], SaveCustomerGroupDto.prototype, "cgrCollectionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerGroupDto.prototype, "cgrDebitAllowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerGroupDto.prototype, "cgrDebitDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Number)
], SaveCustomerGroupDto.prototype, "cgrDebitLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Number)
], SaveCustomerGroupDto.prototype, "cgrBillsLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerGroupDto.prototype, "cgrOverdueBilling", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveCustomerGroupDto.prototype, "cgrIsActive", void 0);
//# sourceMappingURL=save-customer-group.dto.js.map