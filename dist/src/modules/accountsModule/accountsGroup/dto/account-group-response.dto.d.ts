export declare class AccountGroupErrorFieldDto {
    field: string;
    message: string;
}
export declare class AccountGroupErrorResponseDto {
    success: false;
    message: string;
    errors: AccountGroupErrorFieldDto[];
}
export declare class AccountGroupPayloadDto {
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
export declare class AccountGroupDeleteResultDto {
    accGroupId: string;
    deleted: true;
}
export declare class AccountGroupSuccessSingleDto {
    success: true;
    message: string;
    data: AccountGroupPayloadDto;
}
export declare class AccountGroupSuccessDeleteDto {
    success: true;
    message: string;
    data: AccountGroupDeleteResultDto;
}
