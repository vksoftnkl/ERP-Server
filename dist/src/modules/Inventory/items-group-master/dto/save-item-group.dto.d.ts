export declare class SaveItemGroupDto {
    itg_id?: string;
    itg_name: string;
    itg_alias?: string | null;
    itg_short?: string | null;
    itg_description?: string | null;
    itg_parent_id?: string | null;
    itg_sort?: number;
    itg_level?: number;
    itg_tax_claim?: boolean;
    itg_default_tax_id?: string | null;
    itg_default_hsn?: string;
    itg_default_uom_id?: string | null;
    itg_track_preset_id?: string | null;
    itg_photo?: string | null;
    itg_photo_url?: string;
}
