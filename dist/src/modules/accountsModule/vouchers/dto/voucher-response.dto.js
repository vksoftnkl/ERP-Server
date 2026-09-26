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
exports.DeleteSuccessDto = exports.CancelSuccessDto = exports.VoucherSuccessDto = exports.ValidateSuccessDto = exports.DraftSavedSuccessDto = exports.TaxRatesSuccessDto = exports.OpenBillsSuccessDto = exports.PartyFactsSuccessDto = exports.LedgerBalanceSuccessDto = exports.LedgerPickSuccessDto = exports.VoucherTypesSuccessDto = exports.VoucherErrorResponseDto = exports.VoucherErrorDetailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class VoucherErrorDetailDto {
    field;
    message;
    code;
    line;
}
exports.VoucherErrorDetailDto = VoucherErrorDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], VoucherErrorDetailDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], VoucherErrorDetailDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'VCH_UNBALANCED' }),
    __metadata("design:type", String)
], VoucherErrorDetailDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    __metadata("design:type", Number)
], VoucherErrorDetailDto.prototype, "line", void 0);
class VoucherErrorResponseDto {
    success;
    message;
    errors;
}
exports.VoucherErrorResponseDto = VoucherErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], VoucherErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], VoucherErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [VoucherErrorDetailDto] }),
    __metadata("design:type", Array)
], VoucherErrorResponseDto.prototype, "errors", void 0);
class SuccessEnvelopeDto {
    success;
    message;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SuccessEnvelopeDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SuccessEnvelopeDto.prototype, "message", void 0);
class VoucherTypesSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.VoucherTypesSuccessDto = VoucherTypesSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], VoucherTypesSuccessDto.prototype, "data", void 0);
class LedgerPickSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.LedgerPickSuccessDto = LedgerPickSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], LedgerPickSuccessDto.prototype, "data", void 0);
class LedgerBalanceSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.LedgerBalanceSuccessDto = LedgerBalanceSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], LedgerBalanceSuccessDto.prototype, "data", void 0);
class PartyFactsSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.PartyFactsSuccessDto = PartyFactsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], PartyFactsSuccessDto.prototype, "data", void 0);
class OpenBillsSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.OpenBillsSuccessDto = OpenBillsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], OpenBillsSuccessDto.prototype, "data", void 0);
class TaxRatesSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.TaxRatesSuccessDto = TaxRatesSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], TaxRatesSuccessDto.prototype, "data", void 0);
class DraftSavedSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.DraftSavedSuccessDto = DraftSavedSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], DraftSavedSuccessDto.prototype, "data", void 0);
class ValidateSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.ValidateSuccessDto = ValidateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], ValidateSuccessDto.prototype, "data", void 0);
class VoucherSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.VoucherSuccessDto = VoucherSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], VoucherSuccessDto.prototype, "data", void 0);
class CancelSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.CancelSuccessDto = CancelSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], CancelSuccessDto.prototype, "data", void 0);
class DeleteSuccessDto extends SuccessEnvelopeDto {
    data;
}
exports.DeleteSuccessDto = DeleteSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object }),
    __metadata("design:type", Object)
], DeleteSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=voucher-response.dto.js.map