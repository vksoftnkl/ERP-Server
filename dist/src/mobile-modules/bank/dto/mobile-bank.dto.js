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
exports.MobileBankListQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
class MobileBankListQueryDto {
    deviceUid;
}
exports.MobileBankListQueryDto = MobileBankListQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid (fixed.device_master.dev_device_uid): an unknown, " +
            'blocked or switched-off phone is refused with a 403, as on every mobile read.',
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileBankListQueryDto.prototype, "deviceUid", void 0);
//# sourceMappingURL=mobile-bank.dto.js.map