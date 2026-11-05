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
exports.RecordPrintDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const print_render_constants_1 = require("../print-render.constants");
const render_preview_dto_1 = require("./render-preview.dto");
class RecordPrintDto extends (0, swagger_1.PickType)(render_preview_dto_1.RenderPreviewDto, [
    'versionId',
    'docId',
    'docIds',
    'companyId',
    'accYear',
    'branchId',
    'deviceId',
]) {
    outputMode;
    pageCount;
    byteCount;
}
exports.RecordPrintDto = RecordPrintDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: print_render_constants_1.RECORDABLE_OUTPUT_MODES,
        description: 'PRINT — sent to a printer. FILE — saved as a PDF. PREVIEW — opened in the popup ' +
            '(Preview / Pdf) and not yet sent anywhere.',
    }),
    (0, class_validator_1.IsIn)(print_render_constants_1.RECORDABLE_OUTPUT_MODES),
    __metadata("design:type", String)
], RecordPrintDto.prototype, "outputMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        description: "The render's page count, from X-Print-Pages. Recorded only for a single document: a " +
            "batch's pages are one number for the whole file.",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordPrintDto.prototype, "pageCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, description: "The render's size in bytes." }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordPrintDto.prototype, "byteCount", void 0);
//# sourceMappingURL=record-print.dto.js.map