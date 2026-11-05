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
exports.CustomerDetailQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
class CustomerDetailQueryDto {
    cus_id;
    company_id;
    branch_id;
    regional;
}
exports.CustomerDetailQueryDto = CustomerDetailQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Customer id (legacy isale_cust_id)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CustomerDetailQueryDto.prototype, "cus_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Company id (legacy icompany_id)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CustomerDetailQueryDto.prototype, "company_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Branch id (sales context)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CustomerDetailQueryDto.prototype, "branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Regional name (legacy iregional). When true, name/address use the regional-language fields, else the English fields.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], CustomerDetailQueryDto.prototype, "regional", void 0);
//# sourceMappingURL=customer-detail-query.dto.js.map