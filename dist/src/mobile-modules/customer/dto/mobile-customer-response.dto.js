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
exports.MobileCustomerFormOptionsSuccessDto = exports.MobileCustomerFormOptionsDto = exports.MobileCustomerDetailSuccessDto = exports.MobileCustomerDetailDto = exports.MobileCustomerListSuccessDto = exports.MobileCustomerListPayloadDto = exports.MobileCustomerCountsDto = exports.MobileCustomerListItemDto = exports.MobileSidedAmountDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const customer_response_dto_1 = require("../../../modules/sales/customer/dto/customer-response.dto");
const party_gst_type_1 = require("../../../common/party/party-gst-type");
const BALANCE_STATUSES = ['OUTSTANDING', 'OVER_LIMIT', 'ADVANCE', 'SETTLED'];
class MobileSidedAmountDto {
    amount;
    side;
}
exports.MobileSidedAmountDto = MobileSidedAmountDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '124500.00', description: 'Magnitude, two decimals, as text' }),
    __metadata("design:type", String)
], MobileSidedAmountDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DR', 'CR'], description: 'DR = the party owes us' }),
    __metadata("design:type", String)
], MobileSidedAmountDto.prototype, "side", void 0);
class MobileCustomerListItemDto {
    cusId;
    cusName;
    cusShort;
    cusCode;
    cusCity;
    cusAreaName;
    cusPhone1;
    cusWhatsappNo;
    cusGstNo;
    cusGstType;
    cusIsActive;
    cusCreditAmtLimit;
    balance;
    balanceStatus;
    outstanding;
    outstandingBills;
    oldestBillDate;
}
exports.MobileCustomerListItemDto = MobileCustomerListItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileCustomerListItemDto.prototype, "cusId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusShort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusCity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusAreaName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusPhone1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusWhatsappNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusGstNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, enum: party_gst_type_1.PARTY_GST_TYPES }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "cusGstType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileCustomerListItemDto.prototype, "cusIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0.00', description: 'Credit amount limit, two decimals; 0.00 = none' }),
    __metadata("design:type", String)
], MobileCustomerListItemDto.prototype, "cusCreditAmtLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: MobileSidedAmountDto,
        nullable: true,
        description: 'Closing today in the login company (this year opening set + posted legs, all branches). ' +
            'null when the login has no company or no financial year holds today.',
    }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "balance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: BALANCE_STATUSES, nullable: true }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "balanceStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: '12350.00',
        description: "What the customer's unpaid bills still owe today, two decimals, never negative: the Party " +
            'Outstanding report\'s "owed" (Receivable side, login company, all branches). Unlike the ' +
            'balance, credits the customer holds do not lower it. null when the balance is null.',
    }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "outstanding", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number, example: 3, description: 'Unpaid DR bills' }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "outstandingBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'date',
        description: 'Bill date of the oldest unpaid bill; null when none',
    }),
    __metadata("design:type", Object)
], MobileCustomerListItemDto.prototype, "oldestBillDate", void 0);
class MobileCustomerCountsDto {
    all;
    outstanding;
    unregistered;
    inactive;
}
exports.MobileCustomerCountsDto = MobileCustomerCountsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileCustomerCountsDto.prototype, "all", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileCustomerCountsDto.prototype, "outstanding", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileCustomerCountsDto.prototype, "unregistered", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileCustomerCountsDto.prototype, "inactive", void 0);
class MobileCustomerListPayloadDto {
    items;
    counts;
    total;
    page;
    pageSize;
    hasMore;
    balanceAsOn;
    accYear;
    companyId;
}
exports.MobileCustomerListPayloadDto = MobileCustomerListPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileCustomerListItemDto] }),
    __metadata("design:type", Array)
], MobileCustomerListPayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: MobileCustomerCountsDto,
        description: 'Chip counts: search applied, filter not',
    }),
    __metadata("design:type", MobileCustomerCountsDto)
], MobileCustomerListPayloadDto.prototype, "counts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Rows matching search and filter' }),
    __metadata("design:type", Number)
], MobileCustomerListPayloadDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileCustomerListPayloadDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobileCustomerListPayloadDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], MobileCustomerListPayloadDto.prototype, "hasMore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, format: 'date' }),
    __metadata("design:type", Object)
], MobileCustomerListPayloadDto.prototype, "balanceAsOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: '2026-2027' }),
    __metadata("design:type", Object)
], MobileCustomerListPayloadDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'uuid',
        description: 'The company the balances and outstanding are read in (the login company)',
    }),
    __metadata("design:type", Object)
], MobileCustomerListPayloadDto.prototype, "companyId", void 0);
class MobileCustomerListSuccessDto {
    success;
    message;
    data;
}
exports.MobileCustomerListSuccessDto = MobileCustomerListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileCustomerListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileCustomerListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileCustomerListPayloadDto }),
    __metadata("design:type", MobileCustomerListPayloadDto)
], MobileCustomerListSuccessDto.prototype, "data", void 0);
class MobileCustomerDetailDto extends customer_response_dto_1.CustomerPayloadDto {
    balance;
    balanceStatus;
    outstanding;
    outstandingBills;
    oldestBillDate;
}
exports.MobileCustomerDetailDto = MobileCustomerDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileSidedAmountDto, nullable: true }),
    __metadata("design:type", Object)
], MobileCustomerDetailDto.prototype, "balance", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: BALANCE_STATUSES, nullable: true }),
    __metadata("design:type", Object)
], MobileCustomerDetailDto.prototype, "balanceStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: '12350.00',
        description: "What the customer's unpaid bills still owe today, two decimals, never negative: the Party " +
            'Outstanding report\'s "owed" (Receivable side, login company, all branches). Unlike the ' +
            'balance, credits the customer holds do not lower it. null when the balance is null.',
    }),
    __metadata("design:type", Object)
], MobileCustomerDetailDto.prototype, "outstanding", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: Number, example: 3, description: 'Unpaid DR bills' }),
    __metadata("design:type", Object)
], MobileCustomerDetailDto.prototype, "outstandingBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        format: 'date',
        description: 'Bill date of the oldest unpaid bill; null when none',
    }),
    __metadata("design:type", Object)
], MobileCustomerDetailDto.prototype, "oldestBillDate", void 0);
class MobileCustomerDetailSuccessDto {
    success;
    message;
    data;
}
exports.MobileCustomerDetailSuccessDto = MobileCustomerDetailSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileCustomerDetailSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileCustomerDetailSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileCustomerDetailDto }),
    __metadata("design:type", MobileCustomerDetailDto)
], MobileCustomerDetailSuccessDto.prototype, "data", void 0);
class MobileOptionDto {
    id;
    name;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileOptionDto.prototype, "name", void 0);
