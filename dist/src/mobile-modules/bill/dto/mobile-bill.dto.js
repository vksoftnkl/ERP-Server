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
exports.MobileBillOptionsQueryDto = exports.CreateMobileBillDto = exports.MobileBillLineDto = exports.MOBILE_BILL_TYPE = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const save_bill_dto_1 = require("../../../modules/sales/bill/dto/save-bill.dto");
const save_bill_item_dto_1 = require("../../../modules/sales/bill/dto/save-bill-item.dto");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
exports.MOBILE_BILL_TYPE = 'CREDIT';
const SERVER_FILLED_HEADER_KEYS = [
    'sbId',
    'sbBranchId',
    'sbTenantId',
    'sbAccYear',
    'sbSessionId',
    'sbCounterId',
    'sbDeviceType',
    'sbDeviceId',
    'sbBillSlno',
    'sbBillRefno',
    'sbBillMode',
    'sbStatus',
    'post',
    'sbPostedVoucherId',
    'sbDocRegisterId',
    'sbApprovedOn',
    'sbApprovedBy',
    'sbCancelReason',
    'sbVersionNo',
    'sbPrintCount',
    'sbRevisionNo',
    'sbCogsAmt',
    'sbDeliveryStatus',
    'sbLoyaltyEarned',
    'sbLoyaltyRedeemed',
    'sbReturnedAmt',
    'sbReturnStatus',
    'sbHasDc',
    'sbSrcDocType',
    'sbSrcDocId',
    'sbSrcDocRefno',
    'sbSrcDocDate',
    'sbSrcDocYear',
    'tenders',
    'charges',
    'adjustments',
    'sbCreatedBy',
    'sbModifiedBy',
    'sbUserId',
    'sbBillType',
    'items',
];
const SERVER_FILLED_LINE_KEYS = [
    'sbiId',
    'sbiBillId',
    'sbiCompanyId',
    'sbiBranchId',
    'sbiTenantId',
    'sbiAccYear',
    'sbiCogsAmt',
    'sbiSrcDocType',
    'sbiSrcDocId',
    'sbiSrcDocYear',
    'sbiSrcDocRefno',
    'sbiSrcDocLineNo',
    'sbiSrcItemQty',
    'sbiSrcFreeQty',
    'sbiSrcItemId',
    'sbiCreatedBy',
    'sbiModifiedBy',
];
class MobileBillLineDto extends (0, swagger_1.OmitType)(save_bill_item_dto_1.SaveBillItemDto, SERVER_FILLED_LINE_KEYS) {
}
exports.MobileBillLineDto = MobileBillLineDto;
class CreateMobileBillDto extends (0, swagger_1.OmitType)(save_bill_dto_1.SaveBillDto, SERVER_FILLED_HEADER_KEYS) {
    sbClientUuid;
    deviceUid;
    sbBillType;
    items;
}
exports.CreateMobileBillDto = CreateMobileBillDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The phone's own id for this bill. Send the same one again after a lost answer: the bill " +
            'already saved is answered (duplicate: true), never a second one.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileBillDto.prototype, "sbClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid (fixed.device_master.dev_device_uid). Its dev_id " +
            "becomes sb_device_id, and its branch the bill's branch when it belongs to sbCompanyId " +
            "(else the company's default branch).",
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMobileBillDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: [exports.MOBILE_BILL_TYPE],
        default: exports.MOBILE_BILL_TYPE,
        description: 'A phone bill is a CREDIT bill (no tenders): the whole amount stays on the customer. ' +
            'Omitted = CREDIT.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value),
    (0, class_validator_1.IsIn)([exports.MOBILE_BILL_TYPE]),
    __metadata("design:type", String)
], CreateMobileBillDto.prototype, "sbBillType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileBillLineDto], minItems: 1, description: 'At least one line' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileBillLineDto),
    __metadata("design:type", Array)
], CreateMobileBillDto.prototype, "items", void 0);
class MobileBillOptionsQueryDto {
    companyId;
    deviceUid;
}
exports.MobileBillOptionsQueryDto = MobileBillOptionsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company the bill is for' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileBillOptionsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid. The branch is resolved from it exactly as an " +
            'upload resolves it.',
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileBillOptionsQueryDto.prototype, "deviceUid", void 0);
//# sourceMappingURL=mobile-bill.dto.js.map