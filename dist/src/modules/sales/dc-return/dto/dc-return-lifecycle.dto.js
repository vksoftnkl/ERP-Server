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
exports.DcReturnTransportDto = exports.CancelDcReturnDto = exports.DcReturnOpenLinesQueryDto = exports.ValidateDcReturnDto = exports.PostDcReturnDto = exports.DcReturnKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_dc_return_dto_1 = require("./save-dc-return.dto");
class DcReturnKeysDto {
    sdrId;
    sdrCompanyId;
    sdrBranchId;
    sdrAccYear;
}
exports.DcReturnKeysDto = DcReturnKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DcReturnKeysDto.prototype, "sdrId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DcReturnKeysDto.prototype, "sdrCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DcReturnKeysDto.prototype, "sdrBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DcReturnKeysDto.prototype, "sdrAccYear", void 0);
class PostDcReturnDto extends DcReturnKeysDto {
    printAfter;
    overrides;
}
exports.PostDcReturnDto = PostDcReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The screen prints after the post (Ctrl+Enter). The server ignores it.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PostDcReturnDto.prototype, "printAfter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PostDcReturnDto.prototype, "overrides", void 0);
class ValidateDcReturnDto extends save_dc_return_dto_1.SaveDcReturnDto {
}
exports.ValidateDcReturnDto = ValidateDcReturnDto;
class DcReturnOpenLinesQueryDto {
    companyId;
    branchId;
    sdcId;
    sdcAccYear;
}
exports.DcReturnOpenLinesQueryDto = DcReturnOpenLinesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DcReturnOpenLinesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DcReturnOpenLinesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DcReturnOpenLinesQueryDto.prototype, "sdcId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DcReturnOpenLinesQueryDto.prototype, "sdcAccYear", void 0);
class CancelDcReturnDto extends DcReturnKeysDto {
    reason;
}
exports.CancelDcReturnDto = CancelDcReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelDcReturnDto.prototype, "reason", void 0);
class DcReturnTransportDto extends DcReturnKeysDto {
    transport;
}
exports.DcReturnTransportDto = DcReturnTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: bill_lifecycle_dto_1.TransportBandDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => bill_lifecycle_dto_1.TransportBandDto),
    __metadata("design:type", bill_lifecycle_dto_1.TransportBandDto)
], DcReturnTransportDto.prototype, "transport", void 0);
//# sourceMappingURL=dc-return-lifecycle.dto.js.map