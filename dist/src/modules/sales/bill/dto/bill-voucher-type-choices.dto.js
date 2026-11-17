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
exports.BillVoucherTypeChoicesQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class BillVoucherTypeChoicesQueryDto {
    companyId;
    branchId;
    accYear;
    deviceId;
    billMode;
}
exports.BillVoucherTypeChoicesQueryDto = BillVoucherTypeChoicesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BillVoucherTypeChoicesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], BillVoucherTypeChoicesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BillVoucherTypeChoicesQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The device (fixed.device_master id, as sbDeviceId): its sales.bill_voucher_type is the default.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], BillVoucherTypeChoicesQueryDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['POS', 'WHOLESALE'],
        description: "Which counter Sales Bill (3) itself numbers from: the device's when POS and sales.pos_series_per_device. " +
            'Default WHOLESALE. A child type always uses the branch counter.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['POS', 'WHOLESALE']),
    __metadata("design:type", String)
], BillVoucherTypeChoicesQueryDto.prototype, "billMode", void 0);
//# sourceMappingURL=bill-voucher-type-choices.dto.js.map