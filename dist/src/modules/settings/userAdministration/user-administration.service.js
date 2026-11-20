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
exports.UserAdministrationService = exports.GENERATED_PASSWORD_LENGTH = exports.MIN_ADMIN_PASSWORD_LENGTH = exports.USER_ADMIN_MENU_ID = void 0;
exports.describeMenuRightsChange = describeMenuRightsChange;
exports.generatePassword = generatePassword;
exports.parseMaxDiscPerc = parseMaxDiscPerc;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const secret_hash_utils_1 = require("../../../common/utils/secret-hash.utils");
const user_administration_enum_1 = require("./types/user-administration.enum");
const super_admin_1 = require("./super-admin");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const USER_MASTER_TABLE_NAME = 'user_master';
const USER_ADMIN_AUDIT_SCREEN_NAME = 'User Administration';
exports.USER_ADMIN_MENU_ID = 58;
const USER_ADMIN_RIGHT_PREFIX = 'USER';
exports.MIN_ADMIN_PASSWORD_LENGTH = 4;
exports.GENERATED_PASSWORD_LENGTH = 8;
const GENERATED_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const MAX_DISC_PERC_MAX = new client_1.Prisma.Decimal(100);
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
            await this.assertRight('edit', 'change users');
            return this.updateUser(dto);
        }
        await this.assertRight('create', 'create users');
        return this.createUser(dto);
    }
    async getById(usrId) {
        const callerId = this.requestContextService.getUserId();
        if (!callerId || usrId.toLowerCase() !== callerId.toLowerCase()) {
            await this.assertRight('view', 'open other users');
        }
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
        const [company, branch, employee] = await Promise.all([
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
            record.usrEmployeeId
                ? client.employeeMaster.findFirst({
                    where: { empId: record.usrEmployeeId },
                    select: { empName: true },
                })
                : null,
        ]);
        return {
            usrCompanyName: company?.compName ?? null,
            usrBranchName: branch?.brName ?? null,
            usrEmployeeName: employee?.empName ?? null,
        };
    }
    async softDelete(usrId) {
        await this.assertRight('delete', 'delete users');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.userMaster.findFirst({
                where: { usrId, usrIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(usrId);
            }
            await this.assertMayTouch(tx, existing, 'delete');
            const now = new Date();
            const [, menuCount] = await Promise.all([
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
            const originalPayload = this.toAuditRecord(existing, null);
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: USER_MASTER_TABLE_NAME,
                screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: usrId,
                displayName: this.auditDisplayName(existing),
                originalRecord: originalPayload,
                modifiedRecord: { ...originalPayload, usrIsDeleted: true, usrIsActive: false },
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: `User soft deleted along with all ${menuCount.count} menu assignments`,
            }, tx);
            return { usrId, deleted: true };
        });
    }
    async resetPassword(dto) {
        await this.assertRight('edit', 'reset passwords');
        const typed = dto.newPassword?.trim() ?? '';
        if (dto.generate === true && typed.length > 0) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Type a password or generate one, not both', [
                {
                    field: 'newPassword',
                    message: 'newPassword was sent together with generate: true; send one of them',
                    code: user_administration_enum_1.UserAdminErrorCode.RESET_PASSWORD_CHOICE,
                },
            ]);
        }
        if (dto.generate !== true) {
            assertPasswordLength(dto.newPassword ?? '', 'newPassword');
        }
        const generatedPassword = dto.generate === true ? generatePassword() : null;
        const password = generatedPassword ?? typed;
        const actorId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.userMaster.findFirst({
                where: { usrId: dto.usrId, usrIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(dto.usrId);
            }
            await this.assertMayTouch(tx, existing, 'reset the password of');
            const now = new Date();
            await tx.userMaster.update({
                where: { usrId: dto.usrId },
                data: {
                    usrPasswordHash: await (0, secret_hash_utils_1.hashSecret)(password),
                    usrPasswordChangedOn: now,
                    usrMustChangePassword: true,
                    usrModifiedOn: now,
                    usrModifiedBy: actorId,
                },
            });
            const admin = await this.actorLoginName(tx, actorId);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: USER_MASTER_TABLE_NAME,
                screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: dto.usrId,
                displayName: this.auditDisplayName(existing),
                originalRecord: {
                    usrPasswordChangedOn: existing.usrPasswordChangedOn?.toISOString() ?? null,
                    usrMustChangePassword: existing.usrMustChangePassword,
                },
                modifiedRecord: {
                    usrPasswordChangedOn: now.toISOString(),
                    usrMustChangePassword: true,
                },
                userId: actorId,
                notes: `Password reset by ${admin} (${generatedPassword ? 'generated' : 'typed'}); ` +
                    'the user must change it at the next login',
            }, tx);
            return {
                usrId: existing.usrId,
                usrLoginName: existing.usrLoginName,
                usrMustChangePassword: true,
                usrPasswordChangedOn: now.toISOString(),
                generatedPassword,
            };
        });
    }
    async unlock(usrId) {
        await this.assertRight('edit', 'unlock users');
        const actorId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.userMaster.findFirst({ where: { usrId, usrIsDeleted: false } });
            if (!existing) {
                this.throwNotFound(usrId);
            }
            await this.assertMayTouch(tx, existing, 'unlock');
            const result = {
                usrId,
                usrIsLocked: false,
                usrFailedLoginCount: 0,
                usrLockedOn: null,
                usrLockedBy: null,
                changed: false,
            };
            const before = {
                usrIsLocked: existing.usrIsLocked,
                usrLockedOn: existing.usrLockedOn?.toISOString() ?? null,
                usrLockedBy: existing.usrLockedBy,
                usrFailedLoginCount: existing.usrFailedLoginCount,
            };
            if (!before.usrIsLocked &&
                before.usrLockedOn === null &&
                before.usrLockedBy === null &&
                before.usrFailedLoginCount === 0) {
                return result;
            }
            const now = new Date();
            await tx.userMaster.update({
                where: { usrId },
                data: {
                    usrIsLocked: false,
                    usrLockedOn: null,
                    usrLockedBy: null,
                    usrFailedLoginCount: 0,
                    usrModifiedOn: now,
                    usrModifiedBy: actorId,
                },
            });
            const admin = await this.actorLoginName(tx, actorId);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: USER_MASTER_TABLE_NAME,
                screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: usrId,
                displayName: this.auditDisplayName(existing),
                originalRecord: before,
                modifiedRecord: {
                    usrIsLocked: false,
                    usrLockedOn: null,
                    usrLockedBy: null,
                    usrFailedLoginCount: 0,
                },
                userId: actorId,
                notes: `${before.usrIsLocked ? 'Unlocked' : 'Failed logins cleared'} by ${admin}` +
                    ` (failed logins were ${before.usrFailedLoginCount})`,
            }, tx);
            return { ...result, changed: true };
        });
    }
    async restore(usrId) {
        await this.assertRight('delete', 'restore users');
        const actorId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.userMaster.findFirst({ where: { usrId } });
                if (!existing) {
                    this.throwNotFound(usrId);
                }
                if (!existing.usrIsDeleted) {
                    (0, module_service_utils_1.throwSettingsConflict)('User is not deleted', [
                        {
                            field: 'usrId',
                            message: `${existing.usrLoginName} is not deleted; only a deleted user can be restored`,
                            code: user_administration_enum_1.UserAdminErrorCode.NOT_DELETED,
                        },
                    ]);
                }
                await this.assertMayTouch(tx, existing, 'restore');
                const holder = await tx.userMaster.findFirst({
                    where: {
                        usrLoginName: { equals: existing.usrLoginName.trim(), mode: 'insensitive' },
                        usrIsDeleted: false,
                        NOT: { usrId },
                    },
                    select: { usrLoginName: true },
                });
                if (holder) {
                    this.throwRestoreLoginTaken(holder.usrLoginName);
                }
                const now = new Date();
                const restored = await tx.userMaster.updateMany({
                    where: { usrId, usrIsDeleted: true },
                    data: {
                        usrIsDeleted: false,
                        usrIsActive: false,
                        usrModifiedOn: now,
                        usrModifiedBy: actorId,
                    },
                });
                if (restored.count === 0) {
                    this.throwNotFound(usrId);
                }
                const { revived, leftOut } = await this.reviveDeletedRights(tx, existing, actorId, now);
                const menuNames = await this.menuNamesOf(tx, revived);
                const admin = await this.actorLoginName(tx, actorId);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: USER_MASTER_TABLE_NAME,
                    screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: usrId,
                    displayName: this.auditDisplayName(existing),
                    originalRecord: this.toAuditRecord(existing, {}),
                    modifiedRecord: this.toAuditRecord({ ...existing, usrIsDeleted: false, usrIsActive: false }, this.menuRightsOf(revived, menuNames)),
                    userId: actorId,
                    notes: truncateNote(`User restored by ${admin}: inactive, with the ${revived.length} menu rights ` +
                        'the delete removed' +
                        (leftOut > 0 ? `; ${leftOut} of a menu no longer active left out` : '')),
                }, tx);
                return {
                    usrId,
                    usrLoginName: existing.usrLoginName,
                    usrIsDeleted: false,
                    usrIsActive: false,
                    menuCount: revived.length,
                };
            });
        }
        catch (error) {
            if (isLoginNameClash(error)) {
                this.throwRestoreLoginTaken(null);
            }
            throw error;
        }
    }
    async reviveDeletedRights(tx, deleted, actorId, now) {
        if (!deleted.usrModifiedOn) {
            return { revived: [], leftOut: 0 };
        }
        const removedByDelete = await tx.userMenus.findMany({
            where: {
                umUserId: deleted.usrId,
                umIsDeleted: true,
                umModifiedOn: deleted.usrModifiedOn,
                ...(deleted.usrModifiedBy ? { umModifiedBy: deleted.usrModifiedBy } : {}),
            },
            orderBy: { umMenuId: 'asc' },
        });
        if (removedByDelete.length === 0) {
            return { revived: [], leftOut: 0 };
        }
        const active = new Set((await tx.menu.findMany({
            where: {
                menuId: { in: [...new Set(removedByDelete.map((row) => row.umMenuId))] },
                menuIsActive: true,
            },
            select: { menuId: true },
        })).map((menu) => menu.menuId));
        const revive = removedByDelete.filter((row) => active.has(row.umMenuId));
        if (revive.length > 0) {
            await tx.userMenus.updateMany({
                where: { umId: { in: revive.map((row) => row.umId) }, umIsDeleted: true },
                data: { umIsDeleted: false, umModifiedOn: now, umModifiedBy: actorId },
            });
        }
        return {
            revived: revive.map((row) => ({
                ...row,
                umIsDeleted: false,
                umModifiedOn: now,
                umModifiedBy: actorId,
            })),
            leftOut: removedByDelete.length - revive.length,
        };
    }
    throwRestoreLoginTaken(loginName) {
        (0, module_service_utils_1.throwSettingsConflict)('Login name in use', [
            {
                field: 'usrLoginName',
                message: loginName
                    ? `Another user now has the login name ${loginName}`
                    : 'Another user now has this login name',
                code: user_administration_enum_1.UserAdminErrorCode.RESTORE_LOGIN_TAKEN,
                ...(loginName ? { loginName } : {}),
            },
        ]);
    }
    async actorLoginName(tx, actorId) {
        const row = await tx.userMaster.findFirst({
            where: { usrId: actorId },
            select: { usrLoginName: true },
        });
        return row?.usrLoginName ?? actorId;
    }
    async createUser(dto) {
        if (!dto.usrPassword?.trim()) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
                {
                    field: 'usrPassword',
                    message: 'usrPassword is required when creating a new user',
                    code: user_administration_enum_1.UserAdminErrorCode.PASSWORD_REQUIRED,
                },
            ]);
        }
        assertPasswordLength(dto.usrPassword, 'usrPassword');
        const maxDiscPerc = parseMaxDiscPerc(dto.usrMaxDiscPerc);
        try {
            return this.prisma.$transaction(async (tx) => {
                await this.assertMayGiveRole(tx, dto.usrType);
                await this.ensureLoginNameUnique(dto.usrLoginName, undefined, tx);
                await this.ensureEmployeeLinkable(tx, {
                    employeeId: dto.usrEmployeeId ?? null,
                    companyId: dto.usrCompanyId ?? null,
                    isActive: dto.usrIsActive ?? true,
                });
                const now = new Date();
                const passwordHash = await (0, secret_hash_utils_1.hashSecret)(dto.usrPassword);
                const data = {
                    usrLoginName: dto.usrLoginName.trim(),
                    usrDisplayName: dto.usrDisplayName?.trim() ?? '',
                    usrPasswordHash: passwordHash,
                    usrCreatedOn: now,
                    usrCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalUserFields(data, dto, maxDiscPerc);
                await this.applyPin(data, dto);
                const created = await tx.userMaster.create({ data });
                const menus = await this.replaceUserMenus(created.usrId, dto.menus ?? [], this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR, now, tx);
                const payload = this.toPayload(created, menus);
                const menuNames = await this.menuNamesOf(tx, menus);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: USER_MASTER_TABLE_NAME,
                    screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: created.usrId,
                    displayName: this.auditDisplayName(created),
                    originalRecord: null,
                    modifiedRecord: this.toAuditRecord(created, this.menuRightsOf(menus, menuNames)),
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
        if (dto.usrPassword?.trim()) {
            assertPasswordLength(dto.usrPassword, 'usrPassword');
        }
        const maxDiscPerc = parseMaxDiscPerc(dto.usrMaxDiscPerc);
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.userMaster.findFirst({
                    where: { usrId, usrIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound(usrId);
                }
                await this.assertMayTouch(tx, existing, 'change');
                if (dto.usrType !== existing.usrType) {
                    await this.assertMayGiveRole(tx, dto.usrType);
                }
                await this.ensureLoginNameUnique(dto.usrLoginName, usrId, tx);
                await this.ensureEmployeeLinkable(tx, {
                    employeeId: dto.usrEmployeeId !== undefined ? dto.usrEmployeeId : existing.usrEmployeeId,
                    companyId: dto.usrCompanyId !== undefined ? dto.usrCompanyId : existing.usrCompanyId,
                    isActive: dto.usrIsActive ?? existing.usrIsActive,
                    usrId,
                    previous: { employeeId: existing.usrEmployeeId, isActive: existing.usrIsActive },
                });
                const now = new Date();
                const data = {
                    usrLoginName: dto.usrLoginName.trim(),
                    usrModifiedOn: now,
                    usrModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if (dto.usrPassword?.trim()) {
                    data.usrPasswordHash = await (0, secret_hash_utils_1.hashSecret)(dto.usrPassword.trim());
                    data.usrPasswordChangedOn = now;
                    data.usrMustChangePassword = true;
                }
                this.applyOptionalUserFields(data, dto, maxDiscPerc);
                await this.applyPin(data, dto);
                const menusBefore = await tx.userMenus.findMany({
                    where: { umUserId: usrId, umIsDeleted: false },
                    orderBy: { umMenuId: 'asc' },
                });
                const updated = await tx.userMaster.update({ where: { usrId }, data });
                const menus = dto.menus !== undefined
                    ? await this.replaceUserMenus(usrId, dto.menus, this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR, now, tx)
                    : menusBefore;
                const payload = this.toPayload(updated, menus);
                const menuNames = await this.menuNamesOf(tx, [...menusBefore, ...menus]);
                const rightsBefore = this.menuRightsOf(menusBefore, menuNames);
                const rightsAfter = this.menuRightsOf(menus, menuNames);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: USER_MASTER_TABLE_NAME,
                    screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: usrId,
                    displayName: this.auditDisplayName(updated),
                    originalRecord: this.toAuditRecord(existing, rightsBefore),
                    modifiedRecord: this.toAuditRecord(updated, rightsAfter),
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: this.updateNotes(dto, existing, menusBefore, menus, menuNames),
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async assertRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContextService.getUserId(),
            menuId: exports.USER_ADMIN_MENU_ID,
            right,
            codePrefix: USER_ADMIN_RIGHT_PREFIX,
            action,
        });
    }
    async assertMayGiveRole(tx, usrType) {
        if (usrType !== user_administration_enum_1.UserType.SUPER_ADMIN) {
            return;
        }
        if (!(await (0, super_admin_1.callerIsSuperAdmin)(tx, this.requestContextService.getUserId()))) {
            (0, module_service_utils_1.throwSettingsForbidden)('User role reserved', [
                {
                    field: 'usrType',
                    code: user_administration_enum_1.UserAdminErrorCode.ROLE_RESERVED,
                    message: 'Only a SUPER ADMIN can make a user SUPER ADMIN',
                },
            ]);
        }
    }
    async assertMayTouch(tx, target, action) {
        if (target.usrType !== user_administration_enum_1.UserType.SUPER_ADMIN) {
            return;
        }
        if (!(await (0, super_admin_1.callerIsSuperAdmin)(tx, this.requestContextService.getUserId()))) {
            (0, module_service_utils_1.throwSettingsForbidden)('User role reserved', [
                {
                    field: 'usrId',
                    code: user_administration_enum_1.UserAdminErrorCode.ROLE_RESERVED,
                    message: `${target.usrLoginName} is a SUPER ADMIN user: only a SUPER ADMIN can ${action} it`,
                },
            ]);
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
                {
                    field: 'menus',
                    message: `Menu IDs not found or inactive: ${invalidIds.join(', ')}`,
                    code: user_administration_enum_1.UserAdminErrorCode.MENU_INVALID,
                },
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
                umCanPost: m.umCanPost ?? false,
                umCanCancel: m.umCanCancel ?? false,
                umCanAmend: m.umCanAmend ?? false,
                umCanOverride: m.umCanOverride ?? false,
                umCanRetender: m.umCanRetender ?? false,
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
                umCanPost: m.umCanPost ?? false,
                umCanCancel: m.umCanCancel ?? false,
                umCanAmend: m.umCanAmend ?? false,
                umCanOverride: m.umCanOverride ?? false,
                umCanRetender: m.umCanRetender ?? false,
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
                {
                    field: 'usrLoginName',
                    message: `Login name '${loginName}' is already taken`,
                    code: user_administration_enum_1.UserAdminErrorCode.LOGIN_NAME_TAKEN,
                },
            ]);
        }
    }
    async ensureEmployeeLinkable(tx, link) {
        if (!link.employeeId) {
            return;
        }
        const employee = await tx.employeeMaster.findFirst({
            where: { empId: link.employeeId, empIsDeleted: false },
            select: { empName: true, empCompanyId: true, empIsActive: true },
        });
        if (!employee) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Employee does not exist', [
                {
                    field: 'usrEmployeeId',
                    message: `No active employee found with id ${link.employeeId}`,
                    code: user_administration_enum_1.UserAdminErrorCode.EMPLOYEE_NOT_FOUND,
                },
            ]);
        }
        if (link.companyId && employee.empCompanyId && employee.empCompanyId !== link.companyId) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Employee belongs to another company', [
                {
                    field: 'usrEmployeeId',
                    message: `Employee "${employee.empName}" is not an employee of the user's company`,
                    code: user_administration_enum_1.UserAdminErrorCode.EMPLOYEE_OTHER_COMPANY,
                },
            ]);
        }
        if (!link.isActive) {
            return;
        }
        const linkIsNew = !link.previous || link.previous.employeeId !== link.employeeId || !link.previous.isActive;
        if (linkIsNew && !employee.empIsActive) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Employee is not active', [
                {
                    field: 'usrEmployeeId',
                    message: `Employee "${employee.empName}" is not active`,
                    code: user_administration_enum_1.UserAdminErrorCode.EMPLOYEE_INACTIVE,
                },
            ]);
        }
        const other = await tx.userMaster.findFirst({
            where: {
                usrEmployeeId: link.employeeId,
                usrIsDeleted: false,
                usrIsActive: true,
                ...(link.usrId ? { NOT: { usrId: link.usrId } } : {}),
            },
            select: { usrLoginName: true },
        });
        if (other) {
            (0, module_service_utils_1.throwSettingsConflict)('Employee is linked to another user', [
                {
                    field: 'usrEmployeeId',
                    message: `Employee "${employee.empName}" is already linked to active user '${other.usrLoginName}'`,
                    code: user_administration_enum_1.UserAdminErrorCode.EMPLOYEE_LINKED,
                },
            ]);
        }
    }
    async applyPin(data, dto) {
        if (dto.usrPin === undefined) {
            return;
        }
        data.usrPinHash = dto.usrPin ? await (0, secret_hash_utils_1.hashSecret)(dto.usrPin) : null;
    }
    applyOptionalUserFields(data, dto, maxDiscPerc) {
        if (maxDiscPerc !== undefined)
            data.usrMaxDiscPerc = maxDiscPerc;
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
    auditDisplayName(record) {
        return record.usrDisplayName?.trim() || record.usrLoginName;
    }
    toAuditRecord(record, menuRights) {
        return {
            ...this.toPayloadWithoutMenus(record),
            pinSet: Boolean(record.usrPinHash),
            ...(menuRights !== null ? { menuRights } : {}),
        };
    }
    async menuNamesOf(tx, menus) {
        const menuIds = [...new Set(menus.map((menu) => menu.umMenuId))];
        if (menuIds.length === 0) {
            return new Map();
        }
        const rows = await tx.menu.findMany({
            where: { menuId: { in: menuIds } },
            select: { menuId: true, menuName: true },
        });
        const nameOf = (row) => row.menuName?.trim() || `Menu ${row.menuId}`;
        const nameCount = new Map();
        for (const row of rows) {
            nameCount.set(nameOf(row), (nameCount.get(nameOf(row)) ?? 0) + 1);
        }
        return new Map(rows.map((row) => {
            const name = nameOf(row);
            return [row.menuId, (nameCount.get(name) ?? 0) > 1 ? `${name} (#${row.menuId})` : name];
        }));
    }
    menuRightsOf(menus, menuNames) {
        const rights = {};
        for (const menu of [...menus].sort((a, b) => a.umMenuId - b.umMenuId)) {
            const name = menuNames.get(menu.umMenuId) ?? `Menu ${menu.umMenuId}`;
            rights[name] = grantedRights(menu).join(', ') || 'None';
        }
        return rights;
    }
    updateNotes(dto, existing, menusBefore, menusAfter, menuNames) {
        const notes = ['User updated'];
        if (dto.usrPassword?.trim()) {
            notes.push('password reset by an administrator');
        }
        if (dto.usrPin) {
            notes.push(existing.usrPinHash ? 'PIN changed' : 'PIN set');
        }
        else if (dto.usrPin !== undefined && existing.usrPinHash) {
            notes.push('PIN cleared');
        }
        const rightsChange = describeMenuRightsChange(menusBefore, menusAfter, menuNames);
        if (rightsChange) {
            notes.push(`Menu rights: ${rightsChange}`);
        }
        return truncateNote(notes.join('; '));
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
            usrPinSet: Boolean(record.usrPinHash),
            usrType: record.usrType && Object.values(user_administration_enum_1.UserType).includes(record.usrType)
                ? record.usrType
                : null,
            usrEditDate: record.usrEditDate,
            usrEditEntry: record.usrEditEntry,
            usrEditRate: record.usrEditRate,
            usrMaxDiscPerc: record.usrMaxDiscPerc === null || record.usrMaxDiscPerc === undefined
                ? null
                : new client_1.Prisma.Decimal(record.usrMaxDiscPerc).toFixed(2),
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
            umCanPost: m.umCanPost,
            umCanCancel: m.umCanCancel,
            umCanAmend: m.umCanAmend,
            umCanOverride: m.umCanOverride,
            umCanRetender: m.umCanRetender,
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
            {
                field: 'usrLoginName',
                message: 'A user with this login name already exists',
                code: user_administration_enum_1.UserAdminErrorCode.LOGIN_NAME_TAKEN,
            },
        ]);
    }
    throwNotFound(usrId) {
        (0, module_service_utils_1.throwSettingsNotFound)('User not found', 'usrId', `No active user found with id ${usrId}`, user_administration_enum_1.UserAdminErrorCode.NOT_FOUND);
    }
};
exports.UserAdministrationService = UserAdministrationService;
exports.UserAdministrationService = UserAdministrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], UserAdministrationService);
const MENU_RIGHT_FLAGS = [
    ['umCanView', 'View'],
    ['umCanCreate', 'Create'],
    ['umCanEdit', 'Edit'],
    ['umCanDelete', 'Delete'],
    ['umCanPrint', 'Print'],
    ['umCanExport', 'Export'],
    ['umCanPost', 'Post'],
    ['umCanCancel', 'Cancel'],
    ['umCanAmend', 'Amend'],
    ['umCanOverride', 'Override'],
    ['umCanRetender', 'Retender'],
];
function grantedRights(menu) {
    return MENU_RIGHT_FLAGS.filter(([flag]) => menu[flag] === true).map(([, label]) => label);
}
function describeMenuRightsChange(before, after, menuNames) {
    const beforeById = new Map(before.map((menu) => [menu.umMenuId, menu]));
    const afterById = new Map(after.map((menu) => [menu.umMenuId, menu]));
    const menuIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort((a, b) => a - b);
    const parts = [];
    for (const menuId of menuIds) {
        const name = menuNames.get(menuId) ?? `Menu ${menuId}`;
        const was = beforeById.get(menuId);
        const now = afterById.get(menuId);
        if (!was && now) {
            parts.push(`${name}: added (${grantedRights(now).join(', ') || 'no rights'})`);
            continue;
        }
        if (was && !now) {
            parts.push(`${name}: removed`);
            continue;
        }
        if (!was || !now) {
            continue;
        }
        const flips = MENU_RIGHT_FLAGS.filter(([flag]) => was[flag] !== now[flag]).map(([flag, label]) => `${label} ${now[flag] === true ? 'on' : 'off'}`);
        if (flips.length > 0) {
            parts.push(`${name}: ${flips.join(', ')}`);
        }
    }
    return parts.join('; ');
}
const MAX_NOTE_LENGTH = 4000;
function truncateNote(note) {
    return note.length <= MAX_NOTE_LENGTH
        ? note
        : `${note.slice(0, MAX_NOTE_LENGTH - 15)} … (and more)`;
}
function assertPasswordLength(password, field) {
    if (password.trim().length >= exports.MIN_ADMIN_PASSWORD_LENGTH) {
        return;
    }
    (0, module_service_utils_1.throwSettingsBadRequest)('Password too short', [
        {
            field,
            message: `The password needs at least ${exports.MIN_ADMIN_PASSWORD_LENGTH} characters`,
            code: user_administration_enum_1.UserAdminErrorCode.PASSWORD_TOO_SHORT,
        },
    ]);
}
function generatePassword(length = exports.GENERATED_PASSWORD_LENGTH) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += GENERATED_PASSWORD_ALPHABET[(0, node_crypto_1.randomInt)(GENERATED_PASSWORD_ALPHABET.length)];
    }
    return out;
}
function parseMaxDiscPerc(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || (typeof value === 'string' && value.trim() === '')) {
        return null;
    }
    let parsed = null;
    if ((typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(value))) {
        parsed = new client_1.Prisma.Decimal(typeof value === 'string' ? value.trim() : value);
    }
    if (parsed === null || parsed.isNegative() || parsed.gt(MAX_DISC_PERC_MAX)) {
        (0, module_service_utils_1.throwSettingsBadRequest)('Wrong discount limit', [
            {
                field: 'usrMaxDiscPerc',
                message: 'Max discount % must be from 0 to 100, or empty for no limit',
                code: user_administration_enum_1.UserAdminErrorCode.MAX_DISC_INVALID,
            },
        ]);
    }
    const rounded = parsed.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
    return rounded;
}
function isLoginNameClash(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return false;
    }
    if (error.code === 'P2002') {
        return true;
    }
    return error.code === 'P2010' && error.meta?.code === '23505';
}
//# sourceMappingURL=user-administration.service.js.map