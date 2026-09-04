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
exports.RenderDocumentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const print_template_assignment_constants_1 = require("../../print-template-assignment/print-template-assignment.constants");
const print_render_constants_1 = require("../print-render.constants");
class RenderDocumentDto {
    purposeId;
    docId;
    accYear;
    srcModule;
    srcDocType;
    branchId;
    deviceId;
    params;
    assignmentOutputMode;
    outputMode;
    copies;
    isReprint;
    inspect;
    filename;
}
exports.RenderDocumentDto = RenderDocumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'WHAT is being printed OF the document — print_purpose.ppo_id. The same sale bill is a ' +
            'tax invoice, a delivery slip and a godown slip, and each is a different purpose.',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "purposeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The document. Binds :doc_id.',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "The DOCUMENT's accounting year — the partition it lives in. OPTIONAL: leave it out and " +
            "the company's own current fiscal year (fiscal_years.fy_is_current) is used, which is " +
            'right for everything printed in the year it was raised. Name it only for the case where ' +
            "the two differ — a reprint of last year's bill, which is still logged in this year.",
        example: '2026-2027',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(print_render_constants_1.ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The module the document belongs to (SALES, ACCOUNTS, STOCK …). Defaults to the purpose ' +
            "would-be answer SALES; it is recorded on the print log's polymorphic source quad.",
        default: 'SALES',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "srcModule", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "The document type (SALE_BILL, SALE_RETURN …), recorded on the log's source quad. " +
            "Defaults to the purpose's own ppo_doc_type.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "srcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: "Binds :branch_id and narrows the ladder. Defaults to the SESSION's branch — the one the " +
            'counter this session logged in at belongs to — so an ordinary print says nothing here. ' +
            'Send it only to print for a branch other than the one being sat at.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The counter. Binds :device_id and is the NARROWEST rung of the assignment ladder — a ' +
            "till with its own receipt design is resolved by this. Defaults to the SESSION's own " +
            'counter, from the access token, so no caller has to hold a device id or work out which ' +
            'of the two ids it has is the registered one.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'object',
        additionalProperties: true,
        description: "The operator's answers to this revision's prompts (ptvParams). A declared context name " +
            'is answerable here and the answer overrides what the render holds — except :company_id, ' +
            "which is always the authenticated session's.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RenderDocumentDto.prototype, "params", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_template_assignment_constants_1.PTA_OUTPUT_MODES,
        default: 'PRINT',
        description: 'WHERE this goes — a resolution axis, not a file format. A counter may be assigned one ' +
            'design for the paper it prints and another for the PDF it mails.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_assignment_constants_1.PTA_OUTPUT_MODES),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "assignmentOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_render_constants_1.IMPLEMENTED_RENDERERS,
        description: 'Force a renderer, overriding what the assignment and the layout mode imply. Normally ' +
            'left out.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_render_constants_1.IMPLEMENTED_RENDERERS),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "outputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: print_render_constants_1.MAX_COPIES,
        description: 'Overrides the copy count the assignment and purpose agree on. Each copy is a row in ' +
            'print_log carrying the label that was printed on it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(print_render_constants_1.MAX_COPIES),
    __metadata("design:type", Number)
], RenderDocumentDto.prototype, "copies", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Log this as a REPRINT rather than a PRINT. A reprint is NOT a status transition — it is ' +
            'another row in the print log, which is the record of printing.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RenderDocumentDto.prototype, "isReprint", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Return JSON about the render instead of the bytes. The render is still logged.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RenderDocumentDto.prototype, "inspect", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filename stem for the download, without extension.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RenderDocumentDto.prototype, "filename", void 0);
//# sourceMappingURL=render-document.dto.js.map