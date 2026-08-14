export declare class ItemBrandErrorFieldDto {
    field: string;
    message: string;
}
export declare class ItemBrandErrorResponseDto {
    success: false;
    message: string;
    errors: ItemBrandErrorFieldDto[];
}
export declare class ItemBrandPayloadDto {
    brand_id: string;
    brand_name: string;
    brand_alias: string | null;
    brand_short: string | null;
    brand_description: string | null;
    brand_photo: string | null;
    brand_photo_url: string | null;
    brand_parent_id: string | null;
    brand_sort: number | null;
    brand_level: number | null;
    brand_path_ids: string[];
    brand_is_active: boolean;
    brand_is_deleted: boolean;
    brand_sync_date: string | null;
    brand_created_on: string;
    brand_created_by: string | null;
    brand_modified_on: string;
    brand_modified_by: string | null;
}
export declare class ItemBrandListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class ItemBrandDeleteResultDto {
    brand_id: string;
    deleted: true;
}
export declare class ItemBrandSuccessSingleDto {
    success: true;
    message: string;
    data: ItemBrandPayloadDto;
}
export declare class ItemBrandSuccessListDto {
    success: true;
    message: string;
    data: ItemBrandPayloadDto[];
    meta: ItemBrandListMetaDto;
}
export declare class ItemBrandSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemBrandDeleteResultDto;
}
