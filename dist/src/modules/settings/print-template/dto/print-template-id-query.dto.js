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
exports.DeletePrintTemplateQueryDto = exports.PrintTemplateIdQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class PrintTemplateIdQueryDto {
    ptlId;
    includeDeletedVersions;
}
exports.PrintTemplateIdQueryDto = PrintTemplateIdQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PrintTemplateIdQueryDto.prototype, "ptlId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Boolean,
        default: false,
        description: 'Include revisions that were soft deleted. Off by default; the append-only history is ' +
            'still there when an audit needs it.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], PrintTemplateIdQueryDto.prototype, "includeDeletedVersions", void 0);
class DeletePrintTemplateQueryDto {
    ptlId;
    ptlModifiedBy;
}
exports.DeletePrintTemplateQueryDto = DeletePrintTemplateQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], DeletePrintTemplateQueryDto.prototype, "ptlId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        format: 'uuid',
        nullable: true,
        description: 'Stamped onto ptl_modified_by; falls back to the authenticated user',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], DeletePrintTemplateQueryDto.prototype, "ptlModifiedBy", void 0);
//# sourceMappingURL=print-template-id-query.dto.js.map