import { type BehindKind, type PositionBucket, type PositionQtyIn } from '../types/godown-position.types';
export declare class GodownPositionScopeDto {
    companyId: string;
    branchId: string;
    qtyIn?: PositionQtyIn;
    bucket?: PositionBucket;
}
export declare class GodownPositionQueryDto extends GodownPositionScopeDto {
    godownId?: string;
    groupId?: string;
    brandId?: string;
    onlyToGive?: boolean;
    hideZero?: boolean;
    find?: string;
}
export declare class GodownPositionExportDto extends GodownPositionQueryDto {
}
export declare class GodownPositionBehindDto extends GodownPositionScopeDto {
    itemId: string;
    godownId: string;
    kind: BehindKind;
}
