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
exports.MobileOpenBillsQueryDto = exports.MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = exports.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = exports.MobileReceiptOptionsQueryDto = exports.CreateMobileReceiptDto = exports.MobileReceiptTenderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const save_receipt_dto_1 = require("../../../modules/accountsModule/receipt/dto/save-receipt.dto");
const mobile_item_dto_1 = require("../../item/dto/mobile-item.dto");
class MobileReceiptTenderDto extends (0, swagger_1.PickType)(save_receipt_dto_1.SaveReceiptTenderDto, [
    'tdTenderId',
    'tdTenderTypeId',
    'tdAmount',
    'tdRefNo',
    'tdBankName',
    'tdInstrumentDate',
    'cheque',
]) {
}
exports.MobileReceiptTenderDto = MobileReceiptTenderDto;
class CreateMobileReceiptDto extends (0, swagger_1.PickType)(save_receipt_dto_1.SaveDraftReceiptDto, [
    'avhCompanyId',
    'avhPartyId',
    'avhUsrRefno',
    'avhRemarks',
]) {
    avhClientUuid;
    deviceUid;
    avhVoucherDate;
    tenders;
}
exports.CreateMobileReceiptDto = CreateMobileReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The phone's own id for this receipt. Send the same one again after a lost answer: the " +
            'receipt already saved is answered (duplicate: true), never a second one.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], CreateMobileReceiptDto.prototype, "avhClientUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid (fixed.device_master.dev_device_uid). Its dev_id is " +
            "the receipt's device, and its branch the receipt's branch when it belongs to " +
            "avhCompanyId (else the company's default branch).",
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMobileReceiptDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        example: '2026-11-17',
        description: "The receipt's date (YYYY-MM-DD). Omitted = today (the server's IST date).",
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], CreateMobileReceiptDto.prototype, "avhVoucherDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileReceiptTenderDto],
        minItems: 1,
        description: 'At least one instrument; each must carry more than zero',
    }),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileReceiptTenderDto),
    __metadata("design:type", Array)
], CreateMobileReceiptDto.prototype, "tenders", void 0);
class MobileReceiptOptionsQueryDto {
    companyId;
    deviceUid;
}
exports.MobileReceiptOptionsQueryDto = MobileReceiptOptionsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The company the money is collected for' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReceiptOptionsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid. The branch is resolved from it exactly as an " +
            'upload resolves it.',
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileReceiptOptionsQueryDto.prototype, "deviceUid", void 0);
exports.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = 200;
exports.MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = 500;
class MobileOpenBillsQueryDto {
    companyId;
    page;
    pageSize;
}
exports.MobileOpenBillsQueryDto = MobileOpenBillsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: "The company whose customers' open bills are read" }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileOpenBillsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], MobileOpenBillsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.MOBILE_OPEN_BILLS_MAX_PAGE_SIZE,
        default: exports.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE,
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, exports.MOBILE_OPEN_BILLS_MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], MobileOpenBillsQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=mobile-receipt.dto.js.map