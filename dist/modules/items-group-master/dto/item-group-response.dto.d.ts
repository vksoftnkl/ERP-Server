export declare class ItemGroupErrorFieldDto {
    field: string;
    message: string;
}
export declare class ItemGroupErrorResponseDto {
    success: false;
    message: string;
    errors: ItemGroupErrorFieldDto[];
}
export declare class ItemGroupPayloadDto {
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
export declare class ItemGroupListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class ItemGroupDeleteResultDto {
    itg_id: string;
    deleted: true;
}
export declare class ItemGroupSuccessSingleDto {
    success: true;
    message: string;
    data: ItemGroupPayloadDto;
}
export declare class ItemGroupSuccessListDto {
    success: true;
    message: string;
    data: ItemGroupPayloadDto[];
    meta: ItemGroupListMetaDto;
}
export declare class ItemGroupSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemGroupDeleteResultDto;
}
