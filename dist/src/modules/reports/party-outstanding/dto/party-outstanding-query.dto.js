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
exports.OutstandingExportDto = exports.OutstandingDueCalendarDto = exports.OutstandingSummaryDto = exports.OutstandingBillHistoryDto = exports.OutstandingBillWiseDto = exports.OutstandingPartiesDto = exports.OutstandingPartyDto = exports.OutstandingScopeDto = exports.OutstandingFilterDto = exports.OutstandingOptionsDto = exports.EXPORT_SHAPES = exports.SUMMARY_GROUP_BY = exports.BILL_SORTS = exports.PARTY_SORTS = exports.SORT_DIRS = exports.AGE_BY_VALUES = exports.OUTSTANDING_SIDES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const party_outstanding_ageing_1 = require("../party-outstanding.ageing");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
exports.OUTSTANDING_SIDES = ['RECEIVABLE', 'PAYABLE'];
exports.AGE_BY_VALUES = ['BILL_DATE', 'DUE_DATE'];
exports.SORT_DIRS = ['asc', 'desc'];
exports.PARTY_SORTS = [
    'net',
    'name',
    'overdue',
    'oldest',
    'owed',
    'bucket0',
    'bucket1',
    'bucket2',
    'bucket3',
    'bucket4',
    'bucket5',
    'bucket6',
    'bucket7',
];
exports.BILL_SORTS = ['date', 'party', 'due', 'refno', 'pending', 'age', 'overdue'];
exports.SUMMARY_GROUP_BY = ['AREA', 'GROUP', 'SALESMAN', 'BRANCH'];
exports.EXPORT_SHAPES = ['PARTIES', 'BILLS', 'PARTY_STATEMENT'];
const upper = ({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
class OutstandingOptionsDto {
    companyId;
    side;
}
exports.OutstandingOptionsDto = OutstandingOptionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OutstandingOptionsDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.OUTSTANDING_SIDES }),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(exports.OUTSTANDING_SIDES),
    __metadata("design:type", Object)
], OutstandingOptionsDto.prototype, "side", void 0);
class OutstandingFilterDto extends OutstandingOptionsDto {
    asOn;
    branchId;
    groupId;
    areaId;
    collectionDay;
    salesmanId;
    ageBy;
    buckets;
    onlyOverdue;
    includeOnAccount;
    deductPdc;
    hideZero;
    minDueDays;
    maxDueDays;
}
exports.OutstandingFilterDto = OutstandingFilterDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-09',
        description: 'YYYY-MM-DD. Decides the fiscal year (no accYear key — §4.1); outside every year of the ' +
            'company = 422 AS_ON_OUTSIDE_YEARS. A future date is allowed (isFuture: true).',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'asOn must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "asOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = all branches combined.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'accounts.acc_group_master — the party ledger’s group or any sub-group. Absent = the ' +
            'side’s default (Sundry Debtors / Sundry Creditors), which also takes in every customer ' +
            '(Receivable) / supplier (Payable) whose ledger sits elsewhere (O3).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "groupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'customers.cus_area_id — Receivable only.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "areaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: party_outstanding_ageing_1.COLLECTION_DAYS,
        description: 'The customer’s area collects on this weekday — Receivable only.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(party_outstanding_ageing_1.COLLECTION_DAYS),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "collectionDay", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'customers.cus_default_salesman (abl_salesman_id is never stamped) — Receivable only.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "salesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.AGE_BY_VALUES, default: 'BILL_DATE' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(exports.AGE_BY_VALUES),
    __metadata("design:type", Object)
], OutstandingFilterDto.prototype, "ageBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '30,60,90,180',
        default: '30,60,90,180',
        description: '1 to 6 rising whole numbers of days, max 3650 — otherwise 422 BAD_BUCKETS.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], OutstandingFilterDto.prototype, "buckets", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Parties with overdue > 0 only. On /bills, /bill-wise and the bills of an export: overdue ' +
            'owed bills only.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], OutstandingFilterDto.prototype, "onlyOverdue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'false drops on-account bills (advances, returns, notes) from every figure.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], OutstandingFilterDto.prototype, "includeOnAccount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Subtract the PDC in hand (not yet effective) from net.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], OutstandingFilterDto.prototype, "deductPdc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Drop parties whose owed and on-account are both 0 on asOn.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], OutstandingFilterDto.prototype, "hideZero", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: '3.0’s "Due days ≥" — on overdueDays of owed bills (party: any bill; bills: each).',
    }),
    (0, dtoDecorators_1.OptionalQueryInt)(0, 36500),
    __metadata("design:type", Number)
], OutstandingFilterDto.prototype, "minDueDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: '3.0’s "Due days ≤" — as minDueDays.' }),
    (0, dtoDecorators_1.OptionalQueryInt)(0, 36500),
    __metadata("design:type", Number)
], OutstandingFilterDto.prototype, "maxDueDays", void 0);
class OutstandingScopeDto extends OutstandingFilterDto {
    partyId;
}
exports.OutstandingScopeDto = OutstandingScopeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'acc_ledger_master.led_id = abl_party_id.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], OutstandingScopeDto.prototype, "partyId", void 0);
class OutstandingPartyDto extends OutstandingFilterDto {
    partyId;
}
exports.OutstandingPartyDto = OutstandingPartyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'acc_ledger_master.led_id = abl_party_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OutstandingPartyDto.prototype, "partyId", void 0);
class OutstandingPartiesDto extends OutstandingScopeDto {
    sort;
    dir;
    page;
    pageSize;
}
exports.OutstandingPartiesDto = OutstandingPartiesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.PARTY_SORTS, default: 'net' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(exports.PARTY_SORTS),
    __metadata("design:type", String)
], OutstandingPartiesDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SORT_DIRS, default: 'desc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(exports.SORT_DIRS),
    __metadata("design:type", String)
], OutstandingPartiesDto.prototype, "dir", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], OutstandingPartiesDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, minimum: 1, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], OutstandingPartiesDto.prototype, "pageSize", void 0);
class OutstandingBillWiseDto extends OutstandingScopeDto {
    sort;
    dir;
    page;
    pageSize;
    dueOn;
}
exports.OutstandingBillWiseDto = OutstandingBillWiseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.BILL_SORTS, default: 'date' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(exports.BILL_SORTS),
    __metadata("design:type", String)
], OutstandingBillWiseDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SORT_DIRS, default: 'asc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(exports.SORT_DIRS),
    __metadata("design:type", String)
], OutstandingBillWiseDto.prototype, "dir", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], OutstandingBillWiseDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 200, minimum: 1, maximum: 500 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 500),
    __metadata("design:type", Number)
], OutstandingBillWiseDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-15',
        description: 'Owed bills whose dueEff is this day only (the Due calendar’s day click).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'dueOn must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OutstandingBillWiseDto.prototype, "dueOn", void 0);
