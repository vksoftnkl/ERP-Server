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
exports.LoyaltyMemberHistoryDto = exports.LoyaltyMemberAdjustDto = exports.LoyaltyMemberStatusDto = exports.SETTABLE_STATUSES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../../common/dto/dtoDecorators");
exports.SETTABLE_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'];
class LoyaltyMemberStatusDto {
    companyId;
    memberId;
    status;
    reason;
    force;
    approvedBy;
    branchId;
}
exports.LoyaltyMemberStatusDto = LoyaltyMemberStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberStatusDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberStatusDto.prototype, "memberId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.SETTABLE_STATUSES }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(exports.SETTABLE_STATUSES),
    __metadata("design:type", String)
], LoyaltyMemberStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 250,
        description: 'Required for SUSPENDED and CLOSED (lmb_block_reason and the status trail).',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(250),
    __metadata("design:type", String)
], LoyaltyMemberStatusDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'D6: CLOSED is refused while the balance ≠ 0 unless force is sent. With force the wallet is ' +
            'zeroed first — one ADJUST row per open lot — which needs approvedBy and the delete right ' +
            'on menu 79.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyMemberStatusDto.prototype, "force", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'public.user_master.usr_id — required with force.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberStatusDto.prototype, "approvedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The branch the action is taken at; absent = the member’s home branch, else the session’s.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberStatusDto.prototype, "branchId", void 0);
class LoyaltyMemberAdjustDto {
    companyId;
    branchId;
    memberId;
    points;
    reason;
    approvedBy;
    txnDate;
    expiresOn;
    lscId;
}
exports.LoyaltyMemberAdjustDto = LoyaltyMemberAdjustDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The branch the adjustment is booked at (lld_branch_id).',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "memberId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 50,
        description: 'SIGNED, ≠ 0. Positive opens a lot (never lapses unless expiresOn is sent). Negative draws ' +
            'FIFO like a redeem and is refused beyond the redeemable balance (422 SALES_LOYALTY_CAP).',
    }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], LoyaltyMemberAdjustDto.prototype, "points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    (0, dtoDecorators_1.TrimmedString)(250),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'public.user_master.usr_id — ck_lld_adjust_approval refuses an ADJUST without one.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "approvedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-05',
        description: 'YYYY-MM-DD; absent = today (company-local).',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "txnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2027-10-05',
        description: 'For a positive adjustment: when its lot lapses. Absent = never.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "expiresOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The scheme the movement files under; absent = the member’s, else that of the latest lot.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberAdjustDto.prototype, "lscId", void 0);
class LoyaltyMemberHistoryDto {
    companyId;
    memberId;
}
exports.LoyaltyMemberHistoryDto = LoyaltyMemberHistoryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberHistoryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyMemberHistoryDto.prototype, "memberId", void 0);
//# sourceMappingURL=loyalty-member-action.dto.js.map