import { UserType } from '../types/user-administration.enum';
export declare class SaveUserMenuDto {
    umMenuId: number;
    umCanView?: boolean;
    umCanCreate?: boolean;
    umCanEdit?: boolean;
    umCanDelete?: boolean;
    umCanPrint?: boolean;
    umCanExport?: boolean;
    umVisibility?: boolean;
    umIsFavourite?: boolean;
    umIsPinned?: boolean;
    umSortOrder?: number;
}
export declare class SaveUserAdministrationDto {
    usrId?: string;
    usrCompanyId?: string | null;
    usrBranchId?: string | null;
    usrEmployeeId?: string | null;
    usrLoginName: string;
    usrDisplayName?: string | null;
    usrFullName?: string | null;
    usrMobileNo?: string | null;
    usrEmail?: string | null;
    usrAvatarUrl?: string | null;
    usrTimezone?: string;
    usrLanguage?: string;
    usrPassword?: string;
    usrMustChangePassword?: boolean;
    usrType?: UserType | null;
    usrEditDate?: boolean;
    usrEditEntry?: boolean;
    usrEditRate?: boolean;
    usrDesktopLogin?: boolean;
    usrWebLogin?: boolean;
    usrMobileLogin?: boolean;
    usrIsActive?: boolean;
    usrNotes?: string | null;
    menus?: SaveUserMenuDto[];
}
