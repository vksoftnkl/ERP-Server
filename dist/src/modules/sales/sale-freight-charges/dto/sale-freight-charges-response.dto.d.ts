import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as SaleFreightChargeErrorFieldDto };
export { SalesErrorResponseDto as SaleFreightChargeErrorResponseDto };
export declare class SaleFreightChargePayloadDto {
    frId: string;
    frCompanyId: string | null;
    frCompanyName: string | null;
    frBranchId: string | null;
    frBranchName: string | null;
    frFromKm: number | null;
    frToKm: number | null;
    frFromWeight: number | null;
    frToWeight: number | null;
    frFreightChrg: number | null;
    frIsActive: boolean;
    frIsDeleted: boolean;
    frSyncDate: string | null;
    frCreatedOn: string;
    frCreatedBy: string | null;
    frModifiedOn: string;
    frModifiedBy: string | null;
}
export declare class SaleFreightChargeDeleteResultDto {
    frId: string;
    deleted: true;
}
export declare class SaleFreightChargeSuccessSingleDto {
    success: true;
    message: string;
    data: SaleFreightChargePayloadDto;
}
export declare class SaleFreightChargeSuccessCreateDto {
    success: true;
    message: string;
    data: SaleFreightChargePayloadDto;
}
export declare class SaleFreightChargeSuccessDeleteDto {
    success: true;
    message: string;
    data: SaleFreightChargeDeleteResultDto;
}