class OutstandingBillHistoryDto {
    companyId;
    billId;
    accYear;
    asOn;
}
exports.OutstandingBillHistoryDto = OutstandingBillHistoryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OutstandingBillHistoryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'acc_bill_balance.abl_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], OutstandingBillHistoryDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: 'acc_bill_balance.abl_acc_year' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], OutstandingBillHistoryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-09', description: 'Rows dated after it are effective: false.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'asOn must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OutstandingBillHistoryDto.prototype, "asOn", void 0);
class OutstandingSummaryDto extends OutstandingScopeDto {
    groupBy;
}
exports.OutstandingSummaryDto = OutstandingSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: exports.SUMMARY_GROUP_BY,
        description: 'AREA and SALESMAN are refused on Payable (NOT_FOR_PAYABLE).',
    }),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(exports.SUMMARY_GROUP_BY),
    __metadata("design:type", Object)
], OutstandingSummaryDto.prototype, "groupBy", void 0);
class OutstandingDueCalendarDto extends OutstandingScopeDto {
    from;
    to;
}
exports.OutstandingDueCalendarDto = OutstandingDueCalendarDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-09' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OutstandingDueCalendarDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-11-08' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], OutstandingDueCalendarDto.prototype, "to", void 0);
class OutstandingExportDto extends OutstandingScopeDto {
    shape;
    sort;
    dir;
}
exports.OutstandingExportDto = OutstandingExportDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: exports.EXPORT_SHAPES,
        description: 'PARTIES = the /parties rows unpaged; BILLS = the /bill-wise rows unpaged; ' +
            'PARTY_STATEMENT = one party’s open bills, ageing and net (needs partyId).',
    }),
    (0, class_transformer_1.Transform)(upper),
    (0, class_validator_1.IsIn)(exports.EXPORT_SHAPES),
    __metadata("design:type", Object)
], OutstandingExportDto.prototype, "shape", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: [...exports.PARTY_SORTS, ...exports.BILL_SORTS],
        description: 'PARTIES takes the /parties sorts, BILLS the /bill-wise ones (else 422 BAD_SORT).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)([...exports.PARTY_SORTS, ...exports.BILL_SORTS]),
    __metadata("design:type", String)
], OutstandingExportDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.SORT_DIRS }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(lower),
    (0, class_validator_1.IsIn)(exports.SORT_DIRS),
    __metadata("design:type", String)
], OutstandingExportDto.prototype, "dir", void 0);
//# sourceMappingURL=party-outstanding-query.dto.js.map