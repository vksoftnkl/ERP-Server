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
exports.MobileReceiptStatusQueryDto = exports.MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE = exports.MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE = exports.MobileOpenBillsQueryDto = exports.MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = exports.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = exports.MobileReceiptOptionsQueryDto = exports.CreateMobileReceiptDto = exports.MobileReceiptCreditDto = exports.MobileReceiptAllocationDto = exports.MobileReceiptTenderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const post_receipt_dto_1 = require("../../../modules/accountsModule/receipt/dto/post-receipt.dto");
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
class MobileReceiptAllocationDto extends (0, swagger_1.PickType)(post_receipt_dto_1.PostReceiptAllocationDto, [
    'billId',
    'billAccYear',
    'amount',
    'discount',
    'roundoff',
]) {
}
exports.MobileReceiptAllocationDto = MobileReceiptAllocationDto;
class MobileReceiptCreditDto extends (0, swagger_1.PickType)(post_receipt_dto_1.PostReceiptCreditDto, [
    'billId',
    'billAccYear',
    'amount',
]) {
}
exports.MobileReceiptCreditDto = MobileReceiptCreditDto;
class CreateMobileReceiptDto extends (0, swagger_1.PickType)(save_receipt_dto_1.SaveDraftReceiptDto, [
    'avhCompanyId',
    'avhPartyId',
    'avhUsrRefno',
    'avhRemarks',
    'avhDocRefno',
    'avhDocDate',
]) {
    avhBranchId;
    allocations;
    creditsApplied;
    onAccount;
    avhClientUuid;
    deviceUid;
    avhVoucherDate;
    tenders;
}
exports.CreateMobileReceiptDto = CreateMobileReceiptDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The branch picked in the phone's Switch company. It must be an active, live branch of " +
            'avhCompanyId (422 MOBILE_BRANCH_NOT_OF_COMPANY); no other branch is tried instead. ' +
            "Omitted: the phone's Device List branch when it is the company's, else the company " +
            'default, else its only branch.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateMobileReceiptDto.prototype, "avhBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [MobileReceiptAllocationDto],
        description: "The phone's settlement, in the order the money fills the bills (open-items order). " +
            'Send it (or creditsApplied) to settle bills the phone chose; omit both and the server ' +
            'fills the open bills oldest first, as for older phones. [] = everything on account.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileReceiptAllocationDto),
    __metadata("design:type", Array)
], CreateMobileReceiptDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [MobileReceiptCreditDto],
        description: 'Credits the customer holds that this receipt spends (ADVANCE / SALES_RETURN / OPENING_CR ' +
            '/ JOURNAL_CR rows of GET /mobile/receipts/open-bills?withCredits=true). A credit lands ' +
            'on bills only, never on account.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MobileReceiptCreditDto),
    __metadata("design:type", Array)
], CreateMobileReceiptDto.prototype, "creditsApplied", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        example: 0,
        description: "The phone's own on-account figure. Informational only: never refused on a mismatch, " +
            "the server's figure (the answer's onAccount) wins.",
    }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], CreateMobileReceiptDto.prototype, "onAccount", void 0);
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
    branchId;
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
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "The branch picked in the phone's Switch company (the upload's avhBranchId): its tenders " +
            'are listed. Must be an active, live branch of companyId (422 MOBILE_BRANCH_NOT_OF_COMPANY). ' +
            'Omitted: resolved from the device as an upload without avhBranchId resolves it.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], MobileReceiptOptionsQueryDto.prototype, "branchId", void 0);
exports.MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = 200;
exports.MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = 500;
class MobileOpenBillsQueryDto {
    companyId;
    page;
    pageSize;
    withCredits;
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
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'true = the credits each customer holds come in the same list (kind ADVANCE, ' +
            'SALES_RETURN, OPENING_CR or JOURNAL_CR, pendingAmount = what is held), after that ' +
            "customer's bills; total and the pages then count them too. Omitted / false = bills only, " +
            'exactly as older phones read the list.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], MobileOpenBillsQueryDto.prototype, "withCredits", void 0);
exports.MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE = 200;
exports.MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE = 500;
class MobileReceiptStatusQueryDto {
    companyId;
    deviceUid;
    since;
    page;
    pageSize;
}
exports.MobileReceiptStatusQueryDto = MobileReceiptStatusQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The company whose receipts from this phone are read',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], MobileReceiptStatusQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH,
        description: "The phone's registered device uid: only the receipts uploaded from this phone " +
            '(avh_device_id = its dev_id, with a client uuid) are read.',
    }),
    (0, dtoDecorators_1.TrimmedString)(mobile_item_dto_1.MOBILE_DEVICE_UID_MAX_LENGTH),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MobileReceiptStatusQueryDto.prototype, "deviceUid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-11-19T10:15:00.000Z',
        description: 'Only receipts changed at or after this instant (ISO 8601; send the asOf of the last ' +
            'read). Omitted: all of them.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], MobileReceiptStatusQueryDto.prototype, "since", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], MobileReceiptStatusQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: exports.MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE,
        default: exports.MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE,
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, exports.MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], MobileReceiptStatusQueryDto.prototype, "pageSize", void 0);
//# sourceMappingURL=mobile-receipt.dto.js.map