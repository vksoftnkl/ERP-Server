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
exports.ListPrintTemplateAssignmentQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const module_list_query_base_dto_1 = require("../../../../common/utils/module-list-query.base.dto");
const print_template_assignment_constants_1 = require("../print-template-assignment.constants");
class ListPrintTemplateAssignmentQueryDto extends module_list_query_base_dto_1.ModuleListQueryBaseDto {
    ptaCompanyId;
    includeGlobal;
    globalOnly;
    ptaBranchId;
    ptaDeviceId;
    ptaPurposeId;
    ptaTemplateId;
    ptaOutputMode;
    ptaIsActive;
}
exports.ListPrintTemplateAssignmentQueryDto = ListPrintTemplateAssignmentQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Matches this company exactly. Pair with includeGlobal to see what it inherits.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        description: 'With ptaCompanyId: also return the every-company rows (pta_company_id IS NULL) that this company inherits where it has said nothing. Alone: no effect — the unfiltered list already contains them. Supports true/false/1/0/yes/no/on/off.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateAssignmentQueryDto.prototype, "includeGlobal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        description: 'Only the every-company rows (pta_company_id IS NULL). Supports true/false/1/0/yes/no/on/off.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateAssignmentQueryDto.prototype, "globalOnly", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", String)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaTemplateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: print_template_assignment_constants_1.PTA_OUTPUT_MODES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_assignment_constants_1.PTA_OUTPUT_MODES),
    __metadata("design:type", String)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListPrintTemplateAssignmentQueryDto.prototype, "ptaIsActive", void 0);
//# sourceMappingURL=list-print-template-assignment-query.dto.js.map