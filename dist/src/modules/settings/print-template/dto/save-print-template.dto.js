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
exports.SavePrintTemplateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const print_template_constants_1 = require("../print-template.constants");
const save_print_template_version_dto_1 = require("./save-print-template-version.dto");
const MAX_VERSIONS_PER_REQUEST = 20;
class SavePrintTemplateDto {
    ptlId;
    ptlCompanyId;
    ptlPurposeId;
    ptlCode;
    ptlName;
    ptlDescription;
    ptlPublishedRevId;
    ptlForkedFromId;
    ptlForkedFromRev;
    ptlSortOrder;
    ptlIsActive;
    ptlCreatedBy;
    ptlModifiedBy;
    versions;
}
exports.SavePrintTemplateDto = SavePrintTemplateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update the existing template, absent = create one',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateDto.prototype, "ptlId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = shipped with the product, visible to every company. The only scope column here — ' +
            'branch, device and "is default" are RESOLUTION questions and live on the assignment.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'print_purpose.ppo_id — WHAT this design prints. Required on create.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateDto.prototype, "ptlPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: print_template_constants_1.PTL_CODE_MAX_LENGTH,
        example: 'SALE_INVOICE_A4',
        description: 'Letters, digits, underscore and hyphen. Unique per owner, case-insensitively — a shipped ' +
            "code and a company's own copy of it coexist, which is what forking means.",
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(print_template_constants_1.PTL_CODE_MAX_LENGTH),
    __metadata("design:type", String)
], SavePrintTemplateDto.prototype, "ptlCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: print_template_constants_1.PTL_NAME_MAX_LENGTH, example: 'Tax Invoice — A4' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(print_template_constants_1.PTL_NAME_MAX_LENGTH),
    __metadata("design:type", String)
], SavePrintTemplateDto.prototype, "ptlName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlDescription", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: "The revision a render actually uses. Usually left alone: setting a version's ptvStatus " +
            'to PUBLISHED moves this pointer for you. Sent explicitly, it must name a PUBLISHED, ' +
            'undeleted version OF THIS TEMPLATE — a rule fk_ptl_published_rev does not itself enforce.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlPublishedRevId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Where a clone came from. Goes with ptlForkedFromRev; neither works alone.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlForkedFromId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlForkedFromRev", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 100,
        minimum: 0,
        description: 'Order in the "print in format" list',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SavePrintTemplateDto.prototype, "ptlSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePrintTemplateDto.prototype, "ptlIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDto.prototype, "ptlModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [save_print_template_version_dto_1.SavePrintTemplateVersionDto],
        description: 'The revisions. Rows carrying ptvId update that revision — a DRAFT only — and rows ' +
            'without one are appended as the next revision. A revision MISSING from the array is left ' +
            'alone: the history is append-only, so deleting one is an explicit ptvIsDeleted: true.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_VERSIONS_PER_REQUEST),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_print_template_version_dto_1.SavePrintTemplateVersionDto),
    __metadata("design:type", Array)
], SavePrintTemplateDto.prototype, "versions", void 0);
//# sourceMappingURL=save-print-template.dto.js.map