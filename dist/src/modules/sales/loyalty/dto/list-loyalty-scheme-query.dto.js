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
exports.ListLoyaltySchemeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const loyalty_dto_helpers_1 = require("./loyalty-dto.helpers");
class ListLoyaltySchemeQueryDto {
    lsc_comp_id;
    lsc_branch_id;
    company;
    company_id;
    comp_id;
    branch;
    branch_id;
}
exports.ListLoyaltySchemeQueryDto = ListLoyaltySchemeQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'company.comp_id — optional. Omit it to list across every company. Also accepted as ' +
            '`company`, `company_id`, `comp_id`',
    }),
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, loyalty_dto_helpers_1.toOptionalUuid)((0, loyalty_dto_helpers_1.resolveAliasValue)(value, obj, ['company', 'company_id', 'comp_id']))),
    (0, class_validator_1.Matches)(loyalty_dto_helpers_1.UUID_PATTERN, { message: 'lsc_comp_id must be a valid UUID' }),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "lsc_comp_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
        description: 'branch_master.br_id — optional. Matches the lsc_branch_id column literally: omit it to ' +
            'get every scheme in scope, company-wide ones (lsc_branch_id NULL) included. Also ' +
            'accepted as `branch`, `branch_id`',
    }),
    (0, class_transformer_1.Expose)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value, obj }) => (0, loyalty_dto_helpers_1.toOptionalUuid)((0, loyalty_dto_helpers_1.resolveAliasValue)(value, obj, ['branch', 'branch_id']))),
    (0, class_validator_1.Matches)(loyalty_dto_helpers_1.UUID_PATTERN, { message: 'lsc_branch_id must be a valid UUID' }),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "lsc_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "company", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "comp_id", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "branch", void 0);
__decorate([
    (0, swagger_1.ApiHideProperty)(),
    (0, loyalty_dto_helpers_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListLoyaltySchemeQueryDto.prototype, "branch_id", void 0);
//# sourceMappingURL=list-loyalty-scheme-query.dto.js.map