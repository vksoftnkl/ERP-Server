export declare class ChargeMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class ChargeMasterErrorResponseDto {
    success: false;
    message: string;
    errors: ChargeMasterErrorFieldDto[];
}
export declare class ChargeMasterPayloadDto {
    chgId: string;
    chgName: string;
    chgCode: string | null;
    chgModule: string;
    chgRole: string | null;
    chgMethod: string;
    chgType: string;
    chgApplyOn: string;
    chgDefaultRate: number | null;
    chgLandingCost: boolean;
    chgCostAlloc: string | null;
    chgLedgerCode: string;
    chgLedgerName: string | null;
    ledHsnSac: string | null;
    ledGstRate: number | null;
    ledTaxability: string | null;
    chgTaxApl: boolean;
    chgBeforeTax: boolean;
    chgSepPost: boolean;
    chgManParty: boolean;
    chgDispOrder: number | null;
    chgAutoApply: boolean;
    chgIsActive: boolean;
    chgIsDeleted: boolean;
    chgSyncDate: string | null;
    chgCreatedOn: string;
    chgCreatedBy: string | null;
    chgModifiedOn: string | null;
    chgModifiedBy: string | null;
}
export declare class ChargeMasterSuccessManyDto {
    success: true;
    message: string;
    data: ChargeMasterPayloadDto[];
}
export declare class ChargeMasterListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class ChargeMasterDeleteResultDto {
    chgId: string;
    deleted: true;
}
export declare class ChargeMasterSuccessSingleDto {
    success: true;
    message: string;
    data: ChargeMasterPayloadDto;
}
export declare class ChargeMasterSuccessListDto {
    success: true;
    message: string;
    data: ChargeMasterPayloadDto[];
    meta: ChargeMasterListMetaDto;
}
export declare class ChargeMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: ChargeMasterDeleteResultDto;
}
