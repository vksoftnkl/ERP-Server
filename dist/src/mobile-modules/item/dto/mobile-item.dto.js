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
exports.ListMobileItemsQueryDto = exports.MOBILE_DEVICE_UID_MAX_LENGTH = exports.MOBILE_ITEM_MAX_PAGE_SIZE = exports.MOBILE_ITEM_DEFAULT_PAGE_SIZE = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
exports.MOBILE_ITEM_DEFAULT_PAGE_SIZE = 200;
exports.MOBILE_ITEM_MAX_PAGE_SIZE = 500;
exports.MOBILE_DEVICE_UID_MAX_LENGTH = 120;
class ListMobileItemsQueryDto {
    companyId;
    deviceUid;
    page;
    pageSize;
}
exports.ListMobileItemsQueryDto = ListMobileItemsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company the order is for' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListMobileItemsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: exports.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid. When sent, prices are read for the phone's own branch " +
            '(when it belongs to the company), the branch its orders are saved in; an unknown or blocked ' +
            "phone is refused (403). Omitted: the company's default branch.",
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(exports.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ListMobileItemsQueryDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], ListMobileItemsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.MOBILE_ITEM_MAX_PAGE_SIZE,
        default: exports.MOBILE_ITEM_DEFAULT_PAGE_SIZE,
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, exports.MOBILE_ITEM_MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], ListMobileItemsQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=mobile-item.dto.js.map