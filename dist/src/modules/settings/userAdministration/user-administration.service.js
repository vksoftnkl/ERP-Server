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
exports.UserAdministrationService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const user_administration_enum_1 = require("./types/user-administration.enum");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const USER_MASTER_TABLE_NAME = 'user_master';
const USER_ADMIN_AUDIT_SCREEN_NAME = 'User Administration';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.scrypt);
let UserAdministrationService = class UserAdministrationService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(dto) {
        if (dto.usrId) {
            return this.updateUser(dto);
        }
        return this.createUser(dto);
    }
    async getById(usrId) {
        const record = await this.prisma.userMaster.findFirst({
            where: { usrId, usrIsDeleted: false },
            include: {
                userMenus: {
                    where: { umIsDeleted: false },
                    orderBy: { umMenuId: 'asc' },
                },
            },
        });
        if (!record) {
            this.throwNotFound(usrId);
        }
        const payload = this.toPayload(record, record.userMenus);
        const relatedNames = await this.resolveRelatedNames(this.prisma, record);
        return { ...payload, ...relatedNames };
    }
    async resolveRelatedNames(client, record) {
        const [company, branch] = await Promise.all([
            record.usrCompanyId
                ? client.company.findFirst({
                    where: { compId: record.usrCompanyId },
                    select: { compName: true },
                })
                : null,
            record.usrBranchId
                ? client.branchMaster.findFirst({
                    where: { brId: record.usrBranchId },
                    select: { brName: true },
                })
                : null,
        ]);
        return {
            usrCompanyName: company?.compName ?? null,
            usrBranchName: branch?.brName ?? null,
        };
    }
    async softDelete(usrId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.userMaster.findFirst({
                where: { usrId, usrIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(usrId);
            }
            const now = new Date();
            await Promise.all([
                tx.userMaster.updateMany({
                    where: { usrId, usrIsDeleted: false },
                    data: {
                        usrIsDeleted: true,
                        usrIsActive: false,
                        usrModifiedOn: now,
                        usrModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    },
                }),
                tx.userMenus.updateMany({
                    where: { umUserId: usrId, umIsDeleted: false },
                    data: {
                        umIsDeleted: true,
                        umModifiedOn: now,
                        umModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    },
                }),
            ]);
            const originalPayload = this.toPayloadWithoutMenus(existing);
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: USER_MASTER_TABLE_NAME,
                screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: usrId,
                displayName: existing.usrDisplayName,
                originalRecord: originalPayload,
                modifiedRecord: { ...originalPayload, usrIsDeleted: true, usrIsActive: false },
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'User soft deleted along with all menu assignments',
            }, tx);
            return { usrId, deleted: true };
        });
    }
    async createUser(dto) {
        if (!dto.usrPassword?.trim()) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
                { field: 'usrPassword', message: 'usrPassword is required when creating a new user' },
            ]);
        }
        try {
            return this.prisma.$transaction(async (tx) => {
                await this.ensureLoginNameUnique(dto.usrLoginName, undefined, tx);
                const now = new Date();
                const passwordHash = await this.hashPassword(dto.usrPassword);
                const data = {
                    usrLoginName: dto.usrLoginName.trim(),
                    usrDisplayName: dto.usrDisplayName?.trim() ?? '',
                    usrPasswordHash: passwordHash,
                    usrCreatedOn: now,
                    usrCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalUserFields(data, dto);
                const created = await tx.userMaster.create({ data });
                const menus = await this.replaceUserMenus(created.usrId, dto.menus ?? [], this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR, now, tx);
                const payload = this.toPayload(created, menus);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: USER_MASTER_TABLE_NAME,
                    screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: created.usrId,
                    displayName: created.usrDisplayName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'User created with menu assignments',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateUser(dto) {
        const usrId = dto.usrId;
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.userMaster.findFirst({
                    where: { usrId, usrIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound(usrId);
                }
                await this.ensureLoginNameUnique(dto.usrLoginName, usrId, tx);
                const now = new Date();
                const data = {
                    usrLoginName: dto.usrLoginName.trim(),
                    usrModifiedOn: now,
                    usrModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if (dto.usrPassword?.trim()) {
                    data.usrPasswordHash = await this.hashPassword(dto.usrPassword.trim());
                    data.usrPasswordChangedOn = now;
                    data.usrMustChangePassword = false;
                }
                this.applyOptionalUserFields(data, dto);
                const updated = await tx.userMaster.update({ where: { usrId }, data });
                const menus = dto.menus !== undefined
                    ? await this.replaceUserMenus(usrId, dto.menus, this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR, now, tx)
                    : await tx.userMenus.findMany({
                        where: { umUserId: usrId, umIsDeleted: false },
                        orderBy: { umMenuId: 'asc' },
                    });
                const payload = this.toPayload(updated, menus);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: USER_MASTER_TABLE_NAME,
                    screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: usrId,
                    displayName: updated.usrDisplayName,
                    originalRecord: this.toPayloadWithoutMenus(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'User updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async replaceUserMenus(usrId, menus, actor, now, tx) {
        await tx.userMenus.updateMany({
            where: { umUserId: usrId, umIsDeleted: false },
            data: { umIsDeleted: true, umModifiedOn: now, umModifiedBy: actor },
        });
        if (menus.length === 0) {
            return [];
        }
        const menuIds = [...new Set(menus.map((m) => m.umMenuId))];
        const existingMenus = await tx.menu.findMany({
            where: { menuId: { in: menuIds }, menuIsActive: true },
            select: { menuId: true },
        });
        const validMenuIds = new Set(existingMenus.map((m) => m.menuId));
        const invalidIds = menuIds.filter((id) => !validMenuIds.has(id));
        if (invalidIds.length > 0) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid menu reference', [
                { field: 'menus', message: `Menu IDs not found or inactive: ${invalidIds.join(', ')}` },
            ]);
        }
        const created = await Promise.all(menus.map((m) => tx.userMenus.upsert({
            where: { uq_user_menus_user_menu: { umUserId: usrId, umMenuId: m.umMenuId } },
            create: {
                umUserId: usrId,
                umMenuId: m.umMenuId,
                umCanView: m.umCanView ?? true,
                umCanCreate: m.umCanCreate ?? false,
                umCanEdit: m.umCanEdit ?? false,
                umCanDelete: m.umCanDelete ?? false,
                umCanPrint: m.umCanPrint ?? false,
                umCanExport: m.umCanExport ?? false,
                umVisibility: m.umVisibility ?? true,
                umIsFavourite: m.umIsFavourite ?? false,
                umIsPinned: m.umIsPinned ?? false,
                umSortOrder: m.umSortOrder ?? 0,
                umCreatedOn: now,
                umCreatedBy: actor,
            },
            update: {
                umCanView: m.umCanView ?? true,
                umCanCreate: m.umCanCreate ?? false,
                umCanEdit: m.umCanEdit ?? false,
                umCanDelete: m.umCanDelete ?? false,
                umCanPrint: m.umCanPrint ?? false,
                umCanExport: m.umCanExport ?? false,
                umVisibility: m.umVisibility ?? true,
                umIsFavourite: m.umIsFavourite ?? false,
                umIsPinned: m.umIsPinned ?? false,
                umSortOrder: m.umSortOrder ?? 0,
                umIsDeleted: false,
                umModifiedOn: now,
                umModifiedBy: actor,
            },
        })));
        return created.sort((a, b) => a.umMenuId - b.umMenuId);
    }
    async ensureLoginNameUnique(loginName, excludeUsrId, tx) {
        const existing = await tx.userMaster.findFirst({
            where: {
                usrLoginName: { equals: loginName.trim(), mode: 'insensitive' },
                usrIsDeleted: false,
                ...(excludeUsrId ? { NOT: { usrId: excludeUsrId } } : {}),
            },
            select: { usrId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
                { field: 'usrLoginName', message: `Login name '${loginName}' is already taken` },
            ]);
        }
    }
    applyOptionalUserFields(data, dto) {
        if (dto.usrCompanyId !== undefined)
            data.usrCompanyId = dto.usrCompanyId;
        if (dto.usrBranchId !== undefined)
            data.usrBranchId = dto.usrBranchId;
        if (dto.usrEmployeeId !== undefined)
            data.usrEmployeeId = dto.usrEmployeeId;
        if (dto.usrDisplayName !== undefined)
            data.usrDisplayName = dto.usrDisplayName?.trim() ?? '';
        if (dto.usrFullName !== undefined)
            data.usrFullName = dto.usrFullName;
        if (dto.usrMobileNo !== undefined)
            data.usrMobileNo = dto.usrMobileNo;
        if (dto.usrEmail !== undefined)
            data.usrEmail = dto.usrEmail;
        if (dto.usrAvatarUrl !== undefined)
            data.usrAvatarUrl = dto.usrAvatarUrl;
        if (dto.usrTimezone !== undefined)
            data.usrTimezone = dto.usrTimezone;
        if (dto.usrLanguage !== undefined)
            data.usrLanguage = dto.usrLanguage;
        if (dto.usrMustChangePassword !== undefined)
            data.usrMustChangePassword = dto.usrMustChangePassword;
        if (dto.usrType !== undefined)
            data.usrType = dto.usrType;
        if (dto.usrEditDate !== undefined)
            data.usrEditDate = dto.usrEditDate;
        if (dto.usrEditEntry !== undefined)
            data.usrEditEntry = dto.usrEditEntry;
        if (dto.usrEditRate !== undefined)
            data.usrEditRate = dto.usrEditRate;
        if (dto.usrDesktopLogin !== undefined)
            data.usrDesktopLogin = dto.usrDesktopLogin;
        if (dto.usrWebLogin !== undefined)
            data.usrWebLogin = dto.usrWebLogin;
        if (dto.usrMobileLogin !== undefined)
            data.usrMobileLogin = dto.usrMobileLogin;
        if (dto.usrIsActive !== undefined)
            data.usrIsActive = dto.usrIsActive;
        if (dto.usrNotes !== undefined)
            data.usrNotes = dto.usrNotes;
    }
    async hashPassword(plain) {
        const salt = (0, node_crypto_1.randomBytes)(PASSWORD_SALT_BYTES).toString('hex');
        const derived = (await scryptAsync(plain, salt, PASSWORD_KEY_LENGTH));
        return `scrypt$${salt}$${derived.toString('hex')}`;
    }
    toPayload(record, menus) {
        return {
            ...this.toPayloadWithoutMenus(record),
            menus: menus.map((m) => this.toMenuPayload(m)),
        };
    }
    toPayloadWithoutMenus(record) {
        return {
            usrId: record.usrId,
            usrCompanyId: record.usrCompanyId,
            usrBranchId: record.usrBranchId,
            usrEmployeeId: record.usrEmployeeId,
            usrLoginName: record.usrLoginName,
            usrDisplayName: record.usrDisplayName,
            usrFullName: record.usrFullName,
            usrMobileNo: record.usrMobileNo,
            usrEmail: record.usrEmail,
            usrAvatarUrl: record.usrAvatarUrl,
            usrTimezone: record.usrTimezone,
            usrLanguage: record.usrLanguage,
            usrMustChangePassword: record.usrMustChangePassword,
            usrPasswordExpiresOn: record.usrPasswordExpiresOn?.toISOString() ?? null,
            usrPasswordChangedOn: record.usrPasswordChangedOn?.toISOString() ?? null,
            usrType: record.usrType && Object.values(user_administration_enum_1.UserType).includes(record.usrType)
                ? record.usrType
                : null,
            usrEditDate: record.usrEditDate,
            usrEditEntry: record.usrEditEntry,
            usrEditRate: record.usrEditRate,
            usrDesktopLogin: record.usrDesktopLogin,
            usrWebLogin: record.usrWebLogin,
            usrMobileLogin: record.usrMobileLogin,
            usrIsActive: record.usrIsActive,
            usrIsLocked: record.usrIsLocked,
            usrFailedLoginCount: record.usrFailedLoginCount,
            usrLastFailedLoginOn: record.usrLastFailedLoginOn?.toISOString() ?? null,
            usrLockedOn: record.usrLockedOn?.toISOString() ?? null,
            usrLockedBy: record.usrLockedBy,
            usrLastLoginOn: record.usrLastLoginOn?.toISOString() ?? null,
            usrIsDeleted: record.usrIsDeleted,
            usrNotes: record.usrNotes,
            usrSyncDate: record.usrSyncDate?.toISOString() ?? null,
            usrCreatedOn: record.usrCreatedOn.toISOString(),
            usrCreatedBy: record.usrCreatedBy,
            usrModifiedOn: record.usrModifiedOn?.toISOString() ?? null,
            usrModifiedBy: record.usrModifiedBy,
        };
    }
    toMenuPayload(m) {
        return {
            umId: m.umId,
            umUserId: m.umUserId,
            umMenuId: m.umMenuId,
            umCanView: m.umCanView,
            umCanCreate: m.umCanCreate,
            umCanEdit: m.umCanEdit,
            umCanDelete: m.umCanDelete,
            umCanPrint: m.umCanPrint,
            umCanExport: m.umCanExport,
            umVisibility: m.umVisibility,
            umIsFavourite: m.umIsFavourite,
            umIsPinned: m.umIsPinned,
            umSortOrder: m.umSortOrder,
            umIsDeleted: m.umIsDeleted,
            umSyncDate: m.umSyncDate?.toISOString() ?? null,
            umCreatedOn: m.umCreatedOn.toISOString(),
            umCreatedBy: m.umCreatedBy,
            umModifiedOn: m.umModifiedOn?.toISOString() ?? null,
            umModifiedBy: m.umModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'User already exists', [
            { field: 'usrLoginName', message: 'A user with this login name already exists' },
        ]);
    }
    throwNotFound(usrId) {
        (0, module_service_utils_1.throwSettingsNotFound)('User not found', 'usrId', `No active user found with id ${usrId}`);
    }
};
exports.UserAdministrationService = UserAdministrationService;
exports.UserAdministrationService = UserAdministrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], UserAdministrationService);
//# sourceMappingURL=user-administration.service.js.map