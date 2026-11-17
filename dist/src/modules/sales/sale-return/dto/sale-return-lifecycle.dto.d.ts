import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveSaleReturnDto } from './save-sale-return.dto';
export declare class SaleReturnKeysDto {
    srId: string;
    srCompanyId: string;
    srBranchId: string;
    srAccYear: string;
}
export declare class SaleReturnAdjustmentDto {
    ablId: string;
    ablAccYear: string;
    amount: string | number;
    dueNow?: string | number | null;
}
export declare class ValidateSaleReturnDto extends SaveSaleReturnDto {
    overrides?: string[];
    adjustments?: SaleReturnAdjustmentDto[];
    approvalIds?: Record<string, string>;
}
export declare class PostSaleReturnDto extends SaleReturnKeysDto {
    overrides?: string[];
    printAfter?: boolean;
    adjustments?: SaleReturnAdjustmentDto[];
    tenders?: SaveTenderDetailDto[];
    approvalIds?: Record<string, string>;
}
export declare class CancelSaleReturnDto extends SaleReturnKeysDto {
    reason: string;
}
declare const AmendSaleReturnDto_base: import("@nestjs/common").Type<Omit<ValidateSaleReturnDto, "srId">>;
export declare class AmendSaleReturnDto extends AmendSaleReturnDto_base {
    srId: string;
    baseRevision: number;
    editRemark: string;
}
export declare class SaleReturnTransportDto extends SaleReturnKeysDto {
    transport: TransportBandDto;
}
export declare class SaleReturnBillLinesQueryDto {
    sbId: string;
    sbAccYear: string;
    companyId: string;
    branchId: string;
    allBranches?: boolean;
    srId?: string;
}
export {};
