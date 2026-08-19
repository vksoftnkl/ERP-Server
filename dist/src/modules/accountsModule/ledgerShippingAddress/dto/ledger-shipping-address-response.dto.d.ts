export declare class LedgerShippingAddressErrorFieldDto {
    field: string;
    message: string;
}
export declare class LedgerShippingAddressErrorResponseDto {
    success: false;
    message: string;
    errors: LedgerShippingAddressErrorFieldDto[];
}
export declare class LedgerShippingAddressPayloadDto {
    saaId: string;
    saaCompanyId: string | null;
    saaBranchId: string | null;
    saaLedgerId: string;
    saaAddrType: string;
    saaIsDefault: boolean;
    saaSort: number;
    saaTradeName: string | null;
    saaContactName: string | null;
    saaAddr1: string | null;
    saaAddr2: string | null;
    saaAddr3: string | null;
    saaLocation: string | null;
    saaPin: string | null;
    saaStateCode: string | null;
    saaStateName: string | null;
    saaCountryCode: string;
    saaDistanceKm: number | null;
    saaPhone: string | null;
    saaEmail: string | null;
    saaGstin: string;
    saaSyncedOn: string | null;
    saaIsActive: boolean;
    saaIsDeleted: boolean;
    saaCreatedOn: string;
    saaCreatedBy: string | null;
    saaModifiedOn: string;
    saaModifiedBy: string | null;
    saaRemarks: string | null;
}
export declare class LedgerShippingAddressDeleteResultDto {
    saaId: string;
    deleted: true;
}
export declare class LedgerShippingAddressSuccessSingleDto {
    success: true;
    message: string;
    data: LedgerShippingAddressPayloadDto;
}
export declare class LedgerShippingAddressSuccessDeleteDto {
    success: true;
    message: string;
    data: LedgerShippingAddressDeleteResultDto;
}
