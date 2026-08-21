export declare class PromotionSchemeBranchRowDto {
    prb_id?: string;
    prb_slno?: number;
    prb_branch_id?: string;
    prb_is_exclude?: boolean;
    prb_notes?: string | null;
    prb_is_active?: boolean;
    prb_created_by?: string;
    prb_modified_by?: string;
}
export declare class SavePromotionSchemeBranchesDto {
    prm_id: string;
    branches: PromotionSchemeBranchRowDto[];
}
