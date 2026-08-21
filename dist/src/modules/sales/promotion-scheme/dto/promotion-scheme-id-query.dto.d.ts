export declare class PromotionSchemeIdQueryDto {
    prm_id: string;
}
export declare class DeletePromotionSchemeQueryDto extends PromotionSchemeIdQueryDto {
    prm_modified_by?: string;
}
export declare class DeletePromotionChildQueryDto {
    row_id: string;
    modified_by?: string;
}
