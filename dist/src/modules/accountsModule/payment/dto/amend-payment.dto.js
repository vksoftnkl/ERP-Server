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
exports.AmendPaymentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const post_receipt_dto_1 = require("../../receipt/dto/post-receipt.dto");
const save_payment_dto_1 = require("./save-payment.dto");
class AmendPaymentDto extends save_payment_dto_1.SavePaymentDto {
    avhVoucherId = '';
    allocations;
    creditsApplied = [];
    otherLineBills = [];
    onAccount;
    baseRevision;
    editRemark;
}
exports.AmendPaymentDto = AmendPaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        required: true,
        description: 'The POSTED payment being restated. Its id, number and refno all survive.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendPaymentDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => post_receipt_dto_1.PostReceiptAllocationDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptAllocationDto),
    __metadata("design:type", Array)
], AmendPaymentDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => post_receipt_dto_1.PostReceiptCreditDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptCreditDto),
    __metadata("design:type", Array)
], AmendPaymentDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => post_receipt_dto_1.PostReceiptOtherLinePinDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptOtherLinePinDto),
    __metadata("design:type", Array)
], AmendPaymentDto.prototype, "otherLineBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, minimum: 0 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], AmendPaymentDto.prototype, "onAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        minimum: 0,
        description: 'The avhRevisionNo /payments/get returned. Refused with a 409 if it is no longer current.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(0),
    __metadata("design:type", Number)
], AmendPaymentDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250, example: 'paid to the wrong bank account' }),
    (0, dtoDecorators_1.UpperMaxString)(250),
    __metadata("design:type", String)
], AmendPaymentDto.prototype, "editRemark", void 0);
//# sourceMappingURL=amend-payment.dto.js.map