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
exports.SavePrintTemplateVersionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const print_template_constants_1 = require("../print-template.constants");
const save_print_template_dataset_dto_1 = require("./save-print-template-dataset.dto");
const MAX_DATASETS_PER_VERSION = 100;
const toBodyText = (value) => typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
class SavePrintTemplateVersionDto {
    ptvId;
    ptvRevNo;
    ptvStatus;
    ptvEngine;
    ptvBody;
    ptvSchemaVer;
    ptvPaperCode;
    ptvOrientation;
    ptvWidthMm;
    ptvHeightMm;
    ptvMarginTopMm;
    ptvMarginBottomMm;
    ptvMarginLeftMm;
    ptvMarginRightMm;
    ptvColumns;
    ptvLang;
    ptvFontFamily;
    ptvParams;
    ptvNote;
    ptvApprovedBy;
    ptvIsDeleted;
    ptvCreatedBy;
    ptvModifiedBy;
    datasets;
}
exports.SavePrintTemplateVersionDto = SavePrintTemplateVersionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update this version, absent = add a new revision. Only a DRAFT may be updated.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        description: 'Omit it and the next number for this template is assigned. Dense, unique per template ' +
            'and never reused — the history is append-only.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SavePrintTemplateVersionDto.prototype, "ptvRevNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_template_constants_1.PTV_STATUSES,
        default: 'DRAFT',
        description: 'DRAFT is editable and nothing else is. PUBLISHED needs an approver and moves the ' +
            "template's published pointer to this revision. RETIRED takes it out of service.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_constants_1.PTV_STATUSES),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_template_constants_1.PTV_ENGINES,
        default: 'JSON_BANDS',
        description: 'What ptvBody IS. Without this column, changing engines is a flag day.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_constants_1.PTV_ENGINES),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvEngine", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'The design. Send a JSON object for JSON_BANDS — it is stored as text — or a string for ' +
            'the text and markup engines.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBodyText(value)),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvBody", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SavePrintTemplateVersionDto.prototype, "ptvSchemaVer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: print_template_constants_1.PTV_PAPER_CODE_MAX_LENGTH, default: 'A4', example: 'A4' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(print_template_constants_1.PTV_PAPER_CODE_MAX_LENGTH),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvPaperCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: print_template_constants_1.PTV_ORIENTATIONS, default: 'PORTRAIT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_constants_1.PTV_ORIENTATIONS),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvOrientation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Greater than 0, or null to take the width from the paper',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvWidthMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvHeightMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePrintTemplateVersionDto.prototype, "ptvMarginTopMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePrintTemplateVersionDto.prototype, "ptvMarginBottomMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePrintTemplateVersionDto.prototype, "ptvMarginLeftMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0, minimum: 0 }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], SavePrintTemplateVersionDto.prototype, "ptvMarginRightMm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        minimum: print_template_constants_1.PTV_COLUMNS_MIN,
        maximum: print_template_constants_1.PTV_COLUMNS_MAX,
        description: 'Characters per line for the text engines. Meaningless for a page one — send null.',
    }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvColumns", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 'en-IN',
        example: 'ta-IN',
        description: 'The DEFAULT, not a resolution key — a render may override it. Language must never fork a ' +
            'template.',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(5),
    __metadata("design:type", String)
], SavePrintTemplateVersionDto.prototype, "ptvLang", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: print_template_constants_1.PTV_FONT_FAMILY_MAX_LENGTH, nullable: true }),
    (0, dtoDecorators_1.NullableString)(print_template_constants_1.PTV_FONT_FAMILY_MAX_LENGTH),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvFontFamily", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'array',
        items: { type: 'object' },
        nullable: true,
        example: [
            { name: 'from_date', type: 'DATE', required: true, label: 'From date' },
            { name: 'godown_id', type: 'UUID', required: false, label: 'Godown' },
        ],
        description: 'What the OPERATOR is asked, ONCE, for the whole render. ANY name may be declared, ' +
            'including a context one (:company_id, :branch_id, :acc_year, :doc_id, :user_id, ' +
            ':device_id): those are filled in from the render when this array leaves them out, and a ' +
            "row here overrides that — except company_id, whose value stays the session's.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvParams", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: print_template_constants_1.PTV_NOTE_MAX_LENGTH, nullable: true }),
    (0, dtoDecorators_1.NullableString)(print_template_constants_1.PTV_NOTE_MAX_LENGTH),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvNote", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Required to publish. A version whose datasets carry stored SQL is, in every meaningful ' +
            'sense, code — so publishing takes a signature. ptvApprovedOn is stamped by the server.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvApprovedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Soft delete this revision. Omitting a version from the array does NOT delete it — the ' +
            'history is append-only, so removal is an explicit act. Refused for a PUBLISHED revision ' +
            'and for the one the template currently points at.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePrintTemplateVersionDto.prototype, "ptvIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateVersionDto.prototype, "ptvModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [save_print_template_dataset_dto_1.SavePrintTemplateDatasetDto],
        description: 'The queries that feed this revision. An array that is PRESENT replaces the set: rows ' +
            'carrying ptdId are updated, rows without one are inserted, and rows already on the ' +
            'version but missing from the array are soft deleted. Omit the key to leave the datasets ' +
            'alone — "datasets": [] means "delete every one of them", which is not the same thing.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_DATASETS_PER_VERSION),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_print_template_dataset_dto_1.SavePrintTemplateDatasetDto),
    __metadata("design:type", Array)
], SavePrintTemplateVersionDto.prototype, "datasets", void 0);
//# sourceMappingURL=save-print-template-version.dto.js.map