class MobileAreaOptionDto extends MobileOptionDto {
    cityId;
    cityName;
}
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "area_master.arm_city_id (since 2026-11-19): the phone's offer engine matches CITY " +
            "scheme rows through the customer's beat",
    }),
    __metadata("design:type", String)
], MobileAreaOptionDto.prototype, "cityId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: String }),
    __metadata("design:type", Object)
], MobileAreaOptionDto.prototype, "cityName", void 0);
class MobilePriceLevelOptionDto {
    id;
    name;
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], MobilePriceLevelOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobilePriceLevelOptionDto.prototype, "name", void 0);
class MobileStateOptionDto {
    code;
    name;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: '33' }),
    __metadata("design:type", String)
], MobileStateOptionDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tamil Nadu' }),
    __metadata("design:type", String)
], MobileStateOptionDto.prototype, "name", void 0);
class MobileCustomerFormOptionsDto {
    areas;
    groups;
    priceLevels;
    states;
    gstTypes;
}
exports.MobileCustomerFormOptionsDto = MobileCustomerFormOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileAreaOptionDto], description: 'cusAreaId picker' }),
    __metadata("design:type", Array)
], MobileCustomerFormOptionsDto.prototype, "areas", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileOptionDto], description: 'cusGroupId picker (Category)' }),
    __metadata("design:type", Array)
], MobileCustomerFormOptionsDto.prototype, "groups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobilePriceLevelOptionDto], description: 'cusPriceLevelId picker' }),
    __metadata("design:type", Array)
], MobileCustomerFormOptionsDto.prototype, "priceLevels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileStateOptionDto], description: 'cusStateCode / cusStateName picker' }),
    __metadata("design:type", Array)
], MobileCustomerFormOptionsDto.prototype, "states", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], enum: party_gst_type_1.PARTY_GST_TYPES, description: 'cusGstType choices' }),
    __metadata("design:type", Array)
], MobileCustomerFormOptionsDto.prototype, "gstTypes", void 0);
class MobileCustomerFormOptionsSuccessDto {
    success;
    message;
    data;
}
exports.MobileCustomerFormOptionsSuccessDto = MobileCustomerFormOptionsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileCustomerFormOptionsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileCustomerFormOptionsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileCustomerFormOptionsDto }),
    __metadata("design:type", MobileCustomerFormOptionsDto)
], MobileCustomerFormOptionsSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-customer-response.dto.js.map