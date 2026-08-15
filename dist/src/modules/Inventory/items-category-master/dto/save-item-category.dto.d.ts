export declare class SaveItemCategoryDto {
    category_id?: string;
    category_name: string;
    category_alias?: string;
    category_short?: string;
    category_description?: string;
    category_parent_id?: string | null;
    category_sort?: number;
    category_level?: number;
    category_tax_claim?: boolean;
    category_default_tax_id?: string | null;
    category_default_hsn?: string;
    category_default_uom_id?: string | null;
    category_photo?: string | null;
    category_photo_url?: string;
}
