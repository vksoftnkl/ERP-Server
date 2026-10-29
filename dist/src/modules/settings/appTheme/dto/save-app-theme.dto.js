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
exports.SaveAppThemeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const app_theme_types_1 = require("../types/app-theme.types");
class SaveAppThemeDto {
    thmId;
    thmName;
    thmBase;
    thmIsDefault;
    thmIsActive;
    thmRemarks;
    tokens;
}
exports.SaveAppThemeDto = SaveAppThemeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Absent = create (the id comes from the sequence).' }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveAppThemeDto.prototype, "thmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 100,
        example: 'MAROON',
        description: 'Unique among live themes, case-insensitively (409 on a clash).',
    }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveAppThemeDto.prototype, "thmName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: app_theme_types_1.APP_THEME_BASES, example: 'LIGHT', description: 'DARK is reserved.' }),
    (0, class_validator_1.IsIn)(app_theme_types_1.APP_THEME_BASES, { message: `thmBase must be one of: ${app_theme_types_1.APP_THEME_BASES.join(', ')}` }),
    __metadata("design:type", Object)
], SaveAppThemeDto.prototype, "thmBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'true makes this THE default (the previous default loses the flag in the same ' +
            'transaction). The default cannot be un-set, deactivated or deleted — make another ' +
            'theme the default instead.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAppThemeDto.prototype, "thmIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveAppThemeDto.prototype, "thmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], SaveAppThemeDto.prototype, "thmRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: 'object',
        additionalProperties: { type: 'string', example: '#7B1113' },
        example: { primary: '#7B1113', 'table.selected': '#0078D7' },
        description: `A flat { key: colour } object. Keys: ${Object.keys(app_theme_types_1.APP_THEME_TOKENS).join(', ')}. ` +
            'Every value #rrggbb or #rrggbbaa. A key may be omitted (the client default applies), ' +
            'never null. Replaces the stored object.',
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveAppThemeDto.prototype, "tokens", void 0);
//# sourceMappingURL=save-app-theme.dto.js.map