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
exports.NoTenderQueryDto = exports.TenderDayBookQueryDto = exports.TenderBooksScopeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const list = ({ value }) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const items = (Array.isArray(value) ? value : String(value).split(','))
        .map((v) => String(v).trim())
        .filter(Boolean);
    return items.length ? items : undefined;
};
class TenderBooksScopeDto {
    companyId;
    accYear;
    branchId;
    fromDate;
    toDate;
    sessionId;
}
exports.TenderBooksScopeDto = TenderBooksScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], TenderBooksScopeDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    (0, class_validator_1.Matches)(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], TenderBooksScopeDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = every branch.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TenderBooksScopeDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-16',
        description: 'YYYY-MM-DD. Day Book: required. No-tender list: absent = the start of the year.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true }, { message: 'fromDate is not a calendar date' }),
    __metadata("design:type", String)
], TenderBooksScopeDto.prototype, "fromDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-10-16',
        description: 'YYYY-MM-DD, ≥ fromDate. Absent = fromDate (Day Book) / today (no-tender list).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' }),
    (0, class_validator_1.IsISO8601)({ strict: true }, { message: 'toDate is not a calendar date' }),
    __metadata("design:type", String)
], TenderBooksScopeDto.prototype, "toDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'One till session (the voucher’s).' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], TenderBooksScopeDto.prototype, "sessionId", void 0);
class TenderDayBookQueryDto extends TenderBooksScopeDto {
    groupBy;
    tenderIds;
    tenderTypeIds;
    withRows;
    limit;
}
exports.TenderDayBookQueryDto = TenderDayBookQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['TENDER', 'TYPE'],
        description: 'TENDER = each tender master on its own ("CARD – HDFC machine 1" apart from "CARD – ICICI ' +
            'machine 2"); TYPE = all of a tender type together. Default TENDER.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value),
    (0, class_validator_1.IsIn)(['TENDER', 'TYPE']),
    __metadata("design:type", String)
], TenderDayBookQueryDto.prototype, "groupBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'Only these tender masters (comma-separated or repeated).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(list),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], TenderDayBookQueryDto.prototype, "tenderIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'Only these tender types (ids, comma-separated or repeated).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(list),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.Matches)(/^\d+$/, { each: true }),
    __metadata("design:type", Array)
], TenderDayBookQueryDto.prototype, "tenderTypeIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Include the line-by-line rows of the range (default true).',
        enum: ['true', 'false'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === undefined ? undefined : String(value).toLowerCase() !== 'false'),
    __metadata("design:type", Boolean)
], TenderDayBookQueryDto.prototype, "withRows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 20000, description: 'Row cap (default 5000).' }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 20000),
    __metadata("design:type", Number)
], TenderDayBookQueryDto.prototype, "limit", void 0);
class NoTenderQueryDto extends TenderBooksScopeDto {
    limit;
}
exports.NoTenderQueryDto = NoTenderQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 20000, description: 'Row cap (default 5000).' }),
    (0, dtoDecorators_1.OptionalQueryInt)(1, 20000),
    __metadata("design:type", Number)
], NoTenderQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=tender-day-book.dto.js.map