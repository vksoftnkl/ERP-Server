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
exports.DeliveryChallanTransportDto = exports.ConvertPurposeDto = exports.DC_PURPOSES = exports.AmendDeliveryChallanDto = exports.CancelDeliveryChallanDto = exports.PostDeliveryChallanDto = exports.ValidateDeliveryChallanDto = exports.DeliveryChallanKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_delivery_challan_dto_1 = require("./save-delivery-challan.dto");
class DeliveryChallanKeysDto {
    sdcId;
    sdcCompanyId;
    sdcBranchId;
    sdcAccYear;
}
exports.DeliveryChallanKeysDto = DeliveryChallanKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryChallanKeysDto.prototype, "sdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryChallanKeysDto.prototype, "sdcCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeliveryChallanKeysDto.prototype, "sdcBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeliveryChallanKeysDto.prototype, "sdcAccYear", void 0);
class ValidateDeliveryChallanDto extends save_delivery_challan_dto_1.SaveDeliveryChallanDto {
    overrides;
}
exports.ValidateDeliveryChallanDto = ValidateDeliveryChallanDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ValidateDeliveryChallanDto.prototype, "overrides", void 0);
class PostDeliveryChallanDto extends DeliveryChallanKeysDto {
    overrides;
    printAfter;
}
exports.PostDeliveryChallanDto = PostDeliveryChallanDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PostDeliveryChallanDto.prototype, "overrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], PostDeliveryChallanDto.prototype, "printAfter", void 0);
class CancelDeliveryChallanDto extends DeliveryChallanKeysDto {
    reason;
}
exports.CancelDeliveryChallanDto = CancelDeliveryChallanDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelDeliveryChallanDto.prototype, "reason", void 0);
class AmendDeliveryChallanDto extends ValidateDeliveryChallanDto {
    baseRevision;
    editRemark;
}
exports.AmendDeliveryChallanDto = AmendDeliveryChallanDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendDeliveryChallanDto.prototype, "sdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], AmendDeliveryChallanDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AmendDeliveryChallanDto.prototype, "editRemark", void 0);
exports.DC_PURPOSES = [
    'SUPPLY',
    'JOB_WORK',
    'APPROVAL',
    'EXHIBITION',
    'OWN_USE',
    'LINE_SALES',
    'OTHER',
];
class ConvertPurposeDto extends DeliveryChallanKeysDto {
    purpose;
    remark;
}
exports.ConvertPurposeDto = ConvertPurposeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.DC_PURPOSES }),
    (0, class_validator_1.IsIn)(exports.DC_PURPOSES),
    __metadata("design:type", Object)
], ConvertPurposeDto.prototype, "purpose", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConvertPurposeDto.prototype, "remark", void 0);
class DeliveryChallanTransportDto extends DeliveryChallanKeysDto {
    transport;
}
exports.DeliveryChallanTransportDto = DeliveryChallanTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: bill_lifecycle_dto_1.TransportBandDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => bill_lifecycle_dto_1.TransportBandDto),
    __metadata("design:type", bill_lifecycle_dto_1.TransportBandDto)
], DeliveryChallanTransportDto.prototype, "transport", void 0);
//# sourceMappingURL=delivery-challan-lifecycle.dto.js.map