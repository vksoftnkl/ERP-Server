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
exports.GetPartyAdjustableCreditsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const transaction_api_types_1 = require("../types/transaction-api.types");
class GetPartyAdjustableCreditsDto {
    partyId;
    companyId;
    type;
}
exports.GetPartyAdjustableCreditsDto = GetPartyAdjustableCreditsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The party whose credits to offer — the same id acc_bill_balance.abl_party_id carries.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GetPartyAdjustableCreditsDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'Tenant scope. Required, not optional: a credit belonging to another company must never be offered as settlement.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GetPartyAdjustableCreditsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: transaction_api_types_1.AdjustableCreditSide,
        default: transaction_api_types_1.DEFAULT_ADJUSTABLE_CREDIT_SIDE,
        description: 'CR = the company owes the party (customer advances, sales returns) — the default. ' +
            'DR = the party owes the company (supplier advances, purchase returns). Case-insensitive.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dtoDecorators_1.toUpperTrimmed)(value)),
    (0, class_validator_1.IsEnum)(transaction_api_types_1.AdjustableCreditSide),
    __metadata("design:type", String)
], GetPartyAdjustableCreditsDto.prototype, "type", void 0);
//# sourceMappingURL=get-party-adjustable-credits.dto.js.map