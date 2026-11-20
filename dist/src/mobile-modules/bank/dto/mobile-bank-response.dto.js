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
exports.MobileBankListSuccessDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MobileBankDto {
    bankId;
    name;
    shortName;
}
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'fixed.bank_master.bnk_id' }),
    __metadata("design:type", String)
], MobileBankDto.prototype, "bankId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Karur Vysya Bank',
        description: "bnk_name, trimmed: what a cheque's tdBankName carries",
    }),
    __metadata("design:type", String)
], MobileBankDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, type: String, example: 'KVB', description: 'bnk_short_name' }),
    __metadata("design:type", Object)
], MobileBankDto.prototype, "shortName", void 0);
class MobileBankListDto {
    items;
    total;
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MobileBankDto], description: 'Active, live banks, by name' }),
    __metadata("design:type", Array)
], MobileBankListDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 146 }),
    __metadata("design:type", Number)
], MobileBankListDto.prototype, "total", void 0);
class MobileBankListSuccessDto {
    success;
    message;
    data;
}
exports.MobileBankListSuccessDto = MobileBankListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MobileBankListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MobileBankListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MobileBankListDto }),
    __metadata("design:type", MobileBankListDto)
], MobileBankListSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=mobile-bank-response.dto.js.map