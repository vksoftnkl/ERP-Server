import { SaleOrderKeysDto } from '../../sale-order/dto/sale-order-lifecycle.dto';
export declare class DeliveryHoldDto extends SaleOrderKeysDto {
    soDeliveryHold: boolean;
    reason?: string;
}
export declare class PriorityDto extends SaleOrderKeysDto {
    soPriority: string;
}
export declare class CloseOpenLinesDto extends SaleOrderKeysDto {
    reason?: string;
}
export declare class SaleOrderDeskOrderRefDto {
    soId: string;
    soAccYear: string;
}
declare class SaleOrderDeskScopeDto {
    soCompanyId: string;
    soBranchId: string;
}
export declare class StockCoverDto extends SaleOrderDeskScopeDto {
    orders: SaleOrderDeskOrderRefDto[];
    itemId?: string | null;
}
export declare class FiguresDto extends SaleOrderDeskScopeDto {
    itemId?: string | null;
    orders: SaleOrderDeskOrderRefDto[];
    custIds?: string[];
}
export declare class MergePreviewDto extends SaleOrderDeskScopeDto {
    orders: SaleOrderDeskOrderRefDto[];
}
export declare class MergeDto extends MergePreviewDto {
    soAccYear: string;
    soDeviceId: string;
    soSessionId?: string | null;
    fingerprint: string;
    reason?: string;
}
export {};
