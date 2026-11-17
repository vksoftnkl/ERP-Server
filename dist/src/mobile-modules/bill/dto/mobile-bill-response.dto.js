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
exports.MobileBillCreateSuccessDto = exports.MobileBillCreateResultDto = exports.MobileBillOptionsSuccessDto = exports.MobileBillOptionsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MobileBillGodownDto {
    godownId;
    name;
    shortName;
    isDefault;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Send it as sbiGodownId' }),
    __metadata("design:type", String)
], MobileBillGodownDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Coimbatore' }),
    __metadata("design:type", String)
], MobileBillGodownDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'CBE' }),
    __metadata("design:type", Object)
], MobileBillGodownDto.prototype, "shortName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The branch's default godown (branch_master.br_default_godown_id)" }),
    __metadata("design:type", Boolean)
], MobileBillGodownDto.prototype, "isDefault", void 0);
class MobileBillOptionsDto {
    companyId;
    branchId;
    godowns;
}
exports.MobileBillOptionsDto = MobileBillOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileBillOptionsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "The branch the phone's bills for this company land in: the phone's own branch when it " +
            "belongs to the company, else the company's default branch, else its only branch",
    }),
    __metadata("design:type", String)
], MobileBillOptionsDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [MobileBillGodownDto],
        description: "The branch's live, active godowns, the default first",
    }),
    __metadata("design:type", Array)
], MobileBillOptionsDto.prototype, "godowns", void 0);
class MobileBillOptionsSuccessDto {
    success;
    message;
    data;
}
exports.MobileBillOptionsSuccessDto = MobileBillOptionsSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileBillOptionsSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileBillOptionsSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileBillOptionsDto }),
    __metadata("design:type", MobileBillOptionsDto)
], MobileBillOptionsSuccessDto.prototype, "data", void 0);
class MobileBillCreateResultDto {
    sbId;
    sbCompanyId;
    sbBranchId;
    sbAccYear;
    sbBillRefno;
    sbUsrRefno;
    sbBillDate;
    sbBillAmt;
    sbStatus;
    duplicate;
    sbIsDeleted;
}
exports.MobileBillCreateResultDto = MobileBillCreateResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'bil01234',
        description: "VK Nex's number, from the branch's Sales Bill series. Store it on the phone.",
    }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbBillRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        nullable: true,
        type: String,
        example: 'A1B2/2627/00001',
        description: "The phone's own number, as sent",
    }),
    __metadata("design:type", Object)
], MobileBillCreateResultDto.prototype, "sbUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-17' }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbBillDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1180.00', description: 'The bill total, two decimals' }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbBillAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'POSTED',
        description: 'Now: POSTED when just saved; a resend reads the stored one (CANCELLED)',
    }),
    __metadata("design:type", String)
], MobileBillCreateResultDto.prototype, "sbStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true = saved before under this sbClientUuid; nothing written now' }),
    __metadata("design:type", Boolean)
], MobileBillCreateResultDto.prototype, "duplicate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'A resend of a bill the office has since deleted' }),
    __metadata("design:type", Boolean)
], MobileBillCreateResultDto.prototype, "sbIsDeleted", void 0);
class MobileBillCreateSuccessDto {
    success;
    message;
    data;
}
exports.MobileBillCreateSuccessDto = MobileBillCreateSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileBillCreateSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileBillCreateSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileBillCreateResultDto }),
    __metadata("design:type", MobileBillCreateResultDto)
], MobileBillCreateSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-bill-response.dto.js.map