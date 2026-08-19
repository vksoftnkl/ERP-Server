export type { FixedErrorDetail as MenuMasterErrorDetail } from "../../../../common/types/module-api.types";
export type { FixedErrorResponse as MenuMasterErrorResponse } from "../../../../common/types/module-api.types";
export type { FixedSuccessResponse as MenuMasterSuccessResponse } from "../../../../common/types/module-api.types";
export interface MenuMasterUserPermissions {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canPrint: boolean;
    canExport: boolean;
    isVisible: boolean;
    isFavourite: boolean;
    isPinned: boolean;
    sortOrder: number;
}
export interface MenuMasterPayload {
    menuId: number;
    menuParentId: number | null;
    menuName: string;
    menuAlias: string | null;
    menuVisibility: boolean;
    menuPosition: string | null;
    menuIconLocationDesktop: string | null;
    menuIconLocationWeb: string | null;
    menuIconLocationMobile: string | null;
    menuSeparator: boolean;
    menuIsActive: boolean;
    permissions: MenuMasterUserPermissions | null;
    children?: MenuMasterPayload[];
}
export interface MenuMasterGetMeta {
    visibleOnly: boolean;
    count: number;
}
