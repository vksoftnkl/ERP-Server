export declare class SupplierGroupErrorFieldDto {
    field: string;
    message: string;
}
export declare class SupplierGroupErrorResponseDto {
    success: false;
    message: string;
    errors: SupplierGroupErrorFieldDto[];
}
export declare class SupplierGroupPayloadDto {
    spgId: string;
    spgName: string;
    spgAlias: string | null;
    spgShort: string | null;
    spgDesc: string | null;
    spgIsActive: boolean;
    spgIsDeleted: boolean;
    spgSyncDate: string | null;
    spgCreatedOn: string;
    spgCreatedBy: string | null;
    spgModifiedOn: string;
    spgModifiedBy: string | null;
}
export declare class SupplierGroupDeleteResultDto {
    spgId: string;
    deleted: true;
}
export declare class SupplierGroupSuccessSingleDto {
    success: true;
    message: string;
    data: SupplierGroupPayloadDto;
}
export declare class SupplierGroupSuccessDeleteDto {
    success: true;
    message: string;
    data: SupplierGroupDeleteResultDto;
}
