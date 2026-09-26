import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as SaleLoadingChargeErrorFieldDto };
export { SalesErrorResponseDto as SaleLoadingChargeErrorResponseDto };
export declare class SaleLoadingChargePayloadDto {
    ilcId: string;
    ilcCompId: string | null;
    ilcCompanyName: string | null;
    ilcBranchId: string | null;
    ilcBranchName: string | null;
    ilcFromWeight: number | null;
    ilcToWeight: number | null;
    ilcLoadChrg: number | null;
    ilcUnloadChrg: number | null;
    ilcIsActive: boolean;
    ilcIsDeleted: boolean;
    ilcSyncDate: string | null;
    ilcCreatedOn: string;
    ilcCreatedBy: string | null;
    ilcModifiedOn: string;
    ilcModifiedBy: string | null;
}
export declare class SaleLoadingChargeDeleteResultDto {
    ilcId: string;
    deleted: true;
}
export declare class SaleLoadingChargeSuccessSingleDto {
    success: true;
    message: string;
    data: SaleLoadingChargePayloadDto;
}
export declare class SaleLoadingChargeSuccessCreateDto {
    success: true;
    message: string;
    data: SaleLoadingChargePayloadDto;
}
export declare class SaleLoadingChargeSuccessDeleteDto {
    success: true;
    message: string;
    data: SaleLoadingChargeDeleteResultDto;
}
