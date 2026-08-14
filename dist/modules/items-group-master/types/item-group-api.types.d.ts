export interface ItemGroupErrorDetail {
    field: string;
    message: string;
}
export interface ItemGroupErrorResponse {
    success: false;
    message: string;
    errors: ItemGroupErrorDetail[];
}
export interface ItemGroupSuccessResponse<T, TMeta = Record<string, unknown>> {
    success: true;
    message: string;
    data: T;
    meta?: TMeta;
}
export interface ItemGroupPayload {
    itg_id: string;
    itg_name: string;
    itg_alias: string | null;
    itg_short: string | null;
    itg_description: string | null;
    itg_parent_id: string | null;
    itg_sort: number | null;
    itg_level: number | null;
    itg_path_ids_cache: string[];
    itg_tax_claim: boolean | null;
    itg_default_tax_id: string | null;
    itg_default_hsn: string | null;
    itg_default_uom_id: string | null;
    itg_photo: string | null;
    itg_photo_url: string | null;
    itg_sync_date: string | null;
    itg_is_active: boolean;
    itg_is_deleted: boolean;
    itg_created_on: string;
    itg_created_by: string | null;
    itg_modified_on: string;
    itg_modified_by: string | null;
}
export interface ItemGroupListMeta {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
