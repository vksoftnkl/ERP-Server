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
exports.ListChargeMasterQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const charge_master_api_types_1 = require("../types/charge-master-api.types");
class ListChargeMasterQueryDto {
    search;
    module;
    isActive;
    page;
    limit;
}
exports.ListChargeMasterQueryDto = ListChargeMasterQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Free-text search on name / code / role' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListChargeMasterQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_master_api_types_1.CHARGE_MODULES, description: 'Filter by module (P / S / B)' }),
    (0, dtoDecorators_1.NullableUpperMaxString)(1),
    (0, class_validator_1.IsIn)(charge_master_api_types_1.CHARGE_MODULES),
    __metadata("design:type", Object)
], ListChargeMasterQueryDto.prototype, "module", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by active flag' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListChargeMasterQueryDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], ListChargeMasterQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 100, default: 20 }),
    (0, dtoDecorators_1.OptionalInteger)(1, 100),
    __metadata("design:type", Number)
], ListChargeMasterQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=list-charge-master-query.dto.js.map