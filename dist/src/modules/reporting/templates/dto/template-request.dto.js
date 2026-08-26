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
exports.ImportTemplateDto = exports.CloneTemplateDto = exports.GetTemplatesQueryDto = exports.UpdateTemplateDto = exports.CreateTemplateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class CreateTemplateDto {
    ptDocType;
    ptOutputMode;
    ptPaperCode;
    ptName;
    ptCompanyId;
    ptBranchId;
    ptIsDefault;
    ptIsActive;
    definition;
}
exports.CreateTemplateDto = CreateTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Document type this design prints, e.g. SALE_INVOICE.',
        example: 'SALE_INVOICE',
        maxLength: 40,
    }),
    (0, dtoDecorators_1.UpperMaxString)(40),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "ptDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Output mode: PDF | ESCPOS | ESCP_DOTMATRIX | HTML.',
        example: 'PDF',
        maxLength: 20,
    }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "ptOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Paper code, e.g. A4 | A5 | T58 | T80 | DM80 | DM132.',
        example: 'A4',
        maxLength: 20,
    }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "ptPaperCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Template name, unique within its scope.', maxLength: 120 }),
    (0, dtoDecorators_1.TrimmedString)(120),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "ptName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Owning company. Omitted = a SYSTEM template, which only an administrator ' +
            'should create; ordinary callers get their request context company.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "ptCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Owning branch. Omitted = every branch of the company.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CreateTemplateDto.prototype, "ptBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Make this the default for its (company, branch, docType, mode, paper).',
        default: false,
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], CreateTemplateDto.prototype, "ptIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], CreateTemplateDto.prototype, "ptIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The template definition. Validated against the schemaVersion-1 contract; ' +
            'see GET /reports/templates/schema for the full shape.',
        type: 'object',
        additionalProperties: true,
    }),
    (0, class_validator_1.IsDefined)({ message: 'definition is required' }),
    (0, class_validator_1.IsObject)({ message: 'definition must be an object' }),
    __metadata("design:type", Object)
], CreateTemplateDto.prototype, "definition", void 0);
class UpdateTemplateDto {
    ptName;
    ptIsActive;
    definition;
    note;
}
exports.UpdateTemplateDto = UpdateTemplateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 120 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(120),
    __metadata("design:type", String)
], UpdateTemplateDto.prototype, "ptName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], UpdateTemplateDto.prototype, "ptIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'A new definition. Supplying it bumps ptVersion and writes the previous ' +
            'body to a revision row. Omit it to change only the metadata above.',
        type: 'object',
        additionalProperties: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'definition must be an object' }),
    __metadata("design:type", Object)
], UpdateTemplateDto.prototype, "definition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Note recorded against the revision this update creates.',
        maxLength: 200,
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(200),
    __metadata("design:type", String)
], UpdateTemplateDto.prototype, "note", void 0);
class GetTemplatesQueryDto {
    ptDocType;
    ptOutputMode;
    ptPaperCode;
    ptCompanyId;
    ptBranchId;
    includeSystem;
    activeOnly;
}
exports.GetTemplatesQueryDto = GetTemplatesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by document type.', maxLength: 40 }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(40),
    __metadata("design:type", String)
], GetTemplatesQueryDto.prototype, "ptDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by output mode.', maxLength: 20 }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], GetTemplatesQueryDto.prototype, "ptOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by paper code.', maxLength: 20 }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(20),
    __metadata("design:type", String)
], GetTemplatesQueryDto.prototype, "ptPaperCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Company to list for. Defaults to the request context company.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetTemplatesQueryDto.prototype, "ptCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], GetTemplatesQueryDto.prototype, "ptBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: true,
        description: 'Include the shipped system templates (ptCompanyId NULL) alongside the ' +
            "tenant's own. These are what a customer clones to start from.",
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetTemplatesQueryDto.prototype, "includeSystem", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, default: true }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], GetTemplatesQueryDto.prototype, "activeOnly", void 0);
class CloneTemplateDto {
    ptName;
    ptCompanyId;
    ptBranchId;
    ptIsDefault;
}
exports.CloneTemplateDto = CloneTemplateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Name for the copy. Defaults to the source name plus " (copy)".',
        maxLength: 120,
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(120),
    __metadata("design:type", String)
], CloneTemplateDto.prototype, "ptName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Company for the copy. Defaults to the request context company.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CloneTemplateDto.prototype, "ptCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Branch for the copy.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], CloneTemplateDto.prototype, "ptBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Make the copy the default for its scope immediately.',
        default: false,
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], CloneTemplateDto.prototype, "ptIsDefault", void 0);
class ImportTemplateDto {
    payload;
    ptName;
    ptCompanyId;
    ptBranchId;
}
exports.ImportTemplateDto = ImportTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'An exported template file, as produced by GET .../:id/export.',
        type: 'object',
        additionalProperties: true,
    }),
    (0, class_validator_1.IsDefined)({ message: 'payload is required' }),
    (0, class_validator_1.IsObject)({ message: 'payload must be an object' }),
    __metadata("design:type", Object)
], ImportTemplateDto.prototype, "payload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Override the imported name.',
        maxLength: 120,
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(120),
    __metadata("design:type", String)
], ImportTemplateDto.prototype, "ptName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Company to import into. Defaults to the context company.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ImportTemplateDto.prototype, "ptCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ImportTemplateDto.prototype, "ptBranchId", void 0);
//# sourceMappingURL=template-request.dto.js.map