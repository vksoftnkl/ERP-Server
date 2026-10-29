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
exports.SaveAppThemeTemplateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveAppThemeTemplateDto {
    tplId;
    tplQss;
    tplRemarks;
    tplModifiedOn;
}
exports.SaveAppThemeTemplateDto = SaveAppThemeTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'The template being edited (GET /app-themes/template).' }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], SaveAppThemeTemplateDto.prototype, "tplId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The QSS, with {{key}} placeholders: every key a token (APP_THEME_TOKEN_KEYS) or ' +
            'size.font / size.icon / size.header; braces balanced; url() only to :/ resources; at ' +
            'most 512 KB. Each fault is a 400 on tplQss.',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAppThemeTemplateDto.prototype, "tplQss", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveAppThemeTemplateDto.prototype, "tplRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-01T08:00:00.000Z',
        description: 'tplModifiedOn as the editor loaded it; a different value on the row is a 409.',
    }),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], SaveAppThemeTemplateDto.prototype, "tplModifiedOn", void 0);
//# sourceMappingURL=save-app-theme-template.dto.js.map