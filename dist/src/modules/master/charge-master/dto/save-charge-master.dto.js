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
exports.SaveChargeMasterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const charge_master_api_types_1 = require("../types/charge-master-api.types");
class SaveChargeMasterDto {
    chgId;
    chgName;
    chgCode;
    chgModule;
    chgRole;
    chgMethod;
    chgType;
    chgApplyOn;
    chgDefaultRate;
    chgLandingCost;
    chgCostAlloc;
    chgLedgerCode;
    chgTaxApl;
    chgBeforeTax;
    chgSepPost;
    chgManParty;
    chgDispOrder;
    chgAutoApply;
    chgIsActive;
    chgCreatedBy;
    chgModifiedBy;
}
exports.SaveChargeMasterDto = SaveChargeMasterDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing charge',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100, example: 'Freight' }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true, description: 'Business code (unique)' }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveChargeMasterDto.prototype, "chgCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_MODULES, description: "'P'urchase / 'S'ales / 'B'oth" }),
    (0, dtoDecorators_1.UpperMaxString)(1),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_MODULES),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_master_api_types_1.CHARGE_ROLES, nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(15),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_ROLES, { message: `chgRole must be one of: ${charge_master_api_types_1.CHARGE_ROLES.join(', ')}` }),
    __metadata("design:type", Object)
], SaveChargeMasterDto.prototype, "chgRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_METHODS }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_METHODS),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_master_api_types_1.CHARGE_TYPES, default: 'ADD' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(10),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_TYPES),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_master_api_types_1.CHARGE_APPLY_ONS }),
    (0, dtoDecorators_1.UpperMaxString)(10),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_APPLY_ONS),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgApplyOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0, description: 'Optional default rate/%' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeMasterDto.prototype, "chgDefaultRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Purchase only' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgLandingCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_master_api_types_1.CHARGE_COST_ALLOCS, nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_COST_ALLOCS, { message: `chgCostAlloc must be one of: ${charge_master_api_types_1.CHARGE_COST_ALLOCS.join(', ')}` }),
    __metadata("design:type", Object)
], SaveChargeMasterDto.prototype, "chgCostAlloc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'GL ledger mapping' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgLedgerCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Charge itself taxable' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgTaxApl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Deduct/add before tax calc?' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Post to own ledger vs absorb' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgSepPost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Requires a party (e.g. freight vendor)' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgManParty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, default: 0, description: 'Grid ordering' }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveChargeMasterDto.prototype, "chgDispOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Auto-load into new entry' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgAutoApply", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeMasterDto.prototype, "chgIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Audit user who created the charge; defaults to the authenticated user when omitted',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Audit user who last modified the charge; defaults to the authenticated user when omitted',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeMasterDto.prototype, "chgModifiedBy", void 0);
//# sourceMappingURL=save-charge-master.dto.js.map