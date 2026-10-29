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
exports.PrintTemplateAssignmentSuccessDeleteDto = exports.PrintTemplateAssignmentSuccessResolveDto = exports.PrintTemplateAssignmentSuccessListDto = exports.PrintTemplateAssignmentSuccessCreateDto = exports.PrintTemplateAssignmentSuccessSingleDto = exports.PrintTemplateAssignmentListDataDto = exports.PrintTemplateAssignmentDeleteResultDto = exports.PrintTemplateAssignmentResolutionDto = exports.PrintTemplateAssignmentPayloadDto = exports.PrintTemplateAssignmentErrorResponseDto = exports.PrintTemplateAssignmentErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../../common/utils/module-response.dto");
Object.defineProperty(exports, "PrintTemplateAssignmentErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorFieldDto; } });
Object.defineProperty(exports, "PrintTemplateAssignmentErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorResponseDto; } });
const print_template_assignment_constants_1 = require("../print-template-assignment.constants");
const PTA_SCOPES = ['GLOBAL', 'COMPANY', 'BRANCH', 'COUNTER'];
class PrintTemplateAssignmentPayloadDto {
    ptaId;
    ptaCompanyId;
    ptaCompanyName;
    ptaBranchId;
    ptaBranchName;
    ptaDeviceId;
    ptaDeviceName;
    ptaPurposeId;
    ptaPurposeCode;
    ptaPurposeName;
    ptaTemplateId;
    ptaTemplateCode;
    ptaTemplateName;
    ptaTemplateCompanyKey;
    ptaTemplateIsShipped;
    ptaOutputMode;
    ptaPrinterId;
    ptaPrinterName;
    ptaPrinterProfileName;
    ptaCopies;
    ptaSpecificity;
    ptaScope;
    ptaRemarks;
    ptaIsActive;
    ptaIsDeleted;
    ptaSyncDate;
    ptaCreatedOn;
    ptaCreatedBy;
    ptaModifiedOn;
    ptaModifiedBy;
}
exports.PrintTemplateAssignmentPayloadDto = PrintTemplateAssignmentPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = every company — the widest rung, and shipped designs only',
    }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Acme Pvt Ltd' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'NULL = every branch' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Main Branch' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'NULL = every counter' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Counter 1' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaDeviceName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaPurposeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'SALE_INVOICE' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaPurposeCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Tax Invoice' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaPurposeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaTemplateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'A4-TAX-INVOICE' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaTemplateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'A4 Tax Invoice' }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaTemplateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        example: print_template_assignment_constants_1.PTA_SHIPPED_TEMPLATE_KEY,
        description: "The template's owner, the nil uuid meaning shipped with the product. Derived from the template, never accepted from the caller.",
    }),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaTemplateCompanyKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'ptaTemplateCompanyKey is the nil uuid' }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaTemplateIsShipped", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_assignment_constants_1.PTA_OUTPUT_MODES, example: 'PRINT' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaPrinterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 150,
        example: 'HP-LaserJet-Front',
        description: 'The bare queue name column — a fallback for a scope with no registered profile. Never set alongside ptaPrinterId.',
    }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaPrinterName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'Counter 1 laser',
        description: "The registered profile's name, joined. NULL whenever ptaPrinterId is NULL.",
    }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaPrinterProfileName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 2 }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaCopies", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 3,
        description: 'Derived in the database, never written: 3 counter, 2 branch, 1 company, 0 every company',
    }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaSpecificity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: PTA_SCOPES, example: 'COUNTER', description: 'ptaSpecificity as a word' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentPayloadDto.prototype, "ptaModifiedBy", void 0);
