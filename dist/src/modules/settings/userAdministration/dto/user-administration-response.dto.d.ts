import { UserType } from '../types/user-administration.enum';
export declare class UserAdminErrorFieldDto {
    field: string;
    message: string;
}
export declare class UserAdminErrorResponseDto {
    success: false;
    message: string;
    errors: UserAdminErrorFieldDto[];
}
export declare class UserMenuPayloadDto {
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
export declare class UserAdminPayloadDto {
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
    menus: UserMenuPayloadDto[];
}
export declare class UserAdminDeleteResultDto {
    usrId: string;
    deleted: true;
}
export declare class UserAdminSuccessSingleDto {
    success: true;
    message: string;
    data: UserAdminPayloadDto;
}
export declare class UserAdminSuccessDeleteDto {
    success: true;
    message: string;
    data: UserAdminDeleteResultDto;
}
