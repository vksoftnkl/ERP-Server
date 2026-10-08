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
exports.GetPartyCreditSummaryDto = exports.ACC_YEAR_PATTERN = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
exports.ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
class GetPartyCreditSummaryDto {
    partyId;
    companyId;
    branchId;
    accYear;
}
exports.GetPartyCreditSummaryDto = GetPartyCreditSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'customers.cus_id — the same id acc_bill_balance.abl_party_id carries.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], GetPartyCreditSummaryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "Tenant scope for both the bills and the customer. OMIT AT YOUR OWN RISK: without it the party is resolved and aggregated across every company in the database, so a shared party id returns a position that is not any one tenant's. Entry screens always know their company and should always send it.",
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetPartyCreditSummaryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Branch that RAISED the bill. Omit for the company-wide credit position, which is the usual credit check — outstanding is company-wide (ux_abl_doc_refno carries no branch column for exactly that reason).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetPartyCreditSummaryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2025-2026',
        pattern: exports.ACC_YEAR_PATTERN.source,
        description: "The entry screen's accounting year, echoed back on the response. It does NOT scope the outstanding figures: a bill stays open in the partition of the year it was raised in and is never carried forward, so a credit check that filtered on the year would silently ignore real prior-year debt. Validated when supplied purely so a malformed year is caught at the edge rather than echoed back.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(exports.ACC_YEAR_PATTERN, { message: 'accYear must be in the YYYY-YYYY form, e.g. 2025-2026' }),
    __metadata("design:type", String)
], GetPartyCreditSummaryDto.prototype, "accYear", void 0);
//# sourceMappingURL=get-party-credit-summary.dto.js.map