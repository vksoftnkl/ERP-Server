export declare class ItemSectionErrorFieldDto {
    field: string;
    message: string;
}
export declare class ItemSectionErrorResponseDto {
    success: false;
    message: string;
    errors: ItemSectionErrorFieldDto[];
}
export declare class ItemSectionPayloadDto {
    sec_id: string;
    sec_name: string;
    sec_alias: string | null;
    sec_short: string | null;
    sec_description: string | null;
    sec_company_id: string;
    sec_parent_id: string | null;
    sec_sort: number | null;
    sec_level: number | null;
    sec_path_ids: string[];
    sec_position: number | null;
    sec_color_code: string | null;
    sec_icon: string | null;
    sec_photo: string | null;
    sec_photo_url: string | null;
    sec_sync_date: string | null;
    sec_is_active: boolean;
    sec_is_deleted: boolean;
    sec_created_on: string;
    sec_created_by: string | null;
    sec_modified_on: string;
    sec_modified_by: string | null;
}
export declare class ItemSectionListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class ItemSectionDeleteResultDto {
    sec_id: string;
    deleted: true;
}
export declare class ItemSectionSuccessSingleDto {
    success: true;
    message: string;
    data: ItemSectionPayloadDto;
}
export declare class ItemSectionSuccessListDto {
    success: true;
    message: string;
    data: ItemSectionPayloadDto[];
    meta: ItemSectionListMetaDto;
}
export declare class ItemSectionSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemSectionDeleteResultDto;
}
