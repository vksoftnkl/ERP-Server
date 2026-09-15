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
exports.PartyContextQueryDto = exports.ListOpenItemsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class ListOpenItemsQueryDto {
    partyId;
    companyId;
    onDate;
}
exports.ListOpenItemsQueryDto = ListOpenItemsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party. A customer id, a supplier id and an accounts.acc_ledger_master led_id are the ' +
            'same value — pass whichever one the screen is holding.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-09-14',
        description: "The RECEIPT's date, not today. It is what ppdSuggested is aged against and what " +
            'daysOverdue is measured to, so a receipt being keyed for last Friday must send last ' +
            'Friday or it will be offered a discount the customer has lost. Defaults to today.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListOpenItemsQueryDto.prototype, "onDate", void 0);
class PartyContextQueryDto {
    partyId;
    companyId;
}
exports.PartyContextQueryDto = PartyContextQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party — the same id as the customer or supplier.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PartyContextQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PartyContextQueryDto.prototype, "companyId", void 0);
//# sourceMappingURL=open-item.dto.js.map