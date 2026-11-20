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
exports.ActiveMobileSchemesQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
class ActiveMobileSchemesQueryDto {
    companyId;
    deviceUid;
}
exports.ActiveMobileSchemesQueryDto = ActiveMobileSchemesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company whose schemes the phone downloads' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ActiveMobileSchemesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid. When sent, an unknown, blocked or switched-off phone " +
            'is refused (403), as /mobile/items/list does. It does not narrow the answer: every ' +
            "branch row of a scheme is sent, and the phone checks the order's own branch.",
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ActiveMobileSchemesQueryDto.prototype, "deviceUid", void 0);
//# sourceMappingURL=mobile-scheme.dto.js.map