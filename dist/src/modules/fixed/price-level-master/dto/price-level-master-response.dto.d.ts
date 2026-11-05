export declare class PriceLevelMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class PriceLevelMasterErrorResponseDto {
    success: false;
    message: string;
    errors: PriceLevelMasterErrorFieldDto[];
}
export declare class PriceLevelMasterPayloadDto {
    priceLvlId: number;
    priceLvlName: string;
    priceLvlShort: string | null;
    priceLvlIsActive: boolean;
    priceLvlIsAdmin: boolean;
    priceLvlIsDeleted: boolean;
    priceLvlSyncDate: string | null;
    priceLvlCreatedOn: string;
    priceLvlCreatedBy: string | null;
    priceLvlModifiedOn: string;
    priceLvlModifiedBy: string | null;
}
export declare class PriceLevelMasterGetMetaDto {
    priceLvlId?: number;
    priceLvlIsActive?: boolean;
    includeDeleted: boolean;
    count: number;
}
export declare class PriceLevelMasterSuccessGetDto {
    success: true;
    message: string;
    data: PriceLevelMasterPayloadDto[];
    meta: PriceLevelMasterGetMetaDto;
}
export declare class PriceLevelMasterSuccessUpdateDto {
    success: true;
    message: string;
    data: PriceLevelMasterPayloadDto[];
}
