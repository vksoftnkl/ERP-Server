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
exports.SavePrintTemplateAssignmentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const class_validator_1 = require("class-validator");
const print_template_assignment_constants_1 = require("../print-template-assignment.constants");
class SavePrintTemplateAssignmentDto {
    ptaId;
    ptaCompanyId;
    ptaBranchId;
    ptaDeviceId;
    ptaPurposeId;
    ptaTemplateId;
    ptaOutputMode;
    ptaPrinterId;
    ptaPrinterName;
    ptaCopies;
    ptaRemarks;
    ptaIsActive;
    ptaCreatedBy;
    ptaModifiedBy;
}
exports.SavePrintTemplateAssignmentDto = SavePrintTemplateAssignmentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, the request updates the existing assignment',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateAssignmentDto.prototype, "ptaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = EVERY COMPANY, the widest rung of the ladder. A global assignment may only name a shipped design. On create the field must be PRESENT — send null deliberately; omitting it is rejected, because "every company" is not something to arrive at by accident.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = every branch. Required when ptaDeviceId is given.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = every counter. A counter row must also name its branch.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateAssignmentDto.prototype, "ptaPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SavePrintTemplateAssignmentDto.prototype, "ptaTemplateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: print_template_assignment_constants_1.PTA_OUTPUT_MODES, default: 'PRINT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(print_template_assignment_constants_1.PTA_OUTPUT_MODES),
    __metadata("design:type", String)
], SavePrintTemplateAssignmentDto.prototype, "ptaOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: "A registered printer profile. NULL = the server's default queue for the device. Cannot be combined with ptaPrinterName.",
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaPrinterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 150,
        nullable: true,
        description: 'A bare queue or share name, for a scope whose printer nobody has registered as a profile. A FALLBACK, never a copy of a profile name — a render through it asserts nothing about paper, codepage or column count. Cannot be combined with ptaPrinterId.',
    }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaPrinterName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        minimum: 1,
        maximum: 9,
        description: "Overrides the purpose's copy count for this scope. NULL = use it.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.OptionalInteger)(1, 9),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaCopies", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SavePrintTemplateAssignmentDto.prototype, "ptaIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SavePrintTemplateAssignmentDto.prototype, "ptaModifiedBy", void 0);
//# sourceMappingURL=save-print-template-assignment.dto.js.map