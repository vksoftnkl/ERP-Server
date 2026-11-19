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
  throwSettingsForbidden,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { hashSecret } from 'src/common/utils/secret-hash.utils';
import { UserAdminErrorCode, UserType } from './types/user-administration.enum';
import { callerIsSuperAdmin } from './super-admin';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { assertMenuRight, MenuRight } from '../../../common/posting/rights';

const USER_MASTER_TABLE_NAME = 'user_master';
const USER_ADMIN_AUDIT_SCREEN_NAME = 'User Administration';
/** Users & Rights (fixed.menu_master 58): every route here is judged on the caller's row for it. */
export const USER_ADMIN_MENU_ID = 58;
/** assertMenuRight codes: USER_RIGHT_VIEW / _CREATE / _EDIT / _DELETE (UserAdminErrorCode.RIGHT_*). */
const USER_ADMIN_RIGHT_PREFIX = 'USER';

type UserAdminWriteClient = SettingsWriteClient;

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // Review list 11-19 S2: the token alone used to be enough, so any signed-in user (a cashier)
  // could set another user's password, raise a role or grant themselves menus. Now the caller
  // needs the menu-58 right first, before any other check answers: Create for a new user, Edit
  // for a save with usrId — the caller's own row included, since a user changes their own
  // password through POST /auth/change-password (current password checked), not here.
  async save(dto: SaveUserAdministrationDto): Promise<UserAdminPayload> {
    if (dto.usrId) {
      await this.assertRight('edit', 'change users');
      return this.updateUser(dto);
    }
    await this.assertRight('create', 'create users');
    return this.createUser(dto);
  }

  // A user's own row is always readable: the main window loads the signed-in user's grants
  // from it (MenuWindow::loadMyPermissions) and My Profile shows it. Anyone else's row needs
  // the menu-58 View right (the Users & Rights screen: edit, Copy rights).
  async getById(usrId: string): Promise<UserAdminPayload> {
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

      // The menu rights go with the user; the row says how many rather than listing each
      // one going (the Users & Rights audit keeps menu diffs for saves).
      const originalPayload = this.toAuditRecord(existing, null);
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: USER_MASTER_TABLE_NAME,
          screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: usrId,
          displayName: this.auditDisplayName(existing),
          originalRecord: originalPayload,
          modifiedRecord: { ...originalPayload, usrIsDeleted: true, usrIsActive: false },
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: `User soft deleted along with all ${menuCount.count} menu assignments`,
        },
        tx,
      );

      return { usrId, deleted: true };
    });
  }

  private async createUser(dto: SaveUserAdministrationDto): Promise<UserAdminPayload> {
    if (!dto.usrPassword?.trim()) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Validation failed', [
        {
          field: 'usrPassword',
          message: 'usrPassword is required when creating a new user',
          code: UserAdminErrorCode.PASSWORD_REQUIRED,
        },
      ]);
    }

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
        const menuNames = await this.menuNamesOf(tx, menus);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: USER_MASTER_TABLE_NAME,
            screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: created.usrId,
            displayName: this.auditDisplayName(created),
            originalRecord: null,
            modifiedRecord: this.toAuditRecord(created, this.menuRightsOf(menus, menuNames)),
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
        // Notes 125 §3: a SUPER ADMIN user — edited, deactivated, its password
        // reset — and the role itself, only by a SUPER ADMIN.
        await this.assertMayTouch(tx, existing, 'change');
        if (dto.usrType !== existing.usrType) {
          await this.assertMayGiveRole(tx, dto.usrType);
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

        // Review list 11-19 step 3: the rights BEFORE the save, so the audit diffs them menu
        // by menu instead of recording the whole list "from null".
        const menusBefore = await tx.userMenus.findMany({
          where: { umUserId: usrId, umIsDeleted: false },
          orderBy: { umMenuId: 'asc' },
        });

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
            : menusBefore;

        const payload = this.toPayload(updated, menus);
        const menuNames = await this.menuNamesOf(tx, [...menusBefore, ...menus]);
        const rightsBefore = this.menuRightsOf(menusBefore, menuNames);
        const rightsAfter = this.menuRightsOf(menus, menuNames);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: USER_MASTER_TABLE_NAME,
            screenName: USER_ADMIN_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: usrId,
            displayName: this.auditDisplayName(updated),
            originalRecord: this.toAuditRecord(existing, rightsBefore),
            modifiedRecord: this.toAuditRecord(updated, rightsAfter),
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: this.updateNotes(dto, existing, menusBefore, menus, menuNames),
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

  /**
   * 403 USER_RIGHT_<RIGHT> (field `userId`) unless the caller holds `right` on
   * Users & Rights (menu 58). No SUPER ADMIN bypass, as on every menu gate: the
   * SUPER ADMIN rules below apply on top of this one, never instead of it.
   */
  private async assertRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContextService.getUserId(),
      menuId: USER_ADMIN_MENU_ID,
      right,
      codePrefix: USER_ADMIN_RIGHT_PREFIX,
      action,
    });
  }

  /**
   * Notes 125 §3 — SUPER ADMIN is VK Softwares' own account, never a client's
   * role (the user, 2026-10-16): only a SUPER ADMIN saves a user as one.
   * 403 USER_ROLE_RESERVED on `usrType`.
   */
  private async assertMayGiveRole(
    tx: UserAdminWriteClient,
    usrType: UserType | null | undefined,
  ): Promise<void> {
    if (usrType !== UserType.SUPER_ADMIN) {
      return;
    }
    if (!(await callerIsSuperAdmin(tx, this.requestContextService.getUserId()))) {
      throwSettingsForbidden<UserAdminErrorDetail>('User role reserved', [
        {
          field: 'usrType',
          code: UserAdminErrorCode.ROLE_RESERVED,
          message: 'Only a SUPER ADMIN can make a user SUPER ADMIN',
        },
      ]);
    }
  }

  /** Notes 125 §3 — an existing SUPER ADMIN user is changed or deleted only by a SUPER ADMIN. */
  private async assertMayTouch(
    tx: UserAdminWriteClient,
    target: Pick<UserMaster, 'usrType' | 'usrLoginName'>,
    action: 'change' | 'delete',
  ): Promise<void> {
    if (target.usrType !== UserType.SUPER_ADMIN) {
      return;
    }
    if (!(await callerIsSuperAdmin(tx, this.requestContextService.getUserId()))) {
      throwSettingsForbidden<UserAdminErrorDetail>('User role reserved', [
        {
          field: 'usrId',
          code: UserAdminErrorCode.ROLE_RESERVED,
          message: `${target.usrLoginName} is a SUPER ADMIN user: only a SUPER ADMIN can ${action} it`,
        },
      ]);
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
        {
          field: 'menus',
          message: `Menu IDs not found or inactive: ${invalidIds.join(', ')}`,
          code: UserAdminErrorCode.MENU_INVALID,
        },
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
        {
          field: 'usrLoginName',
          message: `Login name '${loginName}' is already taken`,
          code: UserAdminErrorCode.LOGIN_NAME_TAKEN,
        },
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
          code: UserAdminErrorCode.EMPLOYEE_NOT_FOUND,
        },
      ]);
    }
    if (link.companyId && employee.empCompanyId && employee.empCompanyId !== link.companyId) {
      throwSettingsBadRequest<UserAdminErrorDetail>('Employee belongs to another company', [
        {
          field: 'usrEmployeeId',
          message: `Employee "${employee.empName}" is not an employee of the user's company`,
          code: UserAdminErrorCode.EMPLOYEE_OTHER_COMPANY,
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
          code: UserAdminErrorCode.EMPLOYEE_INACTIVE,
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
          code: UserAdminErrorCode.EMPLOYEE_LINKED,
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

  /** The history's name for a user: the display name, else the login name. */
  private auditDisplayName(record: Pick<UserMaster, 'usrDisplayName' | 'usrLoginName'>): string {
    return record.usrDisplayName?.trim() || record.usrLoginName;
  }

  /**
   * What the User Administration audit records (its label map picks the fields): the
   * user row with no hash of any kind (`pinSet` says only whether a PIN exists) and, when
   * given, `menuRights` — the rights by menu NAME. `null` leaves the rights out (delete).
   */
  private toAuditRecord(
    record: UserMaster,
    menuRights: Record<string, string> | null,
  ): Record<string, unknown> {
    return {
      ...this.toPayloadWithoutMenus(record),
      pinSet: Boolean(record.usrPinHash),
      ...(menuRights !== null ? { menuRights } : {}),
    };
  }

  /** Menu id → name for these rows; a name two rows share keeps its id beside it. */
  private async menuNamesOf(
    tx: UserAdminWriteClient,
    menus: readonly Pick<UserMenus, 'umMenuId'>[],
  ): Promise<Map<number, string>> {
    const menuIds = [...new Set(menus.map((menu) => menu.umMenuId))];
    if (menuIds.length === 0) {
      return new Map();
    }
    const rows = await tx.menu.findMany({
      where: { menuId: { in: menuIds } },
      select: { menuId: true, menuName: true },
    });
    const nameOf = (row: { menuId: number; menuName: string | null }) =>
      row.menuName?.trim() || `Menu ${row.menuId}`;
    const nameCount = new Map<string, number>();
    for (const row of rows) {
      nameCount.set(nameOf(row), (nameCount.get(nameOf(row)) ?? 0) + 1);
    }
    return new Map(
      rows.map((row) => {
        const name = nameOf(row);
        return [row.menuId, (nameCount.get(name) ?? 0) > 1 ? `${name} (#${row.menuId})` : name];
      }),
    );
  }

  /** {"Sales Bill": "View, Create, Edit"} — the granted rights per menu, in screen order. */
  private menuRightsOf(
    menus: readonly UserMenus[],
    menuNames: ReadonlyMap<number, string>,
  ): Record<string, string> {
    const rights: Record<string, string> = {};
    for (const menu of [...menus].sort((a, b) => a.umMenuId - b.umMenuId)) {
      const name = menuNames.get(menu.umMenuId) ?? `Menu ${menu.umMenuId}`;
      rights[name] = grantedRights(menu).join(', ') || 'None';
    }
    return rights;
  }

  /**
   * The row's note: what changed that the fields alone do not say. A password reset and a
   * PIN change are named (never their values), and the rights change is spelled per menu:
   * "Menu rights: Sales Bill: Edit off, Post on; Day Book: added (View)".
   */
  private updateNotes(
    dto: SaveUserAdministrationDto,
    existing: UserMaster,
    menusBefore: readonly UserMenus[],
    menusAfter: readonly UserMenus[],
    menuNames: ReadonlyMap<number, string>,
  ): string {
    const notes = ['User updated'];
    if (dto.usrPassword?.trim()) {
      notes.push('password reset by an administrator');
    }
    if (dto.usrPin) {
      notes.push(existing.usrPinHash ? 'PIN changed' : 'PIN set');
    } else if (dto.usrPin !== undefined && existing.usrPinHash) {
      notes.push('PIN cleared');
    }
    const rightsChange = describeMenuRightsChange(menusBefore, menusAfter, menuNames);
    if (rightsChange) {
      notes.push(`Menu rights: ${rightsChange}`);
    }
    return truncateNote(notes.join('; '));
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
      {
        field: 'usrLoginName',
        message: 'A user with this login name already exists',
        code: UserAdminErrorCode.LOGIN_NAME_TAKEN,
      },
    ]);
  }

  private throwNotFound(usrId: string): never {
    throwSettingsNotFound<UserAdminErrorDetail>(
      'User not found',
      'usrId',
      `No active user found with id ${usrId}`,
      UserAdminErrorCode.NOT_FOUND,
    );
  }
}

/** The eleven grantable rights in the order the rights grid shows them. */
const MENU_RIGHT_FLAGS: readonly (readonly [keyof UserMenus, string])[] = [
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

function grantedRights(menu: UserMenus): string[] {
  return MENU_RIGHT_FLAGS.filter(([flag]) => menu[flag] === true).map(([, label]) => label);
}

/** "Sales Bill: Edit off, Post on; Day Book: added (View); Old Report: removed", or '' if none. */
export function describeMenuRightsChange(
  before: readonly UserMenus[],
  after: readonly UserMenus[],
  menuNames: ReadonlyMap<number, string>,
): string {
  const beforeById = new Map(before.map((menu) => [menu.umMenuId, menu]));
  const afterById = new Map(after.map((menu) => [menu.umMenuId, menu]));
  const menuIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort((a, b) => a - b);
  const parts: string[] = [];
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
    const flips = MENU_RIGHT_FLAGS.filter(([flag]) => was[flag] !== now[flag]).map(
      ([flag, label]) => `${label} ${now[flag] === true ? 'on' : 'off'}`,
    );
    if (flips.length > 0) {
      parts.push(`${name}: ${flips.join(', ')}`);
    }
  }
  return parts.join('; ');
}

const MAX_NOTE_LENGTH = 4000;

function truncateNote(note: string): string {
  return note.length <= MAX_NOTE_LENGTH
    ? note
    : `${note.slice(0, MAX_NOTE_LENGTH - 15)} … (and more)`;
}
