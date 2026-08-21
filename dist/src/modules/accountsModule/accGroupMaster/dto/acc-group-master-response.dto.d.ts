export declare class AccGroupMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class AccGroupMasterErrorResponseDto {
    success: false;
    message: string;
    errors: AccGroupMasterErrorFieldDto[];
}
export declare class AccGroupMasterPayloadDto {
    accGroupId: string;
    accGroupCompanyId: string | null;
    accGroupCompanyName: string | null;
    accGroupName: string;
    accGroupAlias: string | null;
    accGroupShort: string | null;
    accGroupDescription: string | null;
    accGroupTallyName: string | null;
    accGroupPrimaryName: string | null;
    accGroupNature: string | null;
    accGroupTallyGuid: string | null;
    accGroupTallyMasterId: string | null;
    accGroupTallyAlterId: string | null;
    accGroupParentId: string | null;
    accGroupParentName: string | null;
    accGroupSort: number | null;
    accGroupChildIds: string[];
    accGroupType: string;
    accGroupIsDefault: boolean;
    accLedgerProfile: string;
}
export declare class AccGroupMasterDeleteResultDto {
    accGroupId: string;
    deleted: true;
}
export declare class AccGroupMasterSuccessSingleDto {
    success: true;
    message: string;
    data: AccGroupMasterPayloadDto;
}
export declare class AccGroupMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: AccGroupMasterDeleteResultDto;
}
