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
exports.UpdateMobileCustomerDto = exports.CreateMobileCustomerDto = exports.ListMobileCustomersQueryDto = exports.MOBILE_CUSTOMER_MAX_PAGE_SIZE = exports.MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const save_customer_dto_1 = require("../../../modules/sales/customer/dto/save-customer.dto");
const mobile_customer_api_types_1 = require("../types/mobile-customer-api.types");
exports.MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE = 50;
exports.MOBILE_CUSTOMER_MAX_PAGE_SIZE = 200;
class ListMobileCustomersQueryDto {
    search;
    filter;
    page;
    pageSize;
}
exports.ListMobileCustomersQueryDto = ListMobileCustomersQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        description: 'Matches name, short name, code, city, GSTIN and the phone / WhatsApp numbers (any case). ' +
            'A number typed with spaces ("98431 23456") still matches.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], ListMobileCustomersQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: mobile_customer_api_types_1.MOBILE_CUSTOMER_FILTERS, default: 'ALL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(mobile_customer_api_types_1.MOBILE_CUSTOMER_FILTERS),
    __metadata("design:type", String)
], ListMobileCustomersQueryDto.prototype, "filter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], ListMobileCustomersQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.MOBILE_CUSTOMER_MAX_PAGE_SIZE,
        default: exports.MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE,
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, exports.MOBILE_CUSTOMER_MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], ListMobileCustomersQueryDto.prototype, "pageSize", void 0);
class CreateMobileCustomerDto extends (0, swagger_1.OmitType)(save_customer_dto_1.SaveCustomerDto, ['cusId']) {
}
exports.CreateMobileCustomerDto = CreateMobileCustomerDto;
class UpdateMobileCustomerDto extends (0, swagger_1.OmitType)(save_customer_dto_1.SaveCustomerDto, [
    'cusId',
    'cusLinkLedId',
]) {
    cusId;
}
exports.UpdateMobileCustomerDto = UpdateMobileCustomerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The customer to update' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], UpdateMobileCustomerDto.prototype, "cusId", void 0);
//# sourceMappingURL=mobile-customer.dto.js.map