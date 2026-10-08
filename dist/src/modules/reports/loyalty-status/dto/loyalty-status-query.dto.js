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
exports.LoyaltyStatusExportDto = exports.EXPORT_FORMATS = exports.EXPORT_TABS = exports.LoyaltyStatusGiftsDto = exports.LoyaltyStatusMonthlyDto = exports.LoyaltyStatusSchemesDto = exports.LoyaltyStatusPeriodDto = exports.SCHEME_SPLITS = exports.LoyaltyStatusCalendarDto = exports.LoyaltyStatusExpiringDto = exports.LoyaltyStatusMemberDto = exports.LoyaltyStatusStatementDto = exports.LoyaltyStatusMembersDto = exports.LoyaltyStatusListDto = exports.LoyaltyStatusScopeDto = exports.SORT_ORDERS = exports.MEMBER_STATUSES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
exports.MEMBER_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED', 'MERGED'];
exports.SORT_ORDERS = ['asc', 'desc'];
class LoyaltyStatusScopeDto {
    companyId;
    branchId;
}
exports.LoyaltyStatusScopeDto = LoyaltyStatusScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusScopeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Absent = all branches. Members / Expiring: the member’s home branch (lmb_branch_id). ' +
            'Scheme summary: where the movement happened (lld_branch_id). Plan D3.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusScopeDto.prototype, "branchId", void 0);
class LoyaltyStatusListDto extends LoyaltyStatusScopeDto {
    page;
    limit;
    sort;
    order;
    search;
}
exports.LoyaltyStatusListDto = LoyaltyStatusListDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], LoyaltyStatusListDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, minimum: 1, maximum: 200 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 200),
    __metadata("design:type", Number)
], LoyaltyStatusListDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'A column key of the route’s item; the route lists which.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(40),
    __metadata("design:type", String)
], LoyaltyStatusListDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SORT_ORDERS, default: 'asc' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(4),
    (0, class_validator_1.IsIn)(exports.SORT_ORDERS),
    __metadata("design:type", String)
], LoyaltyStatusListDto.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ILIKE over card no, mobile and customer name.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], LoyaltyStatusListDto.prototype, "search", void 0);
class LoyaltyStatusMembersDto extends LoyaltyStatusListDto {
    lscId;
    status;
    balanceGtZero;
    eligibleOnly;
    pointsMin;
    pointsMax;
    includeMergedClosed;
    earnedFrom;
    earnedTo;
}
exports.LoyaltyStatusMembersDto = LoyaltyStatusMembersDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Scheme Name — the member’s lmb_lsc_id.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusMembersDto.prototype, "lscId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.MEMBER_STATUSES,
        description: 'Absent = ACTIVE (and SUSPENDED when includeMergedClosed is false — see README).',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(exports.MEMBER_STATUSES),
    __metadata("design:type", String)
], LoyaltyStatusMembersDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true, description: 'Only wallets with a balance > 0.' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusMembersDto.prototype, "balanceGtZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: '3.0 “Show eligible customers”: a best gift exists and the member is ACTIVE.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusMembersDto.prototype, "eligibleOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'From Points — on the balance.' }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], LoyaltyStatusMembersDto.prototype, "pointsMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'To Points — on the balance.' }),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], LoyaltyStatusMembersDto.prototype, "pointsMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Also list MERGED and CLOSED wallets (their balance should be 0).',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusMembersDto.prototype, "includeMergedClosed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-04-01',
        description: '3.0 “Date From”: Earned becomes the points earned in [earnedFrom, earnedTo]. Absent = ' +
            'lifetime lmb_earned_points.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusMembersDto.prototype, "earnedFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-05' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusMembersDto.prototype, "earnedTo", void 0);
class LoyaltyStatusStatementDto {
    companyId;
    memberId;
    from;
    to;
    showReversals;
}
exports.LoyaltyStatusStatementDto = LoyaltyStatusStatementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusStatementDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusStatementDto.prototype, "memberId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-01', description: 'Absent = from the first row.' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusStatementDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-05', description: 'Absent = today.' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusStatementDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'false hides BOTH halves of a reversed pair — the row and its lld_reversal_of_id partner — ' +
            'so the running balance stays true.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusStatementDto.prototype, "showReversals", void 0);
