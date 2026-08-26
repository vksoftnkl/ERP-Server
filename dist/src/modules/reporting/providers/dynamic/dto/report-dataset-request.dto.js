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
exports.PreviewReportDatasetDto = exports.ProbeReportDatasetDto = exports.UpdateReportDatasetDto = exports.CreateReportDatasetDto = exports.ReportDatasetParamDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const dtoDecorators_1 = require("../../../../../common/dto/dtoDecorators");
const emptyArrayWhenNullish = ({ value }) => value === null || value === undefined ? [] : value;
class ReportDatasetParamDto {
    name;
    type;
    required;
    label;
    defaultValue;
}
exports.ReportDatasetParamDto = ReportDatasetParamDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Token as written in the SQL, e.g. 'p_party_id'.", maxLength: 60 }),
    (0, dtoDecorators_1.TrimmedString)(60),
    __metadata("design:type", String)
], ReportDatasetParamDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['string', 'number', 'integer', 'boolean', 'date', 'uuid'] }),
    (0, class_validator_1.IsIn)(['string', 'number', 'integer', 'boolean', 'date', 'uuid']),
    __metadata("design:type", String)
], ReportDatasetParamDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether a render must supply it.', default: false }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReportDatasetParamDto.prototype, "required", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Human label for the parameter prompt.', maxLength: 80 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(80),
    __metadata("design:type", String)
], ReportDatasetParamDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Value used when the caller supplies nothing. Also the value used to probe the ' +
            'query at save time, so a required parameter is easiest to save with one set.',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], ReportDatasetParamDto.prototype, "defaultValue", void 0);