class PrintTemplateAssignmentResolutionDto {
    ptaId;
    ptaSpecificity;
    scope;
    ptaTemplateId;
    ptaTemplateCode;
    ptaTemplateName;
    ptaTemplateIsShipped;
    publishedRevId;
    ptaPrinterId;
    ptaPrinterName;
    printerSource;
    ptaOutputMode;
    copies;
    copyLabels;
}
exports.PrintTemplateAssignmentResolutionDto = PrintTemplateAssignmentResolutionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 3 }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaSpecificity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: PTA_SCOPES, example: 'COUNTER' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentResolutionDto.prototype, "scope", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaTemplateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaTemplateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaTemplateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'The winning design ships with the product' }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaTemplateIsShipped", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL means the template has no published revision and cannot render',
    }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentResolutionDto.prototype, "publishedRevId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaPrinterId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: "One name for the render path: the registered profile's when ptaPrinterId is set, the bare fallback otherwise, NULL when the server's default queue applies.",
    }),
    __metadata("design:type", Object)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaPrinterName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: print_template_assignment_constants_1.PTA_PRINTER_SOURCES,
        example: 'PROFILE',
        description: 'PROFILE — paper, codepage and columns are known and can be asserted. NAME — a bare queue, so none of that is known. DEFAULT — the counter default.',
    }),
    __metadata("design:type", String)
], PrintTemplateAssignmentResolutionDto.prototype, "printerSource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: print_template_assignment_constants_1.PTA_OUTPUT_MODES }),
    __metadata("design:type", String)
], PrintTemplateAssignmentResolutionDto.prototype, "ptaOutputMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3, description: 'Assignment override, else the purpose count' }),
    __metadata("design:type", Number)
], PrintTemplateAssignmentResolutionDto.prototype, "copies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'], type: [String] }),
    __metadata("design:type", Array)
], PrintTemplateAssignmentResolutionDto.prototype, "copyLabels", void 0);
class PrintTemplateAssignmentDeleteResultDto {
    ptaId;
    deleted;
}
exports.PrintTemplateAssignmentDeleteResultDto = PrintTemplateAssignmentDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentDeleteResultDto.prototype, "ptaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentDeleteResultDto.prototype, "deleted", void 0);
class PrintTemplateAssignmentListDataDto {
    items;
    page;
    limit;
    total;
}
exports.PrintTemplateAssignmentListDataDto = PrintTemplateAssignmentListDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PrintTemplateAssignmentPayloadDto] }),
    __metadata("design:type", Array)
], PrintTemplateAssignmentListDataDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PrintTemplateAssignmentListDataDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], PrintTemplateAssignmentListDataDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PrintTemplateAssignmentListDataDto.prototype, "total", void 0);
class PrintTemplateAssignmentSuccessSingleDto {
    success;
    message;
    data;
}
exports.PrintTemplateAssignmentSuccessSingleDto = PrintTemplateAssignmentSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template assignment fetched successfully' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateAssignmentPayloadDto }),
    __metadata("design:type", PrintTemplateAssignmentPayloadDto)
], PrintTemplateAssignmentSuccessSingleDto.prototype, "data", void 0);
class PrintTemplateAssignmentSuccessCreateDto {
    success;
    message;
    data;
}
exports.PrintTemplateAssignmentSuccessCreateDto = PrintTemplateAssignmentSuccessCreateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentSuccessCreateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template assignment created successfully' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentSuccessCreateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateAssignmentPayloadDto }),
    __metadata("design:type", PrintTemplateAssignmentPayloadDto)
], PrintTemplateAssignmentSuccessCreateDto.prototype, "data", void 0);
class PrintTemplateAssignmentSuccessListDto {
    success;
    message;
    data;
}
exports.PrintTemplateAssignmentSuccessListDto = PrintTemplateAssignmentSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template assignments fetched successfully' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateAssignmentListDataDto }),
    __metadata("design:type", PrintTemplateAssignmentListDataDto)
], PrintTemplateAssignmentSuccessListDto.prototype, "data", void 0);
class PrintTemplateAssignmentSuccessResolveDto {
    success;
    message;
    data;
}
exports.PrintTemplateAssignmentSuccessResolveDto = PrintTemplateAssignmentSuccessResolveDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentSuccessResolveDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template resolved successfully' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentSuccessResolveDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateAssignmentResolutionDto }),
    __metadata("design:type", PrintTemplateAssignmentResolutionDto)
], PrintTemplateAssignmentSuccessResolveDto.prototype, "data", void 0);
class PrintTemplateAssignmentSuccessDeleteDto {
    success;
    message;
    data;
}
exports.PrintTemplateAssignmentSuccessDeleteDto = PrintTemplateAssignmentSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PrintTemplateAssignmentSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Print template assignment deleted successfully' }),
    __metadata("design:type", String)
], PrintTemplateAssignmentSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PrintTemplateAssignmentDeleteResultDto }),
    __metadata("design:type", PrintTemplateAssignmentDeleteResultDto)
], PrintTemplateAssignmentSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=print-template-assignment-response.dto.js.map