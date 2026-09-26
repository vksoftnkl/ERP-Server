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
exports.SaveTaxRateLedgerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveTaxRateLedgerDto {
    trl_id;
    trl_role;
    trl_supply_nature;
    trl_ledger_id;
    trl_remarks;
    trl_is_active;
    trl_created_by;
    trl_modified_by;
}
exports.SaveTaxRateLedgerDto = SaveTaxRateLedgerDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update this existing line; absent = insert a new one. A line already on the ' +
            'rate but missing from the array is soft deleted.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveTaxRateLedgerDto.prototype, "trl_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 30,
        example: 'OUTPUT_CGST',
        description: 'accounts.acc_ledger_role.alr_role. Must be a live role whose alr_by_rate is true — ' +
            'round-off, discount, write-off and advances have nothing to do with a rate and are ' +
            'rejected here.',
    }),
    (0, dtoDecorators_1.TrimmedString)(30),
    __metadata("design:type", String)
], SaveTaxRateLedgerDto.prototype, "trl_role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 5,
        nullable: true,
        enum: ['INTRA', 'INTER'],
        description: 'null (the default) = both natures. Only roles whose alr_by_supply is true may narrow it — ' +
            'a tax role already says the supply nature by which it is used.',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(5),
    __metadata("design:type", Object)
], SaveTaxRateLedgerDto.prototype, "trl_supply_nature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'accounts.acc_ledger_master.led_id. Validated against what the role demands — ledger type, ' +
            'GST duty head and account-group nature — and must be a global ledger, because a rate is ' +
            'shared by every company.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveTaxRateLedgerDto.prototype, "trl_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveTaxRateLedgerDto.prototype, "trl_remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'An inactive line is kept but ignored by the resolver.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveTaxRateLedgerDto.prototype, "trl_is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveTaxRateLedgerDto.prototype, "trl_created_by", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveTaxRateLedgerDto.prototype, "trl_modified_by", void 0);
//# sourceMappingURL=save-tax-rate-ledger.dto.js.map