class CreateReportDatasetDto {
    rdsToken;
    rdsLabel;
    rdsCardinality;
    rdsDocTypes = [];
    rdsSql;
    rdsParams = [];
    rdsFieldOverrides;
    rdsSampleRows;
    rdsMaxRows;
    rdsNotes;
    rdsIsActive;
}
exports.CreateReportDatasetDto = CreateReportDatasetDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Dataset token a template binds. Must be namespaced 'custom.<name>' so it can " +
            'never shadow a compiled provider.',
        example: 'custom.sales.daybook',
        maxLength: 120,
    }),
    (0, dtoDecorators_1.TrimmedString)(120),
    __metadata("design:type", String)
], CreateReportDatasetDto.prototype, "rdsToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Label shown in the designer field tree.', maxLength: 160 }),
    (0, dtoDecorators_1.TrimmedString)(160),
    __metadata("design:type", String)
], CreateReportDatasetDto.prototype, "rdsLabel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['one', 'many'],
        description: "'one' yields a single row; only 'many' can drive a repeating band.",
    }),
    (0, class_validator_1.IsIn)(['one', 'many']),
    __metadata("design:type", String)
], CreateReportDatasetDto.prototype, "rdsCardinality", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Document types this dataset is offered for. Empty = every document type.',
        type: [String],
        default: [],
    }),
    (0, class_transformer_1.Transform)(emptyArrayWhenNullish),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(40, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(40),
    __metadata("design:type", Array)
], CreateReportDatasetDto.prototype, "rdsDocTypes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'SELECT statement. Must reference p_company_id; p_branch_id, p_acc_year, p_doc_id ' +
            'and p_user_id are also bound from the request context. Any other p_* token must ' +
            'be declared in rdsParams.',
        example: 'SELECT sb_bill_refno AS bill_no, sb_bill_date AS bill_date, sb_bill_amt AS bill_amt ' +
            'FROM sales.sale_bill WHERE sb_company_id = p_company_id AND sb_acc_year = p_acc_year ' +
            'AND NOT sb_is_deleted',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20_000),
    __metadata("design:type", String)
], CreateReportDatasetDto.prototype, "rdsSql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [ReportDatasetParamDto], default: [] }),
    (0, class_transformer_1.Transform)(emptyArrayWhenNullish),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(30),
    __metadata("design:type", Array)
], CreateReportDatasetDto.prototype, "rdsParams", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Optional label/format overrides keyed by column name. Column TYPES are always ' +
            'introspected from the query and cannot be overridden — the type is a fact about ' +
            'the SQL, not a preference.',
        type: [Object],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(300),
    __metadata("design:type", Array)
], CreateReportDatasetDto.prototype, "rdsFieldOverrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Hand-authored preview rows for the designer. Omit to synthesise them from the ' +
            'introspected field types. Never paste live rows here — one definition is visible ' +
            'to every tenant that opens the designer.',
        type: [Object],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    __metadata("design:type", Array)
], CreateReportDatasetDto.prototype, "rdsSampleRows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Hard row cap applied as a LIMIT.', default: 5000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100_000),
    __metadata("design:type", Number)
], CreateReportDatasetDto.prototype, "rdsMaxRows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", String)
], CreateReportDatasetDto.prototype, "rdsNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateReportDatasetDto.prototype, "rdsIsActive", void 0);
class UpdateReportDatasetDto {
    rdsLabel;
    rdsCardinality;
    rdsDocTypes;
    rdsSql;
    rdsParams;
    rdsFieldOverrides;
    rdsSampleRows;
    rdsMaxRows;
    rdsNotes;
    rdsIsActive;
}
exports.UpdateReportDatasetDto = UpdateReportDatasetDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 160 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(160),
    __metadata("design:type", String)
], UpdateReportDatasetDto.prototype, "rdsLabel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['one', 'many'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['one', 'many']),
    __metadata("design:type", String)
], UpdateReportDatasetDto.prototype, "rdsCardinality", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyArrayWhenNullish),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(40, { each: true }),
    (0, class_validator_1.ArrayMaxSize)(40),
    __metadata("design:type", Array)
], UpdateReportDatasetDto.prototype, "rdsDocTypes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20_000),
    __metadata("design:type", String)
], UpdateReportDatasetDto.prototype, "rdsSql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [ReportDatasetParamDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(emptyArrayWhenNullish),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(30),
    __metadata("design:type", Array)
], UpdateReportDatasetDto.prototype, "rdsParams", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(300),
    __metadata("design:type", Array)
], UpdateReportDatasetDto.prototype, "rdsFieldOverrides", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    __metadata("design:type", Array)
], UpdateReportDatasetDto.prototype, "rdsSampleRows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100_000),
    __metadata("design:type", Number)
], UpdateReportDatasetDto.prototype, "rdsMaxRows", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(500),
    __metadata("design:type", String)
], UpdateReportDatasetDto.prototype, "rdsNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateReportDatasetDto.prototype, "rdsIsActive", void 0);
class ProbeReportDatasetDto {
    rdsSql;
    rdsParams = [];
}
exports.ProbeReportDatasetDto = ProbeReportDatasetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Candidate SELECT statement.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20_000),
    __metadata("design:type", String)
], ProbeReportDatasetDto.prototype, "rdsSql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [ReportDatasetParamDto], default: [] }),
    (0, class_transformer_1.Transform)(emptyArrayWhenNullish),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(30),
    __metadata("design:type", Array)
], ProbeReportDatasetDto.prototype, "rdsParams", void 0);
class PreviewReportDatasetDto {
    accYear;
    branchId;
    docId;
    params;
    limit;
}
exports.PreviewReportDatasetDto = PreviewReportDatasetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Accounting year to resolve against, e.g. 2026-2027.' }),
    (0, dtoDecorators_1.TrimmedString)(20),
    __metadata("design:type", String)
], PreviewReportDatasetDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Branch to resolve against. Omit for company-wide.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(64),
    __metadata("design:type", String)
], PreviewReportDatasetDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Document id, for a document-scoped dataset.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(64),
    __metadata("design:type", String)
], PreviewReportDatasetDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Values for the declared p_* parameters.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PreviewReportDatasetDto.prototype, "params", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Rows to return. Capped at 100.', default: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PreviewReportDatasetDto.prototype, "limit", void 0);
//# sourceMappingURL=report-dataset-request.dto.js.map