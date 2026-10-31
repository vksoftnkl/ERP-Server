export declare class SaveItemSectionDto {
    sec_id?: string;
    sec_name: string;
    sec_alias?: string | null;
    sec_short?: string | null;
    sec_description?: string | null;
    sec_parent_id?: string | null;
    sec_sort?: number;
    sec_level?: number;
    sec_position?: number;
    sec_color_code?: string;
    sec_icon?: string;
    sec_photo?: string | Buffer | Uint8Array | null;
    sec_photo_url?: string;
}
