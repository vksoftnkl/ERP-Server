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
exports.ListPrintTemplateQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const module_list_query_base_dto_1 = require("../../../../common/utils/module-list-query.base.dto");
const print_template_constants_1 = require("../print-template.constants");
class ListPrintTemplateQueryDto extends module_list_query_base_dto_1.ModuleListQueryBaseDto {
    ptlCompanyId;
    onlyOwned;
    ptlPurposeId;
    engine;
    isPublished;
    ptlIsActive;
    includeVersions;
}
exports.ListPrintTemplateQueryDto = ListPrintTemplateQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Narrow to one company. See onlyOwned for what happens to the shipped designs, which ' +
            'belong to no company and are visible to all of them.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateQueryDto.prototype, "ptlCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: false,
        description: "With ptlCompanyId: false (the default) returns that company's templates AND the shipped " +
            "ones it can use; true returns only the company's own. Ignored without ptlCompanyId.",
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateQueryDto.prototype, "onlyOwned", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'print_purpose.ppo_id' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateQueryDto.prototype, "ptlPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: print_template_constants_1.PTV_ENGINES,
        description: 'Only templates whose PUBLISHED revision uses this engine',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_constants_1.PTV_ENGINES),
    __metadata("design:type", String)
], ListPrintTemplateQueryDto.prototype, "engine", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        description: 'Only templates that have a published revision (true), or only those that do not',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateQueryDto.prototype, "isPublished", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateQueryDto.prototype, "ptlIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: true,
        description: 'Return each template WHOLE, with its versions and their datasets — the same shape ' +
            '/get answers with. Set false for a light pick list: header rows only.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateQueryDto.prototype, "includeVersions", void 0);
//# sourceMappingURL=list-print-template-query.dto.js.map