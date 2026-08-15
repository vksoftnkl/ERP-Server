export declare class MenuMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class MenuMasterErrorResponseDto {
    success: false;
    message: string;
    errors: MenuMasterErrorFieldDto[];
}
export declare class MenuMasterUserPermissionsDto {
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
export declare class MenuMasterPayloadDto {
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
    permissions: MenuMasterUserPermissionsDto | null;
    children?: MenuMasterPayloadDto[];
}
export declare class MenuMasterGetMetaDto {
    visibleOnly: boolean;
    count: number;
}
export declare class MenuMasterSuccessGetDto {
    success: true;
    message: string;
    data: MenuMasterPayloadDto[];
    meta: MenuMasterGetMetaDto;
}
export declare class MenuMasterUpdateVisibilityDataDto {
    menuId: number;
    menuVisibility: boolean;
}
export declare class MenuMasterSuccessUpdateVisibilityDto {
    success: true;
    message: string;
    data: MenuMasterUpdateVisibilityDataDto[];
}
