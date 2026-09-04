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
exports.SaveUserAdministrationDto = exports.SaveUserMenuDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const user_administration_enum_1 = require("../types/user-administration.enum");
class SaveUserMenuDto {
    umMenuId;
    umCanView;
    umCanCreate;
    umCanEdit;
    umCanDelete;
    umCanPrint;
    umCanExport;
    umVisibility;
    umIsFavourite;
    umIsPinned;
    umSortOrder;
}
exports.SaveUserMenuDto = SaveUserMenuDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Menu ID (integer PK from menu_master)' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SaveUserMenuDto.prototype, "umMenuId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umCanView", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umCanCreate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umCanEdit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umCanDelete", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umCanPrint", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umCanExport", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umVisibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umIsFavourite", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserMenuDto.prototype, "umIsPinned", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(0),
    __metadata("design:type", Number)
], SaveUserMenuDto.prototype, "umSortOrder", void 0);
class SaveUserAdministrationDto {
    usrId;
    usrCompanyId;
    usrBranchId;
    usrEmployeeId;
    usrLoginName;
    usrDisplayName;
    usrFullName;
    usrMobileNo;
    usrEmail;
    usrAvatarUrl;
    usrTimezone;
    usrLanguage;
    usrPassword;
    usrMustChangePassword;
    usrType;
    usrEditDate;
    usrEditEntry;
    usrEditRate;
    usrDesktopLogin;
    usrWebLogin;
    usrMobileLogin;
    usrIsActive;
    usrNotes;
    menus;
}
exports.SaveUserAdministrationDto = SaveUserAdministrationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, request updates the existing user',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], SaveUserAdministrationDto.prototype, "usrId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrEmployeeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveUserAdministrationDto.prototype, "usrLoginName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrDisplayName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrFullName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrMobileNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableEmail)(150),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrAvatarUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, default: 'UTC' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SaveUserAdministrationDto.prototype, "usrTimezone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, default: 'en' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], SaveUserAdministrationDto.prototype, "usrLanguage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Plain-text password. Required on create; optional on update (omit to keep existing).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveUserAdministrationDto.prototype, "usrPassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrMustChangePassword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: user_administration_enum_1.UserType, enumName: 'UserType', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === '' || value === undefined ? undefined : value === null ? null : value),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== undefined),
    (0, class_validator_1.IsEnum)(user_administration_enum_1.UserType),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrEditDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrEditEntry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrEditRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrDesktopLogin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrWebLogin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrMobileLogin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveUserAdministrationDto.prototype, "usrIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableString)(),
    __metadata("design:type", Object)
], SaveUserAdministrationDto.prototype, "usrNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: SaveUserMenuDto,
        isArray: true,
        description: 'Full replacement set of menu permissions. Existing menus not in this list are soft-deleted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaveUserMenuDto),
    __metadata("design:type", Array)
], SaveUserAdministrationDto.prototype, "menus", void 0);
//# sourceMappingURL=save-user-administration.dto.js.map