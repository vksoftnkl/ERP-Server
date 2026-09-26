export type { FixedErrorDetail as MenuMasterErrorDetail } from 'src/common/types/module-api.types';
export type { FixedErrorResponse as MenuMasterErrorResponse } from 'src/common/types/module-api.types';
export type { FixedSuccessResponse as MenuMasterSuccessResponse } from 'src/common/types/module-api.types';

export interface MenuMasterUserPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canExport: boolean;
  /**
   * The five transaction rights. Answered for every menu, but only meaningful
   * where `menuVerbs` says the screen can do it — read the two together: a
   * true `canPost` on a menu without POST in its verbs is a stale grant, not a
   * capability.
   */
  canPost: boolean;
  canCancel: boolean;
  canAmend: boolean;
  canOverride: boolean;
  canRetender: boolean;
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
  /**
   * What this screen can DO. The permissions grid renders a cell only for a
   * verb listed here; a verb that is absent gets NO checkbox, because an
   * unchecked box means denied and that is a different statement from "this
   * screen has nothing to post".
   */
  menuVerbs: string[];
  permissions: MenuMasterUserPermissions | null;
  children?: MenuMasterPayload[];
}

export interface MenuMasterGetMeta {
  visibleOnly: boolean;
  count: number;
}
