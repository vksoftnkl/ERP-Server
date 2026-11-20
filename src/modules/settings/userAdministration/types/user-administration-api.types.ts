import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import { UserType } from './user-administration.enum';

/** `code` (notes 119): a UserAdminErrorCode — USER_ROLE_RESERVED for the SUPER ADMIN guard (notes 125 §3). */
export interface UserAdminErrorDetail extends ModuleApiErrorDetail {
  code: string;
  /** USER_RESTORE_LOGIN_TAKEN: the live user's login name, for the wording's {loginName}. */
  loginName?: string;
}
export type UserAdminErrorResponse = ModuleApiErrorResponse<UserAdminErrorDetail>;
export type UserAdminSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

export interface UserMenuPayload {
  umId: string;
  umUserId: string;
  umMenuId: number;
  umCanView: boolean;
  umCanCreate: boolean;
  umCanEdit: boolean;
  umCanDelete: boolean;
  umCanPrint: boolean;
  umCanExport: boolean;
  /** The five transaction rights. Meaningful only on a posting screen. */
  umCanPost: boolean;
  umCanCancel: boolean;
  umCanAmend: boolean;
  umCanOverride: boolean;
  umCanRetender: boolean;
  umVisibility: boolean;
  umIsFavourite: boolean;
  umIsPinned: boolean;
  umSortOrder: number;
  umIsDeleted: boolean;
  umSyncDate: string | null;
  umCreatedOn: string;
  umCreatedBy: string;
  umModifiedOn: string | null;
  umModifiedBy: string | null;
}

export interface UserAdminPayload {
  usrId: string;
  usrCompanyId: string | null;
  usrCompanyName?: string | null;
  usrBranchId: string | null;
  usrBranchName?: string | null;
  usrEmployeeId: string | null;
  usrEmployeeName?: string | null;
  usrLoginName: string;
  usrDisplayName: string;
  usrFullName: string | null;
  usrMobileNo: string | null;
  usrEmail: string | null;
  usrAvatarUrl: string | null;
  usrTimezone: string;
  usrLanguage: string;
  usrMustChangePassword: boolean;
  usrPasswordExpiresOn: string | null;
  usrPasswordChangedOn: string | null;
  /** Notes 95 — whether a till PIN is set. The hash itself is never returned. */
  usrPinSet: boolean;
  usrType: UserType | null;
  usrEditDate: boolean;
  usrEditEntry: boolean;
  /** Screen label "Allow rate / discount change" (review step 6). */
  usrEditRate: boolean;
  /** Review step 6: max discount % on a Sale Bill as a decimal string ("12.50"); null = no limit. */
  usrMaxDiscPerc: string | null;
  usrDesktopLogin: boolean;
  usrWebLogin: boolean;
  usrMobileLogin: boolean;
  usrIsActive: boolean;
  usrIsLocked: boolean;
  usrFailedLoginCount: number;
  usrLastFailedLoginOn: string | null;
  usrLockedOn: string | null;
  usrLockedBy: string | null;
  usrLastLoginOn: string | null;
  usrIsDeleted: boolean;
  usrNotes: string | null;
  usrSyncDate: string | null;
  usrCreatedOn: string;
  usrCreatedBy: string | null;
  usrModifiedOn: string | null;
  usrModifiedBy: string | null;
  menus: UserMenuPayload[];
}

/** POST /user-administration/reset-password (review step 6, U8). */
export interface UserAdminResetPasswordResult {
  usrId: string;
  usrLoginName: string;
  usrMustChangePassword: true;
  usrPasswordChangedOn: string;
  /** The generated password, answered once; null when the administrator typed one. */
  generatedPassword: string | null;
}

/** POST /user-administration/unlock (review step 6). */
export interface UserAdminUnlockResult {
  usrId: string;
  usrIsLocked: false;
  usrFailedLoginCount: 0;
  usrLockedOn: null;
  usrLockedBy: null;
  /** false = nothing to clear (not locked, no failed logins): no write, no audit row. */
  changed: boolean;
}

/** POST /user-administration/restore (review step 6, U10). */
export interface UserAdminRestoreResult {
  usrId: string;
  usrLoginName: string;
  usrIsDeleted: false;
  usrIsActive: false;
  /** How many menu rights rows came back: the ones the delete removed (an inactive menu's left out). */
  menuCount: number;
}
