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
exports.PreviewDto = exports.BulkPrintDto = exports.PrintQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const print_constants_1 = require("../print.constants");
class PrintQueryDto {
    accYear;
    paper;
    mode;
    templateId;
    branchId;
    printerProfile;
    partyId;
    asOn;
}
exports.PrintQueryDto = PrintQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Accounting year of the document, e.g. 2026-2027. Required: the bill tables are partitioned by it.',
        example: '2026-2027',
    }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Paper code. A4 | A5 | T58 | T80 | DM80 | DM132.',
        default: 'A4',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "paper", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Output mode. PDF | ESCPOS | ESCP_DOTMATRIX.',
        default: 'PDF',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Use a specific template instead of the resolved default.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Branch scope for template resolution.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Printer profile code, for the raw output modes. Omitted = built-in Epson defaults.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(40),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "printerProfile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Party id, for statement-style reports whose subject is a ledger rather than a document.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'As-on date for an aged statement, ISO yyyy-MM-dd. Defaults to today.',
        example: '2026-08-24',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(10),
    __metadata("design:type", String)
], PrintQueryDto.prototype, "asOn", void 0);
class BulkPrintDto {
    docType;
    docIds;
    accYear;
    paper;
    mode;
    templateId;
    branchId;
    printerProfile;
    params;
}
exports.BulkPrintDto = BulkPrintDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Document type, e.g. SALE_INVOICE.', maxLength: 40 }),
    (0, dtoDecorators_1.UpperMaxString)(40),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: `Document ids to render. Capped at ${print_constants_1.MAX_BULK_DOCUMENTS} per job.`,
        type: [String],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayMaxSize)(print_constants_1.MAX_BULK_DOCUMENTS),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkPrintDto.prototype, "docIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Accounting year of the documents.', example: '2026-2027' }),
    (0, dtoDecorators_1.TrimmedString)(9),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'A4' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "paper", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'PDF' }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalTrimmedString)(40),
    __metadata("design:type", String)
], BulkPrintDto.prototype, "printerProfile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Extra parameters passed to every provider.',
        type: 'object',
        additionalProperties: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], BulkPrintDto.prototype, "params", void 0);
class PreviewDto {
    definition;
    mode;
    useSampleData;
    docId;
    accYear;
    branchId;
    printerProfile;
    params;
}
exports.PreviewDto = PreviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The definition to render. Need not be saved, and is validated in full first.',
        type: 'object',
        additionalProperties: true,
    }),
    (0, class_validator_1.IsDefined)({ message: 'definition is required' }),
    (0, class_validator_1.IsObject)({ message: 'definition must be an object' }),
    __metadata("design:type", Object)
], PreviewDto.prototype, "definition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Output mode. Defaults from the definition layout mode: GRID -> ESCPOS, else PDF.',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], PreviewDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        description: 'Render against provider sample data rather than a real document. ' +
            'Defaults to true when no docId is supplied — which is what keeps the ' +
            'designer usable against a production tenant without reading its data.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PreviewDto.prototype, "useSampleData", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Render a real document instead of sample data.' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(64),
    __metadata("design:type", String)
], PreviewDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-2027' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], PreviewDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], PreviewDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalTrimmedString)(40),
    __metadata("design:type", String)
], PreviewDto.prototype, "printerProfile", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'object', additionalProperties: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PreviewDto.prototype, "params", void 0);
//# sourceMappingURL=print-request.dto.js.map