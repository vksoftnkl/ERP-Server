import { SaveSaleOrderDto } from './save-sale-order.dto';
export declare class SaleOrderKeysDto {
    soId: string;
    soCompanyId: string;
    soBranchId: string;
    soAccYear: string;
}
export declare class PostSaleOrderDto extends SaleOrderKeysDto {
}
export declare class CancelSaleOrderDto extends SaleOrderKeysDto {
    reason: string;
}
export declare class AmendSaleOrderDto extends SaveSaleOrderDto {
    soId: string;
    baseRevision: number;
    editRemark: string;
}
