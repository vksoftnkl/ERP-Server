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
exports.ListAuditLogQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const module_list_query_base_dto_1 = require("../../../common/utils/module-list-query.base.dto");
class ListAuditLogQueryDto extends module_list_query_base_dto_1.ModuleListQueryBaseDto {
    action;
    screen_id;
    screen_name;
    record_pk;
    date_from;
    date_to;
    cursor;
    include_total;
}
exports.ListAuditLogQueryDto = ListAuditLogQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Supports New/insert/update/approve/cancel',
        maxLength: 20,
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(20),
    __metadata("design:type", String)
], ListAuditLogQueryDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by audit screen id', minimum: 1 }),
    (0, dtoDecorators_1.OptionalQueryInt)(1),
    __metadata("design:type", Number)
], ListAuditLogQueryDto.prototype, "screen_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by exact audit screen name', maxLength: 200 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(200),
    __metadata("design:type", String)
], ListAuditLogQueryDto.prototype, "screen_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by exact audit primary key value', maxLength: 200 }),
    (0, dtoDecorators_1.OptionalTrimmedString)(200),
    __metadata("design:type", String)
], ListAuditLogQueryDto.prototype, "record_pk", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Start date/time (ISO). Date-only (YYYY-MM-DD) is accepted.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListAuditLogQueryDto.prototype, "date_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'End date/time (ISO). Date-only (YYYY-MM-DD) is accepted.',
    }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", String)
], ListAuditLogQueryDto.prototype, "date_to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'UUID v7 cursor from previous page next_cursor. Skips page/total when provided.',
        format: 'uuid',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ListAuditLogQueryDto.prototype, "cursor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Set to true to include total count. Omit to skip the COUNT(*) query.',
    }),
    (0, dtoDecorators_1.OptionalQueryBoolean)(),
    __metadata("design:type", Boolean)
], ListAuditLogQueryDto.prototype, "include_total", void 0);
//# sourceMappingURL=list-audit-log-query.dto.js.map