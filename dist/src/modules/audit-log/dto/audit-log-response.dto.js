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
exports.AuditLogSuccessListDto = exports.AuditLogListMetaDto = exports.AuditLogListItemDto = exports.AuditLogErrorResponseDto = exports.AuditLogErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const module_response_dto_1 = require("../../../common/utils/module-response.dto");
Object.defineProperty(exports, "AuditLogErrorFieldDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorFieldDto; } });
Object.defineProperty(exports, "AuditLogErrorResponseDto", { enumerable: true, get: function () { return module_response_dto_1.ModuleErrorResponseDto; } });
class AuditLogListItemDto {
    log_id;
    log_date;
    log_action;
    log_screen_id;
    screen_name;
    log_table_name;
    log_pk;
    log_display_name;
    log_original_record;
    log_modified_record;
    log_changed_fields;
    log_user_id;
    log_user_name;
    log_branch_id;
    log_branch_name;
    log_notes;
}
exports.AuditLogListItemDto = AuditLogListItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], AuditLogListItemDto.prototype, "log_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-02-20T10:30:00.000Z' }),
    __metadata("design:type", String)
], AuditLogListItemDto.prototype, "log_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'New' }),
    __metadata("design:type", String)
], AuditLogListItemDto.prototype, "log_action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], AuditLogListItemDto.prototype, "log_screen_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item Group Master' }),
    __metadata("design:type", String)
], AuditLogListItemDto.prototype, "screen_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'item_group_master' }),
    __metadata("design:type", String)
], AuditLogListItemDto.prototype, "log_table_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_pk", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_display_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Object }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_original_record", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Object }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_modified_record", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Object }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_changed_fields", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_user_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Admin User' }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_user_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid' }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_branch_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Head Office' }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_branch_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], AuditLogListItemDto.prototype, "log_notes", void 0);
class AuditLogListMetaDto {
    page;
    limit;
    total;
    total_pages;
    next_cursor;
}
exports.AuditLogListMetaDto = AuditLogListMetaDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, nullable: true }),
    __metadata("design:type", Object)
], AuditLogListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], AuditLogListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100, nullable: true }),
    __metadata("design:type", Object)
], AuditLogListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, nullable: true }),
    __metadata("design:type", Object)
], AuditLogListMetaDto.prototype, "total_pages", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'uuid', description: 'Pass as cursor for next page' }),
    __metadata("design:type", Object)
], AuditLogListMetaDto.prototype, "next_cursor", void 0);
class AuditLogSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.AuditLogSuccessListDto = AuditLogSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], AuditLogSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Audit logs fetched successfully' }),
    __metadata("design:type", String)
], AuditLogSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuditLogListItemDto, isArray: true }),
    __metadata("design:type", Array)
], AuditLogSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuditLogListMetaDto }),
    __metadata("design:type", AuditLogListMetaDto)
], AuditLogSuccessListDto.prototype, "meta", void 0);
//# sourceMappingURL=audit-log-response.dto.js.map