class LoyaltyStatusMemberDto {
    companyId;
    memberId;
}
exports.LoyaltyStatusMemberDto = LoyaltyStatusMemberDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusMemberDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusMemberDto.prototype, "memberId", void 0);
class LoyaltyStatusExpiringDto extends LoyaltyStatusListDto {
    lscId;
    withinDays;
    hasMobile;
    activeOnly;
}
exports.LoyaltyStatusExpiringDto = LoyaltyStatusExpiringDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The scheme the lapsing lot belongs to (lld_lsc_id).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusExpiringDto.prototype, "lscId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 30, minimum: 1, maximum: 365 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 365),
    __metadata("design:type", Number)
], LoyaltyStatusExpiringDto.prototype, "withinDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Only members with a mobile (lmb_mobile, else cus_phone1).',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExpiringDto.prototype, "hasMobile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true, description: 'Only ACTIVE members.' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExpiringDto.prototype, "activeOnly", void 0);
class LoyaltyStatusCalendarDto extends LoyaltyStatusScopeDto {
    lscId;
    days;
}
exports.LoyaltyStatusCalendarDto = LoyaltyStatusCalendarDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusCalendarDto.prototype, "lscId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 90, minimum: 7, maximum: 730 }),
    (0, dtoDecorators_1.OptionalQueryInt)(7, 730),
    __metadata("design:type", Number)
], LoyaltyStatusCalendarDto.prototype, "days", void 0);
exports.SCHEME_SPLITS = ['scheme', 'scheme_branch', 'scheme_month'];
class LoyaltyStatusPeriodDto extends LoyaltyStatusScopeDto {
    from;
    to;
}
exports.LoyaltyStatusPeriodDto = LoyaltyStatusPeriodDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01', description: 'YYYY-MM-DD.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], LoyaltyStatusPeriodDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-05', description: 'YYYY-MM-DD, ≥ from.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], LoyaltyStatusPeriodDto.prototype, "to", void 0);
class LoyaltyStatusSchemesDto extends LoyaltyStatusPeriodDto {
    lscId;
    includeClosedHolding;
    splitBy;
    sort;
    order;
}
exports.LoyaltyStatusSchemesDto = LoyaltyStatusSchemesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusSchemesDto.prototype, "lscId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Keep a CLOSED / ended scheme only while its outstanding is > 0; false drops it.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusSchemesDto.prototype, "includeClosedHolding", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SCHEME_SPLITS, default: 'scheme' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(exports.SCHEME_SPLITS),
    __metadata("design:type", String)
], LoyaltyStatusSchemesDto.prototype, "splitBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'lscId, schemeName, earned, redeemed, outstanding, holders, usedPct …',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(40),
    __metadata("design:type", String)
], LoyaltyStatusSchemesDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SORT_ORDERS, default: 'asc' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(4),
    (0, class_validator_1.IsIn)(exports.SORT_ORDERS),
    __metadata("design:type", String)
], LoyaltyStatusSchemesDto.prototype, "order", void 0);
class LoyaltyStatusMonthlyDto extends LoyaltyStatusPeriodDto {
    lscId;
}
exports.LoyaltyStatusMonthlyDto = LoyaltyStatusMonthlyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusMonthlyDto.prototype, "lscId", void 0);
class LoyaltyStatusGiftsDto extends LoyaltyStatusPeriodDto {
    lscId;
}
exports.LoyaltyStatusGiftsDto = LoyaltyStatusGiftsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusGiftsDto.prototype, "lscId", void 0);
exports.EXPORT_TABS = ['members', 'expiring', 'schemes', 'statement'];
exports.EXPORT_FORMATS = ['pdf', 'xlsx'];
class LoyaltyStatusExportDto extends LoyaltyStatusScopeDto {
    tab;
    format;
    sort;
    order;
    search;
    lscId;
    status;
    balanceGtZero;
    eligibleOnly;
    pointsMin;
    pointsMax;
    includeMergedClosed;
    earnedFrom;
    earnedTo;
    withinDays;
    hasMobile;
    activeOnly;
    from;
    to;
    includeClosedHolding;
    splitBy;
    memberId;
    showReversals;
}
exports.LoyaltyStatusExportDto = LoyaltyStatusExportDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.EXPORT_TABS }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(exports.EXPORT_TABS),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "tab", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.EXPORT_FORMATS,
        default: 'pdf',
        description: 'Echoed back; the client renders.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(4),
    (0, class_validator_1.IsIn)(exports.EXPORT_FORMATS),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "format", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Sort key of the tab.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(40),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SORT_ORDERS }),
    (0, dtoDecorators_1.OptionalTrimmedString)(4),
    (0, class_validator_1.IsIn)(exports.SORT_ORDERS),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalTrimmedString)(100),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "lscId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.MEMBER_STATUSES }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(exports.MEMBER_STATUSES),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "balanceGtZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "eligibleOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], LoyaltyStatusExportDto.prototype, "pointsMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryInt)(0),
    __metadata("design:type", Number)
], LoyaltyStatusExportDto.prototype, "pointsMax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "includeMergedClosed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "earnedFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "earnedTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 365 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 365),
    __metadata("design:type", Number)
], LoyaltyStatusExportDto.prototype, "withinDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "hasMobile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "activeOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-01' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-05' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "includeClosedHolding", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SCHEME_SPLITS }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    (0, class_validator_1.IsIn)(exports.SCHEME_SPLITS),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "splitBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], LoyaltyStatusExportDto.prototype, "memberId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], LoyaltyStatusExportDto.prototype, "showReversals", void 0);
//# sourceMappingURL=loyalty-status-query.dto.js.map