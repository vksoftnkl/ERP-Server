export declare class SequenceErrorFieldDto {
    field: string;
    message: string;
}
export declare class SequenceErrorResponseDto {
    success: false;
    message: string;
    errors: SequenceErrorFieldDto[];
}
export declare class SequencePayloadDto {
    id: string;
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string | null;
    deviceCode: string;
    periodKey: string;
    lastNo: string;
    voucherPrefix: string | null;
    companyCode: string | null;
    branchCode: string | null;
    voucherSuffix: string | null;
    noWidth: number;
    lastRefno: string | null;
    isActive: boolean;
    isDeleted: boolean;
    createdOn: string;
    createdBy: string | null;
    modifiedOn: string | null;
    modifiedBy: string | null;
}
export declare class SequenceListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class SequenceDeleteResultDto {
    id: string;
    deleted: true;
}
export declare class SequenceSuccessSingleDto {
    success: true;
    message: string;
    data: SequencePayloadDto;
}
export declare class SequenceSuccessListDto {
    success: true;
    message: string;
    data: SequencePayloadDto[];
    meta: SequenceListMetaDto;
}
export declare class SequenceSuccessDeleteDto {
    success: true;
    message: string;
    data: SequenceDeleteResultDto;
}
