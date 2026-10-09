import { Injectable } from '@nestjs/common';
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
  throwSettingsConflict,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { hashSecret } from 'src/common/utils/secret-hash.utils';
import { UserType } from './types/user-administration.enum';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const USER_MASTER_TABLE_NAME = 'user_master';
const USER_ADMIN_AUDIT_SCREEN_NAME = 'User Administration';

type UserAdminWriteClient = SettingsWriteClient;

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
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

    const payload = this.toPayload(record, record.userMenus);
    const relatedNames = await this.resolveRelatedNames(this.prisma, record);
    return { ...payload, ...relatedNames };
  }

  private async resolveRelatedNames(
    client: UserAdminWriteClient,
    record: Pick<UserMaster, 'usrCompanyId' | 'usrBranchId' | 'usrEmployeeId'>,
  ): Promise<{
    usrCompanyName: string | null;
    usrBranchName: string | null;
    usrEmployeeName: string | null;
  }> {
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
      // Not filtered on emp_is_deleted: a link to an employee deleted since still shows who it was.
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
            usrModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          },
        }),
        tx.userMenus.updateMany({
          where: { umUserId: usrId, umIsDeleted: false },
          data: {
            umIsDeleted: true,
            umModifiedOn: now,
            umModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        await this.ensureEmployeeLinkable(tx, {
          employeeId: dto.usrEmployeeId ?? null,
          companyId: dto.usrCompanyId ?? null,
          isActive: dto.usrIsActive ?? true,
        });

        const now = new Date();
        const passwordHash = await hashSecret(dto.usrPassword!);

        const data: Prisma.UserMasterUncheckedCreateInput = {
          usrLoginName: dto.usrLoginName.trim(),
          usrDisplayName: dto.usrDisplayName?.trim() ?? '',
          usrPasswordHash: passwordHash,
          usrCreatedOn: now,
          usrCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        this.applyOptionalUserFields(data, dto);
        await this.applyPin(data, dto);

        const created = await tx.userMaster.create({ data });
        const menus = await this.replaceUserMenus(
          created.usrId,
          dto.menus ?? [],
          this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        // An omitted key keeps the stored value, so judge the link the save will leave behind.
        await this.ensureEmployeeLinkable(tx, {
          employeeId: dto.usrEmployeeId !== undefined ? dto.usrEmployeeId : existing.usrEmployeeId,
          companyId: dto.usrCompanyId !== undefined ? dto.usrCompanyId : existing.usrCompanyId,
          isActive: dto.usrIsActive ?? existing.usrIsActive,
          usrId,
          previous: { employeeId: existing.usrEmployeeId, isActive: existing.usrIsActive },
        });

        const now = new Date();
        const data: Prisma.UserMasterUncheckedUpdateInput = {
          usrLoginName: dto.usrLoginName.trim(),
          usrModifiedOn: now,
          usrModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        if (dto.usrPassword?.trim()) {
          data.usrPasswordHash = await hashSecret(dto.usrPassword.trim());
          data.usrPasswordChangedOn = now;
          data.usrMustChangePassword = false;
        }

        this.applyOptionalUserFields(data, dto);
        await this.applyPin(data, dto);

        const updated = await tx.userMaster.update({ where: { usrId }, data });

        const menus =
          dto.menus !== undefined
            ? await this.replaceUserMenus(
                usrId,
                dto.menus,
                this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
                now,
                tx,
              )
            : await tx.userMenus.findMany({
                where: { umUserId: usrId, umIsDeleted: false },
                orderBy: { umMenuId: 'asc' },
              });

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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            // Granted, never assumed — and a save is a full replace, so an
            // omitted flag is a revocation rather than a no-op.
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
        }),
      ),
    );

    return created.sort((a, b) => a.umMenuId - b.umMenuId);
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

  // Notes 95 — the till follows a user to an employee (usr_employee_id) and on to the staff
  // advance ledger a shortage is recovered to, so the link must name a live employee the user's
  // company can see, and only one active user may be any one employee. That second rule is a
  // service check, not an index: two offline sites could each link one, and sync must not fail.
  // An employee with no company is unscoped and may be linked from any company.
  // `previous` is the stored link on an update (absent on create).
  private async ensureEmployeeLinkable(
    tx: UserAdminWriteClient,
    link: {
      employeeId: string | null;
      companyId: string | null;
      isActive: boolean;
      usrId?: string;
      previous?: { employeeId: string | null; isActive: boolean };
    },
  ): Promise<void> {
    if (!link.employeeId) {
      return;
    }
    const employee = await tx.employeeMaster.findFirst({
      where: { empId: link.employeeId, empIsDeleted: false },
      select: { empName: true, empCompanyId: true, empIsActive: true },
    });
    if (!employee) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Employee does not exist', [
        {
          field: 'usrEmployeeId',
          message: `No active employee found with id ${link.employeeId}`,
        },
      ]);
    }
    if (link.companyId && employee.empCompanyId && employee.empCompanyId !== link.companyId) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Employee belongs to another company', [
        {
          field: 'usrEmployeeId',
          message: `Employee "${employee.empName}" is not an employee of the user's company`,
        },
      ]);
    }
    // An inactive user holds the link without using it; re-activating them runs this again.
    if (!link.isActive) {
      return;
    }
    // Till plan §4: a new link, or a user made active again, needs an employee still on the
    // rolls. A link that stands unchanged to an employee who has since left is kept, so that
    // user can still be edited or switched off.
    const linkIsNew =
      !link.previous || link.previous.employeeId !== link.employeeId || !link.previous.isActive;
    if (linkIsNew && !employee.empIsActive) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Employee is not active', [
        {
          field: 'usrEmployeeId',
          message: `Employee "${employee.empName}" is not active`,
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
      throwSettingsConflict<UserAdminErrorDetail>('Employee is linked to another user', [
        {
          field: 'usrEmployeeId',
          message: `Employee "${employee.empName}" is already linked to active user '${other.usrLoginName}'`,
        },
      ]);
    }
  }

  // usrPin: absent keeps the stored PIN, "" or null clears it, digits replace it. Same hash
  // format as the password (secret-hash.utils), so the till approval check has one verifier.
  private async applyPin(
    data: Prisma.UserMasterUncheckedCreateInput | Prisma.UserMasterUncheckedUpdateInput,
    dto: SaveUserAdministrationDto,
  ): Promise<void> {
    if (dto.usrPin === undefined) {
      return;
    }
    data.usrPinHash = dto.usrPin ? await hashSecret(dto.usrPin) : null;
  }

  private applyOptionalUserFields(
    data: Prisma.UserMasterUncheckedCreateInput | Prisma.UserMasterUncheckedUpdateInput,
    dto: SaveUserAdministrationDto,
  ): void {
    if (dto.usrCompanyId !== undefined) data.usrCompanyId = dto.usrCompanyId;
    if (dto.usrBranchId !== undefined) data.usrBranchId = dto.usrBranchId;
    if (dto.usrEmployeeId !== undefined) data.usrEmployeeId = dto.usrEmployeeId;
    // Optional/nullable: empty or null collapses to '' (the column is NOT NULL); omitting the
    // key leaves the stored display name unchanged.
    if (dto.usrDisplayName !== undefined) data.usrDisplayName = dto.usrDisplayName?.trim() ?? '';
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
      usrPinSet: Boolean(record.usrPinHash),
      usrType:
        record.usrType && (Object.values(UserType) as string[]).includes(record.usrType)
          ? (record.usrType as UserType)
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
