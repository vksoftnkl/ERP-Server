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
exports.RenderPreviewDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const print_render_constants_1 = require("../print-render.constants");
const print_render_constants_2 = require("../print-render.constants");
class RenderPreviewDto {
    versionId;
    docId;
    accYear;
    branchId;
    deviceId;
    params;
    outputMode;
    copies;
    body;
    inspect;
    filename;
}
exports.RenderPreviewDto = RenderPreviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The revision to render — print_template_version.ptv_id. A revision, not a template: ' +
            'the body lives on the version, and that is what makes print_log.plg_version_id able to ' +
            'point at the exact bytes rendered.',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "versionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'The document to render. Binds :doc_id. Omitted for a report whose subject is its ' +
            'parameters rather than one document.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "The DOCUMENT's accounting year ('2026-2027'), not the current one — a reprint of last " +
            "year's bill needs last year's partition. Binds :acc_year.",
        example: '2026-2027',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(print_render_constants_1.ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' }),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Binds :branch_id.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'The counter. Binds :device_id.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "The operator's answers to this revision's prompts (ptvParams), keyed by prompt name. " +
            'An answer to a prompt the revision does not declare is refused rather than ignored — it ' +
            'is almost always a spelling mistake, and dropping it quietly makes the report subtly wrong.',
        type: 'object',
        additionalProperties: true,
        example: { from_date: '2026-04-01', godown_id: null },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RenderPreviewDto.prototype, "params", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_render_constants_2.IMPLEMENTED_RENDERERS,
        description: 'Force a renderer. Normally left out: a GRAPHIC design renders as PDF and a GRID design ' +
            'as ESCPOS, and asking for the other one is refused rather than reinterpreted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_render_constants_2.IMPLEMENTED_RENDERERS),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "outputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: print_render_constants_1.MAX_COPIES,
        default: 1,
        description: 'Copies to lay out. Each carries its own copy label and page numbering.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(print_render_constants_1.MAX_COPIES),
    __metadata("design:type", Number)
], RenderPreviewDto.prototype, "copies", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'An UNSAVED body from the canvas, previewed instead of the stored one. Allowed only ' +
            'against a DRAFT revision: a published revision is frozen so that print_log can point at ' +
            'it truthfully, and previewing something else against it would show a design nothing will ' +
            'ever print. The paper and the datasets still come from the revision regardless.',
        type: 'object',
        additionalProperties: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RenderPreviewDto.prototype, "body", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Return JSON — page counts, dataset row counts, timings and warnings — instead of bytes. ' +
            'What the Data tab needs to answer "did my query return anything".',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RenderPreviewDto.prototype, "inspect", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filename stem for the download, without extension.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RenderPreviewDto.prototype, "filename", void 0);
//# sourceMappingURL=render-preview.dto.js.map