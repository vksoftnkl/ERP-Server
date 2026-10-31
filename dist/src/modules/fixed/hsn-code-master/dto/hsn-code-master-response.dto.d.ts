export declare class HsnCodeMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class HsnCodeMasterErrorResponseDto {
    success: false;
    message: string;
    errors: HsnCodeMasterErrorFieldDto[];
}
export declare class HsnCodeMasterPayloadDto {
    hsnId: number;
    hsnCode: string;
    hsnName: string;
    hsnDescription: string | null;
    hsnIsService: boolean;
    hsnUqc: string | null;
    hsnIsActive: boolean;
    hsnRateOfTax: number;
}
export declare class HsnCodeMasterGetMetaDto {
    hsnId?: number;
    hsnCode?: string;
    activeOnly: boolean;
    count: number;
}
export declare class HsnCodeMasterSuccessGetDto {
    success: true;
    message: string;
    data: HsnCodeMasterPayloadDto[];
    meta: HsnCodeMasterGetMetaDto;
}
