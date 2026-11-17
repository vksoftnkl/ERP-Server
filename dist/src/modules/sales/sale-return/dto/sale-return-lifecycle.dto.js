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
exports.SaleReturnBillLinesQueryDto = exports.SaleReturnTransportDto = exports.AmendSaleReturnDto = exports.CancelSaleReturnDto = exports.PostSaleReturnDto = exports.ValidateSaleReturnDto = exports.SaleReturnAdjustmentDto = exports.SaleReturnKeysDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_tender_detail_dto_1 = require("../../../accountsModule/tenderDetail/dto/save-tender-detail.dto");
const bill_lifecycle_dto_1 = require("../../bill/dto/bill-lifecycle.dto");
const save_sale_return_dto_1 = require("./save-sale-return.dto");
class SaleReturnKeysDto {
    srId;
    srCompanyId;
    srBranchId;
    srAccYear;
}
exports.SaleReturnKeysDto = SaleReturnKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaleReturnKeysDto.prototype, "srAccYear", void 0);
class SaleReturnAdjustmentDto {
    ablId;
    ablAccYear;
    amount;
    dueNow;
}
exports.SaleReturnAdjustmentDto = SaleReturnAdjustmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The bill's acc_bill_balance row (settlement.adjust.bills[].ablId)",
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnAdjustmentDto.prototype, "ablId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaleReturnAdjustmentDto.prototype, "ablAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Adjust now (> 0; a 0 row is ignored)' }),
    (0, dtoDecorators_1.RequiredNumber)(),
    __metadata("design:type", Object)
], SaleReturnAdjustmentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'What the screen showed the bill owing. A different figure now → 409 SALES_RETURN_ADJUST_STALE (open popup 25 again).',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaleReturnAdjustmentDto.prototype, "dueNow", void 0);
const APPROVAL_IDS_DOC = {
    type: 'object',
    additionalProperties: { type: 'string', format: 'uuid' },
    example: { SALE_CLAIM: '019f0000-0000-7000-8000-000000000001' },
    description: 'event → tapId (SALE_RETURN · SALE_CLAIM · RETURN_NO_RECEIPT · REFUND_CASH). An APPROVED, unused request of this ' +
        'return for that event; left out, the latest one of them is used when there is one.',
};
class ValidateSaleReturnDto extends save_sale_return_dto_1.SaveSaleReturnDto {
    overrides;
    adjustments;
    approvalIds;
}
exports.ValidateSaleReturnDto = ValidateSaleReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ValidateSaleReturnDto.prototype, "overrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => SaleReturnAdjustmentDto,
        isArray: true,
        description: 'Adjust (srSettleMode ADJUST): the operator’s split. Omit for the server’s proposal.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleReturnAdjustmentDto),
    __metadata("design:type", Array)
], ValidateSaleReturnDto.prototype, "adjustments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(APPROVAL_IDS_DOC),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ValidateSaleReturnDto.prototype, "approvalIds", void 0);
class PostSaleReturnDto extends SaleReturnKeysDto {
    overrides;
    printAfter;
    adjustments;
    tenders;
    approvalIds;
}
exports.PostSaleReturnDto = PostSaleReturnDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PostSaleReturnDto.prototype, "overrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], PostSaleReturnDto.prototype, "printAfter", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => SaleReturnAdjustmentDto,
        isArray: true,
        description: 'Adjust (srSettleMode ADJUST): popup 25’s split, this bill first. Omit to take the server’s proposal ' +
            '(/validate preview.settlement.adjust.bills). 422 SALES_RETURN_ADJUST_OVER · 409 SALES_RETURN_ADJUST_STALE.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleReturnAdjustmentDto),
    __metadata("design:type", Array)
], PostSaleReturnDto.prototype, "adjustments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: save_tender_detail_dto_1.SaveTenderDetailDto,
        isArray: true,
        description: 'Refund (srSettleMode CASH): popup B’s rows, written over the draft’s before it posts — cash (1), UPI (3) or ' +
            'bank (6); UPI / bank need tdRefNo. Omit to post the rows saved on the draft.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.SaveTenderDetailDto),
    __metadata("design:type", Array)
], PostSaleReturnDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(APPROVAL_IDS_DOC),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PostSaleReturnDto.prototype, "approvalIds", void 0);
class CancelSaleReturnDto extends SaleReturnKeysDto {
    reason;
}
exports.CancelSaleReturnDto = CancelSaleReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelSaleReturnDto.prototype, "reason", void 0);
class AmendSaleReturnDto extends (0, swagger_1.OmitType)(ValidateSaleReturnDto, ['srId']) {
    srId;
    baseRevision;
    editRemark;
}
exports.AmendSaleReturnDto = AmendSaleReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], AmendSaleReturnDto.prototype, "srId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], AmendSaleReturnDto.prototype, "baseRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AmendSaleReturnDto.prototype, "editRemark", void 0);
class SaleReturnTransportDto extends SaleReturnKeysDto {
    transport;
}
exports.SaleReturnTransportDto = SaleReturnTransportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: bill_lifecycle_dto_1.TransportBandDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => bill_lifecycle_dto_1.TransportBandDto),
    __metadata("design:type", bill_lifecycle_dto_1.TransportBandDto)
], SaleReturnTransportDto.prototype, "transport", void 0);
class SaleReturnBillLinesQueryDto {
    sbId;
    sbAccYear;
    companyId;
    branchId;
    allBranches;
    srId;
}
exports.SaleReturnBillLinesQueryDto = SaleReturnBillLinesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The bill (sale_bill.sb_id)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnBillLinesQueryDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9, example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaleReturnBillLinesQueryDto.prototype, "sbAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The return’s company; the bill must be in it' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnBillLinesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The return’s branch; the bill must be in it unless allBranches',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaleReturnBillLinesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: "D14 — another branch's bill (the picker's All branches tick)",
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], SaleReturnBillLinesQueryDto.prototype, "allBranches", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The return on screen: left out of "on other drafts" and of what earlier returns took',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaleReturnBillLinesQueryDto.prototype, "srId", void 0);
//# sourceMappingURL=sale-return-lifecycle.dto.js.map