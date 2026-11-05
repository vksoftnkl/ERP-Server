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
exports.AmendReceiptDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_receipt_dto_1 = require("./save-receipt.dto");
const post_receipt_dto_1 = require("./post-receipt.dto");
class AmendReceiptDto extends save_receipt_dto_1.SaveReceiptDto {
    avhVoucherId = '';
    allocations;
    creditsApplied = [];
    otherLineBills = [];
    onAccount;
    baseRevision;
    editRemark;
}
exports.AmendReceiptDto = AmendReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        required: true,
        description: 'The POSTED receipt being restated. Its id, number and refno all survive.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendReceiptDto.prototype, "avhVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: () => post_receipt_dto_1.PostReceiptAllocationDto,
        isArray: true,
        description: 'IN ORDER, exactly as /post takes them — and, exactly as at /post, a PREVIEW. The server ' +
            're-reads every bill under a row lock AFTER the unwind has reopened them, re-runs the ' +
            'allocation engine and refuses a mismatch.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptAllocationDto),
    __metadata("design:type", Array)
], AmendReceiptDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => post_receipt_dto_1.PostReceiptCreditDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptCreditDto),
    __metadata("design:type", Array)
], AmendReceiptDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => post_receipt_dto_1.PostReceiptOtherLinePinDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => post_receipt_dto_1.PostReceiptOtherLinePinDto),
    __metadata("design:type", Array)
], AmendReceiptDto.prototype, "otherLineBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 14450,
        minimum: 0,
        description: 'What is left over and will be held as an ADVANCE bill. Recomputed server-side against ' +
            'the REOPENED bills and refused if it disagrees.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], AmendReceiptDto.prototype, "onAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        minimum: 0,
        description: 'The avhRevisionNo /receipts/get returned when this receipt was loaded. Refused with a ' +
            '409 if it is no longer current: somebody amended the receipt in between, and an amend ' +
            'carries the whole document, so proceeding would silently undo their correction.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(0),
    __metadata("design:type", Number)
], AmendReceiptDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 250,
        example: 'cheque no keyed 55491, actual 55419',
        description: 'Why the receipt is being restated. Goes on the txn_status_log step and on every ' +
            'audit.audit_log row the amend writes.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(250),
    __metadata("design:type", String)
], AmendReceiptDto.prototype, "editRemark", void 0);
//# sourceMappingURL=amend-receipt.dto.js.map