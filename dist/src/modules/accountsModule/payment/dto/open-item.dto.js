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
exports.ListPaymentOpenItemsQueryDto = exports.PartyContextQueryDto = exports.DuplicateCheckQueryDto = exports.AdjacentVoucherQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
var open_item_dto_1 = require("../../receipt/dto/open-item.dto");
Object.defineProperty(exports, "AdjacentVoucherQueryDto", { enumerable: true, get: function () { return open_item_dto_1.AdjacentVoucherQueryDto; } });
Object.defineProperty(exports, "DuplicateCheckQueryDto", { enumerable: true, get: function () { return open_item_dto_1.DuplicateCheckQueryDto; } });
Object.defineProperty(exports, "PartyContextQueryDto", { enumerable: true, get: function () { return open_item_dto_1.PartyContextQueryDto; } });
class ListPaymentOpenItemsQueryDto {
    partyId;
    companyId;
    onDate;
}
exports.ListPaymentOpenItemsQueryDto = ListPaymentOpenItemsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party. A supplier id and an accounts.acc_ledger_master led_id are the same value — ' +
            'pass whichever one the screen is holding.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListPaymentOpenItemsQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ListPaymentOpenItemsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-09-14',
        description: "The PAYMENT's date, not today. It is what ppdSuggested is aged against (the supplier's " +
            'cash-discount window) and what daysOverdue is measured to. Defaults to today.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListPaymentOpenItemsQueryDto.prototype, "onDate", void 0);
//# sourceMappingURL=open-item.dto.js.map