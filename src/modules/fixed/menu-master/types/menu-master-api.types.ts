export interface MenuMasterErrorDetail {
  field: string;
  message: string;
}

export interface MenuMasterErrorResponse {
  success: false;
  message: string;
  errors: MenuMasterErrorDetail[];
}

export interface MenuMasterSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
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
  children?: MenuMasterPayload[];
}

export interface MenuMasterGetMeta {
  menuId?: number;
  parentId: number | null;
  includeChildren: boolean;
  activeOnly: boolean;
  visibleOnly: boolean;
  count: number;
}

