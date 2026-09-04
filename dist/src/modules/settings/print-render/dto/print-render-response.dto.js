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
exports.PrintRenderProvidersSuccessDto = exports.PrintDataProviderDto = exports.PrintRenderInspectSuccessDto = exports.RenderInspectionDto = exports.RenderWarningDto = exports.ResolvedDatasetDto = exports.PrintRenderErrorResponseDto = exports.PrintRenderErrorDetailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PrintRenderErrorDetailDto {
    field;
    message;
}
exports.PrintRenderErrorDetailDto = PrintRenderErrorDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'bands.3.elements.7.value',
        description: 'A path into the DESIGN or the request — not a column name. `bands.3.elements.7.value` ' +
            'names a box on the canvas; `datasets.items.ptdSql` names a query on the Data tab; ' +
            '`params.from_date` names a prompt.',
    }),
    __metadata("design:type", String)
], PrintRenderErrorDetailDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'band references unknown dataset "lines"' }),
    __metadata("design:type", String)
], PrintRenderErrorDetailDto.prototype, "message", void 0);
class PrintRenderErrorResponseDto {
    success;
    message;
    errors;
}
exports.PrintRenderErrorResponseDto = PrintRenderErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PrintRenderErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'The stored design cannot be rendered as it stands' }),
    __metadata("design:type", String)
], PrintRenderErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PrintRenderErrorDetailDto] }),
    __metadata("design:type", Array)
], PrintRenderErrorResponseDto.prototype, "errors", void 0);
class ResolvedDatasetDto {
    name;
    datasetNo;
    role;
    sourceKind;
    rowCount;
    durationMs;
    truncated;
}
exports.ResolvedDatasetDto = ResolvedDatasetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'items' }),
    __metadata("design:type", String)
], ResolvedDatasetDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], ResolvedDatasetDto.prototype, "datasetNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['MASTER', 'DETAIL'], example: 'DETAIL' }),
    __metadata("design:type", String)
], ResolvedDatasetDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['PROVIDER', 'SQL'], example: 'SQL' }),
    __metadata("design:type", String)
], ResolvedDatasetDto.prototype, "sourceKind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14 }),
    __metadata("design:type", Number)
], ResolvedDatasetDto.prototype, "rowCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 21 }),
    __metadata("design:type", Number)
], ResolvedDatasetDto.prototype, "durationMs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: false,
        description: 'True when ptdRowLimit cut the result short. A bill printing 5,000 of 5,140 lines is a ' +
            'legal document missing rows, so it is named rather than silently accepted.',
    }),
    __metadata("design:type", Boolean)
], ResolvedDatasetDto.prototype, "truncated", void 0);
class RenderWarningDto {
    kind;
    message;
}
exports.RenderWarningDto = RenderWarningDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'row-limit' }),
    __metadata("design:type", String)
], RenderWarningDto.prototype, "kind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Dataset 'items' returned its full row limit of 5000 rows" }),
    __metadata("design:type", String)
], RenderWarningDto.prototype, "message", void 0);
class RenderInspectionDto {
    outputMode;
    contentType;
    pageCount;
    pagesPerCopy;
    copies;
    copyLabels;
    templateId;
    templateName;
    versionId;
    revNo;
    status;
    engine;
    paperCode;
    layoutMs;
    renderMs;
    detailRows;
    byteCount;
    datasets;
    warnings;
    printLogIds;
}
exports.RenderInspectionDto = RenderInspectionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PDF' }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "outputMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'application/pdf' }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "contentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "pageCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [Number], example: [1, 1, 1], description: 'Pages per copy, in order.' }),
    __metadata("design:type", Array)
], RenderInspectionDto.prototype, "pagesPerCopy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "copies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: [String],
        example: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
        description: 'What each copy said on the paper. An empty entry means it said nothing.',
    }),
    __metadata("design:type", Array)
], RenderInspectionDto.prototype, "copyLabels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tax Invoice — A4', nullable: true }),
    __metadata("design:type", Object)
], RenderInspectionDto.prototype, "templateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The exact bytes that were rendered.' }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "versionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "revNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DRAFT', 'PUBLISHED', 'RETIRED'] }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'JSON_BANDS' }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "engine", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'A4' }),
    __metadata("design:type", String)
], RenderInspectionDto.prototype, "paperCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 38 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "layoutMs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 112 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "renderMs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 14 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "detailRows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 27_431 }),
    __metadata("design:type", Number)
], RenderInspectionDto.prototype, "byteCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ResolvedDatasetDto] }),
    __metadata("design:type", Array)
], RenderInspectionDto.prototype, "datasets", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [RenderWarningDto] }),
    __metadata("design:type", Array)
], RenderInspectionDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'One print_log id per copy. Present on /print, absent on /preview.',
    }),
    __metadata("design:type", Array)
], RenderInspectionDto.prototype, "printLogIds", void 0);
class PrintRenderInspectSuccessDto {
    success;
    message;
    data;
}
exports.PrintRenderInspectSuccessDto = PrintRenderInspectSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintRenderInspectSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Preview rendered successfully' }),
    __metadata("design:type", String)
], PrintRenderInspectSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: RenderInspectionDto }),
    __metadata("design:type", RenderInspectionDto)
], PrintRenderInspectSuccessDto.prototype, "data", void 0);
class PrintDataProviderDto {
    code;
    label;
    cardinality;
}
exports.PrintDataProviderDto = PrintDataProviderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sales.bill.header' }),
    __metadata("design:type", String)
], PrintDataProviderDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale bill — header' }),
    __metadata("design:type", String)
], PrintDataProviderDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['one', 'many'] }),
    __metadata("design:type", String)
], PrintDataProviderDto.prototype, "cardinality", void 0);
class PrintRenderProvidersSuccessDto {
    success;
    message;
    data;
}
exports.PrintRenderProvidersSuccessDto = PrintRenderProvidersSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintRenderProvidersSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print data providers retrieved successfully' }),
    __metadata("design:type", String)
], PrintRenderProvidersSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PrintDataProviderDto] }),
    __metadata("design:type", Array)
], PrintRenderProvidersSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=print-render-response.dto.js.map