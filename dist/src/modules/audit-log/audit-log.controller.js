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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const list_audit_log_query_dto_1 = require("./dto/list-audit-log-query.dto");
const audit_log_response_dto_1 = require("./dto/audit-log-response.dto");
const audit_log_access_service_1 = require("./audit-log-access.service");
const audit_log_service_1 = require("./audit-log.service");
const api_version_1 = require("../../common/constants/api-version");
let AuditLogController = class AuditLogController {
    auditLogService;
    auditLogAccessService;
    constructor(auditLogService, auditLogAccessService) {
        this.auditLogService = auditLogService;
        this.auditLogAccessService = auditLogAccessService;
    }
    async list(queryDto) {
        const scope = await this.auditLogAccessService.resolveReadScope(queryDto);
        const result = await this.auditLogService.list(queryDto, scope);
        return {
            success: true,
            message: 'Audit logs fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
};
exports.AuditLogController = AuditLogController;
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({
        summary: 'List audit logs with search and date filters',
        description: 'Rights (user_menus.um_can_view, no SUPER ADMIN bypass): a History call (screen_id or ' +
            "screen_name + record_pk) needs View on that screen's menu (any one of its menus when it " +
            'has several); the Audit Logs report (no record_pk) needs View on Audit Logs (menu 106) ' +
            "and, when it names a screen, on that screen's menu; across all screens it lists only " +
            'the screens the caller holds View on. A screen no menu shows is read by an ADMIN or ' +
            'SUPER ADMIN only. Refusal: 403 AUDIT_LOG_RIGHT_VIEW (field userId).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: audit_log_response_dto_1.AuditLogSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: audit_log_response_dto_1.AuditLogErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: audit_log_response_dto_1.AuditLogErrorResponseDto,
        description: 'AUDIT_LOG_RIGHT_VIEW — no View right on the screen’s menu / on Audit Logs',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_audit_log_query_dto_1.ListAuditLogQueryDto]),
    __metadata("design:returntype", Promise)
], AuditLogController.prototype, "list", null);
exports.AuditLogController = AuditLogController = __decorate([
    (0, swagger_1.ApiTags)('Audit Logs'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(0),
    (0, common_1.Controller)(['audit-logs', 'audit-log']),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService,
        audit_log_access_service_1.AuditLogAccessService])
], AuditLogController);
//# sourceMappingURL=audit-log.controller.js.map