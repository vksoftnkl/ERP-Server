import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { Prisma, UserMaster, UserMenus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveUserAdministrationDto, SaveUserMenuDto } from './dto/save-user-administration.dto';
import {
  UserAdminErrorDetail,
  UserAdminPayload,
  UserMenuPayload,
} from './types/user-administration-api.types';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { UserType } from './types/user-administration.enum';

const USER_MASTER_TABLE_NAME = 'user_master';
const USER_ADMIN_AUDIT_SCREEN_NAME = 'User Administration';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;

const scryptAsync = promisify(nodeScrypt);

type UserAdminWriteClient = SettingsWriteClient;

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(dto: SaveUserAdministrationDto): Promise<UserAdminPayload> {
    if (dto.usrId) {
      return this.updateUser(dto);
    }
    return this.createUser(dto);
  }

  async getById(usrId: string): Promise<UserAdminPayload> {
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

    return this.toPayload(record, record.userMenus);
  }

  async softDelete(usrId: string): Promise<{ usrId: string; deleted: true }> {
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
            usrModifiedBy: DEFAULT_ACTOR,
          },
        }),
        tx.userMenus.updateMany({
          where: { umUserId: usrId, umIsDeleted: false },
          data: {
            umIsDeleted: true,
            umModifiedOn: now,
            umModifiedBy: DEFAULT_ACTOR,
          },
        }),
      ]);

      const originalPayload = this.toPayloadWithoutMenus(existing);
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: USER_MASTER_TABLE_NAME,
          screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: usrId,
          displayName: existing.usrDisplayName,
          originalRecord: originalPayload,
          modifiedRecord: { ...originalPayload, usrIsDeleted: true, usrIsActive: false },
          userId: DEFAULT_ACTOR,
          notes: 'User soft deleted along with all menu assignments',
        },
        tx,
      );

      return { usrId, deleted: true };
    });
  }

  private async createUser(dto: SaveUserAdministrationDto): Promise<UserAdminPayload> {
    if (!dto.usrPassword?.trim()) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Validation failed', [
        { field: 'usrPassword', message: 'usrPassword is required when creating a new user' },
      ]);
    }

    try {
      return this.prisma.$transaction(async (tx) => {
        await this.ensureLoginNameUnique(dto.usrLoginName, undefined, tx);

        const now = new Date();
        const passwordHash = await this.hashPassword(dto.usrPassword!);

        const data: Prisma.UserMasterUncheckedCreateInput = {
          usrLoginName: dto.usrLoginName.trim(),
          usrDisplayName: dto.usrDisplayName.trim(),
          usrPasswordHash: passwordHash,
          usrCreatedOn: now,
          usrCreatedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalUserFields(data, dto);

        const created = await tx.userMaster.create({ data });
        const menus = await this.replaceUserMenus(
          created.usrId,
          dto.menus ?? [],
          DEFAULT_ACTOR,
          now,
          tx,
        );

        const payload = this.toPayload(created, menus);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: USER_MASTER_TABLE_NAME,
            screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: created.usrId,
            displayName: created.usrDisplayName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'User created with menu assignments',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateUser(dto: SaveUserAdministrationDto): Promise<UserAdminPayload> {
    const usrId = dto.usrId!;

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
        const data: Prisma.UserMasterUncheckedUpdateInput = {
          usrLoginName: dto.usrLoginName.trim(),
          usrDisplayName: dto.usrDisplayName.trim(),
          usrModifiedOn: now,
          usrModifiedBy: DEFAULT_ACTOR,
        };

        if (dto.usrPassword?.trim()) {
          data.usrPasswordHash = await this.hashPassword(dto.usrPassword.trim());
          data.usrPasswordChangedOn = now;
          data.usrMustChangePassword = false;
        }

        this.applyOptionalUserFields(data, dto);

        const updated = await tx.userMaster.update({ where: { usrId }, data });

        const menus =
          dto.menus !== undefined
            ? await this.replaceUserMenus(usrId, dto.menus, DEFAULT_ACTOR, now, tx)
            : await tx.userMenus.findMany({ where: { umUserId: usrId, umIsDeleted: false } });

        const payload = this.toPayload(updated, menus);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: USER_MASTER_TABLE_NAME,
            screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: usrId,
            displayName: updated.usrDisplayName,
            originalRecord: this.toPayloadWithoutMenus(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'User updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async replaceUserMenus(
    usrId: string,
    menus: SaveUserMenuDto[],
    actor: string,
    now: Date,
    tx: UserAdminWriteClient,
  ): Promise<UserMenus[]> {
    // Soft-delete all existing active menus for this user
    await tx.userMenus.updateMany({
      where: { umUserId: usrId, umIsDeleted: false },
      data: { umIsDeleted: true, umModifiedOn: now, umModifiedBy: actor },
    });

    if (menus.length === 0) {
      return [];
    }

    // Validate all referenced menus exist
    const menuIds = [...new Set(menus.map((m) => m.umMenuId))];
    const existingMenus = await tx.menu.findMany({
      where: { menuId: { in: menuIds }, menuIsActive: true },
      select: { menuId: true },
    });
    const validMenuIds = new Set(existingMenus.map((m) => m.menuId));
    const invalidIds = menuIds.filter((id) => !validMenuIds.has(id));
    if (invalidIds.length > 0) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Invalid menu reference', [
        { field: 'menus', message: `Menu IDs not found or inactive: ${invalidIds.join(', ')}` },
      ]);
    }

    const created = await Promise.all(
      menus.map((m) =>
        tx.userMenus.upsert({
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
        }),
      ),
    );

    return created;
  }

  private async ensureLoginNameUnique(
    loginName: string,
    excludeUsrId: string | undefined,
    tx: UserAdminWriteClient,
  ): Promise<void> {
    const existing = await tx.userMaster.findFirst({
      where: {
        usrLoginName: { equals: loginName.trim(), mode: 'insensitive' },
        usrIsDeleted: false,
        ...(excludeUsrId ? { NOT: { usrId: excludeUsrId } } : {}),
      },
      select: { usrId: true },
    });

    if (existing) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Validation failed', [
        { field: 'usrLoginName', message: `Login name '${loginName}' is already taken` },
      ]);
    }
  }

  private applyOptionalUserFields(
    data: Prisma.UserMasterUncheckedCreateInput | Prisma.UserMasterUncheckedUpdateInput,
    dto: SaveUserAdministrationDto,
  ): void {
    if (dto.usrCompanyId !== undefined) data.usrCompanyId = dto.usrCompanyId;
    if (dto.usrBranchId !== undefined) data.usrBranchId = dto.usrBranchId;
    if (dto.usrEmployeeId !== undefined) data.usrEmployeeId = dto.usrEmployeeId;
    if (dto.usrFullName !== undefined) data.usrFullName = dto.usrFullName;
    if (dto.usrMobileNo !== undefined) data.usrMobileNo = dto.usrMobileNo;
    if (dto.usrEmail !== undefined) data.usrEmail = dto.usrEmail;
    if (dto.usrAvatarUrl !== undefined) data.usrAvatarUrl = dto.usrAvatarUrl;
    if (dto.usrTimezone !== undefined) data.usrTimezone = dto.usrTimezone;
    if (dto.usrLanguage !== undefined) data.usrLanguage = dto.usrLanguage;
    if (dto.usrMustChangePassword !== undefined)
      data.usrMustChangePassword = dto.usrMustChangePassword;
    if (dto.usrType !== undefined) data.usrType = dto.usrType;
    if (dto.usrEditDate !== undefined) data.usrEditDate = dto.usrEditDate;
    if (dto.usrEditEntry !== undefined) data.usrEditEntry = dto.usrEditEntry;
    if (dto.usrEditRate !== undefined) data.usrEditRate = dto.usrEditRate;
    if (dto.usrDesktopLogin !== undefined) data.usrDesktopLogin = dto.usrDesktopLogin;
    if (dto.usrWebLogin !== undefined) data.usrWebLogin = dto.usrWebLogin;
    if (dto.usrMobileLogin !== undefined) data.usrMobileLogin = dto.usrMobileLogin;
    if (dto.usrIsActive !== undefined) data.usrIsActive = dto.usrIsActive;
    if (dto.usrNotes !== undefined) data.usrNotes = dto.usrNotes;
  }

  private async hashPassword(plain: string): Promise<string> {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
    const derived = (await scryptAsync(plain, salt, PASSWORD_KEY_LENGTH)) as Buffer;
    return `scrypt$${salt}$${derived.toString('hex')}`;
  }

  private toPayload(record: UserMaster, menus: UserMenus[]): UserAdminPayload {
    return {
      ...this.toPayloadWithoutMenus(record),
      menus: menus.map((m) => this.toMenuPayload(m)),
    };
  }

  private toPayloadWithoutMenus(record: UserMaster): Omit<UserAdminPayload, 'menus'> {
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
      usrType: record.usrType ? (UserType[record.usrType as keyof typeof UserType] ?? null) : null,
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

  private toMenuPayload(m: UserMenus): UserMenuPayload {
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

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<UserAdminErrorDetail>(error, 'User already exists', [
      { field: 'usrLoginName', message: 'A user with this login name already exists' },
    ]);
  }

  private throwNotFound(usrId: string): never {
    throwSettingsNotFound<UserAdminErrorDetail>(
      'User not found',
      'usrId',
      `No active user found with id ${usrId}`,
    );
  }
}
