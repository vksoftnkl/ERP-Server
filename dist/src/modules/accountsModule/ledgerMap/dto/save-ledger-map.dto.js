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
exports.DeleteLedgerMapQueryDto = exports.SaveLedgerMapDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveLedgerMapDto {
    almId;
    role;
    ledgerId;
    isActive;
    remarks;
    almCompanyId;
    almBranchId;
    almSupplyNature;
}
exports.SaveLedgerMapDto = SaveLedgerMapDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, the request re-points that existing mapping instead of adding one',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveLedgerMapDto.prototype, "almId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 30,
        example: 'DISCOUNT_ALLOWED',
        description: 'accounts.acc_ledger_role.alr_role — one of the codes /ledger-map/roles lists',
    }),
    (0, dtoDecorators_1.UpperMaxString)(30),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveLedgerMapDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The ledger the role posts to. Must be a live, global ledger of the type the role demands',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveLedgerMapDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Defaults to true. False keeps the row but stops it resolving',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveLedgerMapDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveLedgerMapDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, class_validator_1.IsEmpty)({
        message: 'almCompanyId is not accepted — /ledger-map manages the shared mapping only, ' +
            'the one every company uses',
    }),
    __metadata("design:type", void 0)
], SaveLedgerMapDto.prototype, "almCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, class_validator_1.IsEmpty)({
        message: 'almBranchId is not accepted — /ledger-map manages the shared mapping only, ' +
            'the one every branch uses',
    }),
    __metadata("design:type", void 0)
], SaveLedgerMapDto.prototype, "almBranchId", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, class_validator_1.IsEmpty)({
        message: 'almSupplyNature is not accepted — a mapping here answers for INTRA and INTER alike; ' +
            'a per-rate answer belongs on the tax rate, in inventory.tax_rate_ledger',
    }),
    __metadata("design:type", void 0)
], SaveLedgerMapDto.prototype, "almSupplyNature", void 0);
class DeleteLedgerMapQueryDto {
    almId;
}
exports.DeleteLedgerMapQueryDto = DeleteLedgerMapQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeleteLedgerMapQueryDto.prototype, "almId", void 0);
//# sourceMappingURL=save-ledger-map.dto.js.map