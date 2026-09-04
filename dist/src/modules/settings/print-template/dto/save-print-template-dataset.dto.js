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
exports.SavePrintTemplateDatasetDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const print_template_constants_1 = require("../print-template.constants");
class SavePrintTemplateDatasetDto {
    ptdId;
    ptdRole;
    ptdDatasetNo;
    ptdSortOrder;
    ptdName;
    ptdLabel;
    ptdSourceKind;
    ptdProviderCode;
    ptdSql;
    ptdRequiresCompany;
    ptdParentNo;
    ptdLinkFields;
    ptdRowLimit;
    ptdTimeoutMs;
    ptdRemarks;
    ptdCreatedBy;
    ptdModifiedBy;
}
exports.SavePrintTemplateDatasetDto = SavePrintTemplateDatasetDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Present = update this dataset row, absent = insert a new one',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateDatasetDto.prototype, "ptdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_template_constants_1.PTD_ROLES,
        default: 'DETAIL',
        description: 'MASTER: the header context, one row read, and it must be ptdDatasetNo 0. ' +
            'DETAIL: a repeating band.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_constants_1.PTD_ROLES),
    __metadata("design:type", String)
], SavePrintTemplateDatasetDto.prototype, "ptdRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: print_template_constants_1.PTD_DATASET_NO_MIN,
        maximum: print_template_constants_1.PTD_DATASET_NO_MAX,
        description: 'THE BINDING — what a band actually points at, unique within the version. The MASTER is ' +
            'always 0. Changing it rebinds every band that names it.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(print_template_constants_1.PTD_DATASET_NO_MIN, print_template_constants_1.PTD_DATASET_NO_MAX),
    __metadata("design:type", Number)
], SavePrintTemplateDatasetDto.prototype, "ptdDatasetNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: 0,
        description: 'Display order in the designer. Binds nothing — safe to reorder.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SavePrintTemplateDatasetDto.prototype, "ptdSortOrder", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: print_template_constants_1.PTD_NAME_MAX_LENGTH,
        example: 'items',
        description: 'The same binding by name. Lower snake case, starting with a letter.',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(print_template_constants_1.PTD_NAME_MAX_LENGTH),
    __metadata("design:type", String)
], SavePrintTemplateDatasetDto.prototype, "ptdName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: print_template_constants_1.PTD_LABEL_MAX_LENGTH, nullable: true }),
    (0, dtoDecorators_1.NullableString)(print_template_constants_1.PTD_LABEL_MAX_LENGTH),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdLabel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_template_constants_1.PTD_SOURCE_KINDS,
        default: 'PROVIDER',
        description: 'PROVIDER for anything needing joins across partitioned tables or real business logic; ' +
            'SQL for everything else, so a new report costs no release. Exactly one of ' +
            'ptdProviderCode / ptdSql goes with it.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_constants_1.PTD_SOURCE_KINDS),
    __metadata("design:type", String)
], SavePrintTemplateDatasetDto.prototype, "ptdSourceKind", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: print_template_constants_1.PTD_PROVIDER_MAX_LENGTH,
        nullable: true,
        example: 'sales.bill.tax_summary',
        description: 'Required when ptdSourceKind is PROVIDER, and forbidden otherwise',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(print_template_constants_1.PTD_PROVIDER_MAX_LENGTH),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdProviderCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'SELECT sbi_item_name AS item_name, sbi_qty AS qty FROM sales.sale_bill_items ' +
            'WHERE sbi_comp_id = :company_id AND sbi_sb_id = :doc_id ORDER BY sbi_slno',
        description: 'Required when ptdSourceKind is SQL, and forbidden otherwise. Parameters are BOUND — ' +
            "write :company_id, never ':company_id'. Eleven authoring guards run on it; they are a " +
            'lint, not the security boundary.',
    }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdSql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'false only for genuinely global data, such as a state-code list. Leaving it true is what ' +
            "stops one company seeing another's numbers.",
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePrintTemplateDatasetDto.prototype, "ptdRequiresCompany", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: "Nested detail: this dataset's rows are the children of the current row of the dataset " +
            'with this number. Goes with ptdLinkFields; neither works alone.',
    }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdParentNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: print_template_constants_1.PTD_LINK_FIELDS_MAX_LENGTH,
        nullable: true,
        example: 'sb_id=bill_id,sbi_slno=slno',
        description: 'parent=child pairs, comma separated, no spaces. LEFT is a column the PARENT dataset ' +
            'returns, RIGHT is one THIS dataset returns — both output columns, neither a parameter.',
    }),
    (0, dtoDecorators_1.NullableLowerMaxString)(print_template_constants_1.PTD_LINK_FIELDS_MAX_LENGTH),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdLinkFields", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: print_template_constants_1.PTD_ROW_LIMIT_MIN,
        maximum: print_template_constants_1.PTD_ROW_LIMIT_MAX,
        default: 5000,
        description: 'Measures the WHOLE band — a child query runs once per render, not per parent row',
    }),
    (0, dtoDecorators_1.OptionalInteger)(print_template_constants_1.PTD_ROW_LIMIT_MIN, print_template_constants_1.PTD_ROW_LIMIT_MAX),
    __metadata("design:type", Number)
], SavePrintTemplateDatasetDto.prototype, "ptdRowLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: print_template_constants_1.PTD_TIMEOUT_MS_MIN,
        maximum: print_template_constants_1.PTD_TIMEOUT_MS_MAX,
        default: 15000,
    }),
    (0, dtoDecorators_1.OptionalInteger)(print_template_constants_1.PTD_TIMEOUT_MS_MIN, print_template_constants_1.PTD_TIMEOUT_MS_MAX),
    __metadata("design:type", Number)
], SavePrintTemplateDatasetDto.prototype, "ptdTimeoutMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: print_template_constants_1.PTD_REMARKS_MAX_LENGTH, nullable: true }),
    (0, dtoDecorators_1.NullableString)(print_template_constants_1.PTD_REMARKS_MAX_LENGTH),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateDatasetDto.prototype, "ptdModifiedBy", void 0);
//# sourceMappingURL=save-print-template-dataset.dto.js.map