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
exports.PrintDesignCloneDto = exports.VoucherTypeRefDto = exports.VoucherTypeGetQueryDto = exports.VoucherTypeTreeQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class VoucherTypeTreeQueryDto {
    companyId;
    includeInactive;
}
exports.VoucherTypeTreeQueryDto = VoucherTypeTreeQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherTypeTreeQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], VoucherTypeTreeQueryDto.prototype, "includeInactive", void 0);
class VoucherTypeGetQueryDto {
    companyId;
    branchId;
    accYear;
    vchrTypeId;
}
exports.VoucherTypeGetQueryDto = VoucherTypeGetQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherTypeGetQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The branch the preview and counters are for.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherTypeGetQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VoucherTypeGetQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], VoucherTypeGetQueryDto.prototype, "vchrTypeId", void 0);
class VoucherTypeRefDto {
    companyId;
    vchrTypeId;
}
exports.VoucherTypeRefDto = VoucherTypeRefDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherTypeRefDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], VoucherTypeRefDto.prototype, "vchrTypeId", void 0);
class PrintDesignCloneDto {
    companyId;
    fromPpoCode;
    ppoCode;
    ppoName;
}
exports.PrintDesignCloneDto = PrintDesignCloneDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PrintDesignCloneDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'SALE_INVOICE',
        description: 'The design to copy: a live one, shared or of this company.',
    }),
    (0, dtoDecorators_1.TrimmedString)(40),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PrintDesignCloneDto.prototype, "fromPpoCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'RETAIL_INVOICE',
        description: 'Upper-cased by the server; ^[A-Z][A-Z0-9_]*$, up to 40.',
    }),
    (0, dtoDecorators_1.TrimmedString)(40),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^[A-Za-z][A-Za-z0-9_]*$/),
    __metadata("design:type", String)
], PrintDesignCloneDto.prototype, "ppoCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120, example: 'Retail Invoice' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PrintDesignCloneDto.prototype, "ppoName", void 0);
//# sourceMappingURL=voucher-type-query.dto.js.map