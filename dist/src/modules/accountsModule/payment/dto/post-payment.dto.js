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
exports.DeletePaymentDto = exports.GetPaymentQueryDto = exports.CancelPaymentDto = exports.PostPaymentDto = exports.PostPaymentOtherLinePinDto = exports.PostPaymentCreditDto = exports.PostPaymentAllocationDto = exports.PaymentKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const post_receipt_dto_1 = require("../../receipt/dto/post-receipt.dto");
Object.defineProperty(exports, "PostPaymentAllocationDto", { enumerable: true, get: function () { return post_receipt_dto_1.PostReceiptAllocationDto; } });
Object.defineProperty(exports, "PostPaymentCreditDto", { enumerable: true, get: function () { return post_receipt_dto_1.PostReceiptCreditDto; } });
Object.defineProperty(exports, "PostPaymentOtherLinePinDto", { enumerable: true, get: function () { return post_receipt_dto_1.PostReceiptOtherLinePinDto; } });
class PaymentKeysDto extends post_receipt_dto_1.ReceiptKeysDto {
}
exports.PaymentKeysDto = PaymentKeysDto;
class PostPaymentDto extends PaymentKeysDto {
    allocations;
    creditsApplied = [];
    otherLineBills = [];
    onAccount;
}
exports.PostPaymentDto = PostPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => post_receipt_dto_1.PostReceiptAllocationDto,
        isArray: true,
        description: 'IN ORDER — the order money fills the bills, which is the order /payments/open-items ' +
            'returned them in. On a TDS-applicable party the amounts are GROSS: the deduction settles ' +
            'its share of each bill without leaving as money.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptAllocationDto),
    __metadata("design:type", Array)
], PostPaymentDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => post_receipt_dto_1.PostReceiptCreditDto,
        isArray: true,
        description: 'The debits we hold being applied — an advance paid, a debit note.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptCreditDto),
    __metadata("design:type", Array)
], PostPaymentDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => post_receipt_dto_1.PostReceiptOtherLinePinDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptOtherLinePinDto),
    __metadata("design:type", Array)
], PostPaymentDto.prototype, "otherLineBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        minimum: 0,
        description: 'What is left over and will be held as an ADVANCE (DR) bill on the party. Recomputed ' +
            'server-side and refused if it disagrees.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], PostPaymentDto.prototype, "onAccount", void 0);
class CancelPaymentDto extends PaymentKeysDto {
    reason;
}
exports.CancelPaymentDto = CancelPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 250,
        description: 'Why. ck_avh_cancel refuses a CANCELLED voucher without one.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(250),
    __metadata("design:type", String)
], CancelPaymentDto.prototype, "reason", void 0);
class GetPaymentQueryDto extends PaymentKeysDto {
}
exports.GetPaymentQueryDto = GetPaymentQueryDto;
class DeletePaymentDto extends PaymentKeysDto {
}
exports.DeletePaymentDto = DeletePaymentDto;
//# sourceMappingURL=post-payment.dto.js.map