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
exports.MobileReturnStatusQueryDto = exports.MOBILE_RETURN_STATUS_MAX_PAGE_SIZE = exports.MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE = exports.MobileReturnBillLinesQueryDto = exports.MOBILE_RETURN_BILLS_MAX_PAGE_SIZE = exports.MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE = exports.MobileReturnOptionsQueryDto = exports.DeleteMobileReturnDto = exports.CreateMobileReturnDto = exports.MobileReturnAdjustmentDto = exports.MobileReturnLineDto = exports.MOBILE_RETURN_SETTLE_MODES = exports.MOBILE_RETURN_CONDITIONS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
exports.MOBILE_RETURN_CONDITIONS = ['RESTOCK', 'DAMAGED', 'EXPIRED', 'SCRAP'];
exports.MOBILE_RETURN_SETTLE_MODES = ['ADJUST', 'ADVANCE'];
class MobileReturnLineDto {
    sriLineNo;
    sriSplitNo;
    sriBillItemId;
    sriBillAccYear;
    sriItemId;
    sriItemUnitId;
    sriReturnQty;
    sriCondition;
    sriRemarks;
    sriBatchNo;
    sriExpiryDate;
}
exports.MobileReturnLineDto = MobileReturnLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, example: 1 }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], MobileReturnLineDto.prototype, "sriLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1, description: 'Omitted = 1' }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], MobileReturnLineDto.prototype, "sriSplitNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The bill line (billItemId of GET /mobile/returns/bill-lines); a bill return names one',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], MobileReturnLineDto.prototype, "sriBillItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-2027' }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], MobileReturnLineDto.prototype, "sriBillAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReturnLineDto.prototype, "sriItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The unit the qty is in (item_unit_conversion.iuc_id)',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReturnLineDto.prototype, "sriItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0, exclusiveMinimum: true, example: 2 }),
    (0, dtoDecorators_1.RequiredNumber)(0.001),
    __metadata("design:type", Number)
], MobileReturnLineDto.prototype, "sriReturnQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.MOBILE_RETURN_CONDITIONS }),
    (0, class_validator_1.IsIn)(exports.MOBILE_RETURN_CONDITIONS),
    __metadata("design:type", String)
], MobileReturnLineDto.prototype, "sriCondition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], MobileReturnLineDto.prototype, "sriRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'A no-bill line only: a bill line comes back into the lot it left',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], MobileReturnLineDto.prototype, "sriBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date', description: 'A no-bill line only' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], MobileReturnLineDto.prototype, "sriExpiryDate", void 0);
class MobileReturnAdjustmentDto {
    billId;
    billAccYear;
    amount;
}
exports.MobileReturnAdjustmentDto = MobileReturnAdjustmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The acc_bill_balance id, as GET /mobile/receipts/open-bills answers billId',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReturnAdjustmentDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileReturnAdjustmentDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0, example: 250 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], MobileReturnAdjustmentDto.prototype, "amount", void 0);
class CreateMobileReturnDto {
    srClientUuid;
    deviceUid;
    srCompanyId;
    srBranchId;
    srCustId;
    srIsAgainstBill;
    srBillId;
    srBillAccYear;
    srReasonId;
    srSettleMode;
    srReturnDate;
    srMobileRefno;
    srUsrRefno;
    srUsrRefdate;
    srRemarks;
    godownId;
    adjustments;
    phoneEstimate;
    lines;
}
exports.CreateMobileReturnDto = CreateMobileReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The phone's own id for this return (uuid v7; also used as srId). Send the same one " +
            'again after a lost answer, or after fixing a SENT_BACK return: never a second return.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The branch picked in Switch company (422 MOBILE_BRANCH_NOT_OF_COMPANY). Omitted: the phone's " +
            'Device List branch when it is the company’s, else the company default, else its only branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The customer (its ledger id)' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = against srBillId (D1); false = no bill' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateMobileReturnDto.prototype, "srIsAgainstBill", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Required when srIsAgainstBill',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.srIsAgainstBill === true || !!o.srBillId),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", Object)
], CreateMobileReturnDto.prototype, "srBillId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2026-2027',
        description: 'Required when srIsAgainstBill',
    }),
    (0, class_validator_1.ValidateIf)((o) => o.srIsAgainstBill === true || !!o.srBillAccYear),
    (0, dtoDecorators_1.TrimmedString)(9),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Object)
], CreateMobileReturnDto.prototype, "srBillAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'A SALE_RETURN reason of GET /mobile/returns/options',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srReasonId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.MOBILE_RETURN_SETTLE_MODES }),
    (0, class_validator_1.IsIn)(exports.MOBILE_RETURN_SETTLE_MODES),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srSettleMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date', description: "Omitted = today (the server's IST date)" }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srReturnDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 30,
        example: 'R3F9A/2627/00005',
        description: "The phone's own number",
    }),
    (0, dtoDecorators_1.TrimmedString)(30),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "srMobileRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: "The shop's own debit note no.",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], CreateMobileReturnDto.prototype, "srUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], CreateMobileReturnDto.prototype, "srUsrRefdate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], CreateMobileReturnDto.prototype, "srRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'D5: every line comes back into this godown (a live, active godown of the branch; 422 ' +
            "MOBILE_GODOWN_INVALID). Omitted: a bill line's own godown, a no-bill line the branch default.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateMobileReturnDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [MobileReturnAdjustmentDto],
        description: 'ADJUST only: the bills to set the credit off against, this bill first. Rows that went stale ' +
            'since Sync are re-planned, never refused (D6; replanned[] in the answer). Omitted: the ' +
            "server's split (this bill first, then the Receipt's order). [] = nothing adjusted.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileReturnAdjustmentDto),
    __metadata("design:type", Array)
], CreateMobileReturnDto.prototype, "adjustments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "The phone's own estimate (any JSON). Information only: never compared (D2).",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Allow)(),
    __metadata("design:type", Object)
], CreateMobileReturnDto.prototype, "phoneEstimate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileReturnLineDto], minItems: 1 }),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileReturnLineDto),
    __metadata("design:type", Array)
], CreateMobileReturnDto.prototype, "lines", void 0);
class DeleteMobileReturnDto {
    srClientUuid;
    deviceUid;
    srCompanyId;
}
exports.DeleteMobileReturnDto = DeleteMobileReturnDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeleteMobileReturnDto.prototype, "srClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeleteMobileReturnDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeleteMobileReturnDto.prototype, "srCompanyId", void 0);
class MobileReturnOptionsQueryDto {
    companyId;
    deviceUid;
    branchId;
}
exports.MobileReturnOptionsQueryDto = MobileReturnOptionsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReturnOptionsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileReturnOptionsQueryDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The Switch company branch (422 MOBILE_BRANCH_NOT_OF_COMPANY); omitted = the device rule',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], MobileReturnOptionsQueryDto.prototype, "branchId", void 0);
exports.MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE = 50;
exports.MOBILE_RETURN_BILLS_MAX_PAGE_SIZE = 200;
class MobileReturnBillLinesQueryDto extends MobileReturnOptionsQueryDto {
    since;
    page;
    pageSize;
}
exports.MobileReturnBillLinesQueryDto = MobileReturnBillLinesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'date',
        example: '2026-08-22',
        description: 'The first bill date to read (YYYY-MM-DD). Omitted: today less billDays.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], MobileReturnBillLinesQueryDto.prototype, "since", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], MobileReturnBillLinesQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.MOBILE_RETURN_BILLS_MAX_PAGE_SIZE,
        default: exports.MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE,
        description: 'Bills per page (each with all its lines)',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, exports.MOBILE_RETURN_BILLS_MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], MobileReturnBillLinesQueryDto.prototype, "pageSize", void 0);
exports.MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE = 200;
exports.MOBILE_RETURN_STATUS_MAX_PAGE_SIZE = 500;
class MobileReturnStatusQueryDto {
    companyId;
    deviceUid;
    since;
    page;
    pageSize;
}
exports.MobileReturnStatusQueryDto = MobileReturnStatusQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReturnStatusQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileReturnStatusQueryDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-11-20T10:15:00.000Z',
        description: 'Only returns changed at or after this instant (send the last asOf). Omitted: all.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], MobileReturnStatusQueryDto.prototype, "since", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], MobileReturnStatusQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.MOBILE_RETURN_STATUS_MAX_PAGE_SIZE,
        default: exports.MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE,
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, exports.MOBILE_RETURN_STATUS_MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], MobileReturnStatusQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=mobile-return.dto.js.map