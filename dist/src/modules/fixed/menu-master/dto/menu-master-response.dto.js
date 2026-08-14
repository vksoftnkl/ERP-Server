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
exports.MenuMasterSuccessUpdateVisibilityDto = exports.MenuMasterUpdateVisibilityDataDto = exports.MenuMasterSuccessGetDto = exports.MenuMasterGetMetaDto = exports.MenuMasterPayloadDto = exports.MenuMasterUserPermissionsDto = exports.MenuMasterErrorResponseDto = exports.MenuMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class MenuMasterErrorFieldDto {
    field;
    message;
}
exports.MenuMasterErrorFieldDto = MenuMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MenuMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MenuMasterErrorFieldDto.prototype, "message", void 0);
class MenuMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.MenuMasterErrorResponseDto = MenuMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], MenuMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MenuMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], MenuMasterErrorResponseDto.prototype, "errors", void 0);
class MenuMasterUserPermissionsDto {
    canCreate;
    canEdit;
    canDelete;
    canPrint;
    canExport;
    isVisible;
    isFavourite;
    isPinned;
    sortOrder;
}
exports.MenuMasterUserPermissionsDto = MenuMasterUserPermissionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "canCreate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "canEdit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "canDelete", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "canPrint", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "canExport", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "isVisible", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "isFavourite", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterUserPermissionsDto.prototype, "isPinned", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], MenuMasterUserPermissionsDto.prototype, "sortOrder", void 0);
class MenuMasterPayloadDto {
    menuId;
    menuParentId;
    menuName;
    menuAlias;
    menuVisibility;
    menuPosition;
    menuIconLocationDesktop;
    menuIconLocationWeb;
    menuIconLocationMobile;
    menuSeparator;
    menuIsActive;
    permissions;
    children;
}
exports.MenuMasterPayloadDto = MenuMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], MenuMasterPayloadDto.prototype, "menuId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "menuParentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '&1 Sales' }),
    __metadata("design:type", String)
], MenuMasterPayloadDto.prototype, "menuName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'CTRL+S', nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "menuAlias", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MenuMasterPayloadDto.prototype, "menuVisibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1.00', nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "menuPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "menuIconLocationDesktop", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "menuIconLocationWeb", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "menuIconLocationMobile", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterPayloadDto.prototype, "menuSeparator", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MenuMasterPayloadDto.prototype, "menuIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: MenuMasterUserPermissionsDto, nullable: true }),
    __metadata("design:type", Object)
], MenuMasterPayloadDto.prototype, "permissions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => [MenuMasterPayloadDto] }),
    __metadata("design:type", Array)
], MenuMasterPayloadDto.prototype, "children", void 0);
class MenuMasterGetMetaDto {
    visibleOnly;
    count;
}
exports.MenuMasterGetMetaDto = MenuMasterGetMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], MenuMasterGetMetaDto.prototype, "visibleOnly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9 }),
    __metadata("design:type", Number)
], MenuMasterGetMetaDto.prototype, "count", void 0);
class MenuMasterSuccessGetDto {
    success;
    message;
    data;
    meta;
}
exports.MenuMasterSuccessGetDto = MenuMasterSuccessGetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MenuMasterSuccessGetDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Menus fetched successfully' }),
    __metadata("design:type", String)
], MenuMasterSuccessGetDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MenuMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], MenuMasterSuccessGetDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MenuMasterGetMetaDto }),
    __metadata("design:type", MenuMasterGetMetaDto)
], MenuMasterSuccessGetDto.prototype, "meta", void 0);
class MenuMasterUpdateVisibilityDataDto {
    menuId;
    menuVisibility;
}
exports.MenuMasterUpdateVisibilityDataDto = MenuMasterUpdateVisibilityDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], MenuMasterUpdateVisibilityDataDto.prototype, "menuId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MenuMasterUpdateVisibilityDataDto.prototype, "menuVisibility", void 0);
class MenuMasterSuccessUpdateVisibilityDto {
    success;
    message;
    data;
}
exports.MenuMasterSuccessUpdateVisibilityDto = MenuMasterSuccessUpdateVisibilityDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MenuMasterSuccessUpdateVisibilityDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Menu visibility updated successfully' }),
    __metadata("design:type", String)
], MenuMasterSuccessUpdateVisibilityDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MenuMasterUpdateVisibilityDataDto] }),
    __metadata("design:type", Array)
], MenuMasterSuccessUpdateVisibilityDto.prototype, "data", void 0);
//# sourceMappingURL=menu-master-response.dto.js.map