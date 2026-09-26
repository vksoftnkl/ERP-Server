export interface ModuleListMeta {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export type AccountsListMeta = ModuleListMeta;
export type SalesListMeta = ModuleListMeta;
export type PurchaseListMeta = ModuleListMeta;
export type InventoryListMeta = ModuleListMeta;
export type FixedListMeta = ModuleListMeta;
export type SettingsListMeta = ModuleListMeta;
export type MasterListMeta = ModuleListMeta;
