export declare class TenderTypeMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class TenderTypeMasterErrorResponseDto {
    success: false;
    message: string;
    errors: TenderTypeMasterErrorFieldDto[];
}
export declare class TenderTypeMasterPayloadDto {
    ttmTypeId: string;
    ttmTypeName: string;
    ttmDisplayName: string;
    ttmIsActive: boolean;
    ttmIsDeleted: boolean;
    ttmSyncDate: string | null;
    ttmCreatedOn: string;
    ttmCreatedBy: string | null;
    ttmModifiedOn: string | null;
    ttmModifiedBy: string | null;
}
export declare class TenderTypeMasterDeleteResultDto {
    ttmTypeId: string;
    deleted: true;
}
export declare class TenderTypeMasterSuccessSingleDto {
    success: true;
    message: string;
    data: TenderTypeMasterPayloadDto;
}
export declare class TenderTypeMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: TenderTypeMasterDeleteResultDto;
}
