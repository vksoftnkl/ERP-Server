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
exports.UserLoginSessionsService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const USER_LOGIN_SESSIONS_TABLE_NAME = 'user login sessions';
const USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME = 'User Login Sessions';
const USER_LOGIN_SESSION_OPTIONAL_FIELDS = [
    'ulsDeviceId',
    'ulsSessionId',
    'ulsSessionToken',
    'ulsRefreshTokenId',
    'ulsLoginOn',
    'ulsLogoutOn',
    'ulsLogoutType',
    'ulsLoginStatus',
    'ulsFailReason',
    'ulsIpAddress',
    'ulsUserAgent',
    'ulsAppVersion',
    'ulsIsActiveSession',
    'ulsIsActive',
];
let UserLoginSessionsService = class UserLoginSessionsService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
    }
    async save(saveUserLoginSessionDto) {
        if (saveUserLoginSessionDto.ulsId) {
            return this.updateSession(saveUserLoginSessionDto);
        }
        return this.createSession(saveUserLoginSessionDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const result = await (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, { tableName: USER_LOGIN_SESSIONS_TABLE_NAME, alias: 'user_login_sessions_grid', search: queryDto.search, page, limit, skip });
        if (!result) {
            (0, module_service_utils_1.throwFixedNotFound)('No configured grid found for user login sessions list', 'list', 'No configured grid found');
        }
        return result;
    }
    async getById(ulsId) {
        const record = await this.prisma.userLoginSession.findFirst({
            where: { ulsId, ulsIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('User login session not found', 'ulsId', `No active user login session found with id ${ulsId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(ulsId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.userLoginSession.findFirst({
                where: { ulsId, ulsIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('User login session not found', 'ulsId', `No active user login session found with id ${ulsId}`);
            }
            const modifiedOn = new Date();
            const logoutOn = existing.ulsLogoutOn ?? modifiedOn;
            const result = await tx.userLoginSession.updateMany({
                where: { ulsId, ulsIsDeleted: false },
                data: {
                    ulsIsDeleted: true,
                    ulsIsActive: false,
                    ulsIsActiveSession: false,
                    ulsLogoutOn: logoutOn,
                    ulsModifiedOn: modifiedOn,
                    ulsModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwFixedNotFound)('User login session not found', 'ulsId', `No active user login session found with id ${ulsId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                ulsIsDeleted: true,
                ulsIsActive: false,
                ulsIsActiveSession: false,
                ulsLogoutOn: logoutOn,
                ulsModifiedOn: modifiedOn,
                ulsModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
                screenName: USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ulsId,
                displayName: existing.ulsSessionId ?? existing.ulsId,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'User login session soft deleted',
            }, tx);
            return { ulsId, deleted: true };
        });
    }
    async createSession(saveUserLoginSessionDto) {
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveUserLoginSessionDto.ulsCreatedBy, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveUserLoginSessionDto.ulsModifiedBy, createdBy);
        const data = {
            ulsCompanyId: saveUserLoginSessionDto.ulsCompanyId,
            ulsBranchId: saveUserLoginSessionDto.ulsBranchId,
            ulsUserId: saveUserLoginSessionDto.ulsUserId,
            ulsCreatedOn: now,
            ulsCreatedBy: createdBy,
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveUserLoginSessionDto, USER_LOGIN_SESSION_OPTIONAL_FIELDS);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const created = await tx.userLoginSession.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
                    screenName: USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.ulsId,
                    displayName: payload.ulsSessionId ?? payload.ulsId,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'User login session created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'User login session already exists', [{ field: 'ulsSessionId', message: 'Duplicate session is not allowed' }]);
            throw error;
        }
    }
    async updateSession(saveUserLoginSessionDto) {
        const ulsId = saveUserLoginSessionDto.ulsId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.userLoginSession.findFirst({
                    where: { ulsId, ulsIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('User login session not found', 'ulsId', `No active user login session found with id ${ulsId}`);
                }
                const data = {
                    ulsCompanyId: saveUserLoginSessionDto.ulsCompanyId,
                    ulsBranchId: saveUserLoginSessionDto.ulsBranchId,
                    ulsUserId: saveUserLoginSessionDto.ulsUserId,
                    ulsModifiedOn: new Date(),
                    ulsModifiedBy: (0, module_service_utils_1.resolveActor)(saveUserLoginSessionDto.ulsModifiedBy, this.requestContextService.getUserId()),
                };
                (0, module_service_utils_1.applyPresentFields)(data, saveUserLoginSessionDto, USER_LOGIN_SESSION_OPTIONAL_FIELDS);
                const updated = await tx.userLoginSession.update({ where: { ulsId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: USER_LOGIN_SESSIONS_TABLE_NAME,
                    screenName: USER_LOGIN_SESSIONS_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ulsId,
                    displayName: payload.ulsSessionId ?? payload.ulsId,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: (0, module_service_utils_1.resolveActor)(saveUserLoginSessionDto.ulsModifiedBy, this.requestContextService.getUserId()),
                    notes: 'User login session updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'User login session already exists', [{ field: 'ulsSessionId', message: 'Duplicate session is not allowed' }]);
            throw error;
        }
    }
    toPayload(record) {
        return {
            ulsId: record.ulsId,
            ulsCompanyId: record.ulsCompanyId,
            ulsBranchId: record.ulsBranchId,
            ulsUserId: record.ulsUserId,
            ulsDeviceId: record.ulsDeviceId,
            ulsSessionId: record.ulsSessionId,
            ulsSessionToken: record.ulsSessionToken,
            ulsRefreshTokenId: record.ulsRefreshTokenId,
            ulsLoginOn: record.ulsLoginOn.toISOString(),
            ulsLogoutOn: record.ulsLogoutOn ? record.ulsLogoutOn.toISOString() : null,
            ulsLogoutType: record.ulsLogoutType,
            ulsLoginStatus: record.ulsLoginStatus,
            ulsFailReason: record.ulsFailReason,
            ulsIpAddress: record.ulsIpAddress,
            ulsUserAgent: record.ulsUserAgent,
            ulsAppVersion: record.ulsAppVersion,
            ulsIsActiveSession: record.ulsIsActiveSession,
            ulsIsActive: record.ulsIsActive,
            ulsIsDeleted: record.ulsIsDeleted,
            ulsSyncDate: record.ulsSyncDate ? record.ulsSyncDate.toISOString() : null,
            ulsCreatedOn: record.ulsCreatedOn.toISOString(),
            ulsCreatedBy: record.ulsCreatedBy,
            ulsModifiedOn: record.ulsModifiedOn.toISOString(),
            ulsModifiedBy: record.ulsModifiedBy,
        };
    }
};
exports.UserLoginSessionsService = UserLoginSessionsService;
exports.UserLoginSessionsService = UserLoginSessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], UserLoginSessionsService);
//# sourceMappingURL=user-login-sessions.service.js.map