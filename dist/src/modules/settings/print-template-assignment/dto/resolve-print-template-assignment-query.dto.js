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
exports.ResolvePrintTemplateAssignmentQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const print_template_assignment_constants_1 = require("../print-template-assignment.constants");
class ResolvePrintTemplateAssignmentQueryDto {
    companyId;
    branchId;
    deviceId;
    purposeId;
    outputMode;
}
exports.ResolvePrintTemplateAssignmentQueryDto = ResolvePrintTemplateAssignmentQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The company printing. Its own rows outrank the every-company rows, which are what it falls back to where it has said nothing.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ResolvePrintTemplateAssignmentQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ResolvePrintTemplateAssignmentQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ResolvePrintTemplateAssignmentQueryDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ResolvePrintTemplateAssignmentQueryDto.prototype, "purposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: print_template_assignment_constants_1.PTA_OUTPUT_MODES, default: 'PRINT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_assignment_constants_1.PTA_OUTPUT_MODES),
    __metadata("design:type", String)
], ResolvePrintTemplateAssignmentQueryDto.prototype, "outputMode", void 0);
//# sourceMappingURL=resolve-print-template-assignment-query.dto.js.map