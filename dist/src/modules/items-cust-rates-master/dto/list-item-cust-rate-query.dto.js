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
exports.ListItemCustRateQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const module_list_query_base_dto_1 = require("../../../common/utils/module-list-query.base.dto");
class ListItemCustRateQueryDto extends module_list_query_base_dto_1.ModuleListQueryBaseDto {
    csr_branch_id;
    csr_customer_id;
    csr_unit_rate_id;
    csr_rate_type;
    csr_price_level;
    csr_is_active;
}
exports.ListItemCustRateQueryDto = ListItemCustRateQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(120),
    __metadata("design:type", String)
], ListItemCustRateQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListItemCustRateQueryDto.prototype, "csr_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListItemCustRateQueryDto.prototype, "csr_customer_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListItemCustRateQueryDto.prototype, "csr_unit_rate_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], ListItemCustRateQueryDto.prototype, "csr_rate_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1, description: 'A/B/C/D' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(1),
    __metadata("design:type", String)
], ListItemCustRateQueryDto.prototype, "csr_price_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListItemCustRateQueryDto.prototype, "csr_is_active", void 0);
//# sourceMappingURL=list-item-cust-rate-query.dto.js.map