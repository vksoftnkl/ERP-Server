import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import { UserType } from './user-administration.enum';

export type UserAdminErrorDetail = ModuleApiErrorDetail;
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
  usrType: UserType | null;
  usrEditDate: boolean;
  usrEditEntry: boolean;
  usrEditRate: boolean;
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
